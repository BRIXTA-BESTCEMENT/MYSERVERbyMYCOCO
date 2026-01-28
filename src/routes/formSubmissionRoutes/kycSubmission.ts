import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { kycSubmissions, masonPcSide, pointsLedger } from '../../db/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';
import { calculateJoiningBonusPoints } from '../../utils/pointsCalcLogic'; // Ensure this path is correct

// Define the type of the inserted row for strong typing
type KycSubmission = InferSelectModel<typeof kycSubmissions>;

// Helper: Generate a simple 6-char alphanumeric password
function generateSimplePassword(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded similar looking chars
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Zod schema for KYC submission
const kycSubmissionSchema = z.object({
  masonId: z.string().uuid({ message: 'A valid Mason ID (UUID) is required.' }),
  aadhaarNumber: z.string().max(20).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  voterIdNumber: z.string().max(20).optional().nullable(),
  documents: z.object({
    aadhaarFrontUrl: z.string().url().optional(),
    aadhaarBackUrl: z.string().url().optional(),
    panUrl: z.string().url().optional(),
    voterUrl: z.string().url().optional(),
  }).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
}).strict();

export default function setupKycSubmissionsPostRoute(app: Express) {
  
  app.post('/api/kyc-submissions', async (req: Request, res: Response) => {
    const tableName = 'KYC Submission';
    try {
      // 1. Validate input
      const input = kycSubmissionSchema.parse(req.body);
      const { masonId, documents, ...rest } = input;
      
      // 2. Fetch Mason details
      const [mason] = await db.select({
        id: masonPcSide.id,
        name: masonPcSide.name,
        phoneNumber: masonPcSide.phoneNumber,
        pointsBalance: masonPcSide.pointsBalance,
      })
      .from(masonPcSide)
      .where(eq(masonPcSide.id, masonId))
      .limit(1);

      if (!mason) {
        return res.status(404).json({ success: false, error: 'Mason not found.' });
      }

      // 3. Prepare Logic
      
      // A. Generate Credentials
      // Logic: First 4 chars of Name + Last 4 of Phone
      const cleanName = (mason.name || "USER").replace(/[^a-zA-Z]/g, '').toUpperCase();
      const prefix = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'X');
      const phoneStr = mason.phoneNumber || "0000";
      const suffix = phoneStr.length >= 4 ? phoneStr.substring(phoneStr.length - 4) : "0000";
      
      const newUserId = `${prefix}${suffix}`;
      const newPassword = generateSimplePassword(6);
      const compositeCredentials = `${newUserId}|${newPassword}`; // Stored in firebaseUid

      // B. Calculate Joining Bonus
      const joiningPoints = calculateJoiningBonusPoints(); 
      const newBalance = (mason.pointsBalance || 0) + joiningPoints;

      // 4. Run Transaction
      const result = await db.transaction(async (tx) => {
        
        // Step 1: Insert KYC Record
        const [submission] = await tx.insert(kycSubmissions)
          .values({
            id: randomUUID(),
            masonId,
            ...rest,
            documents: documents ? JSON.stringify(documents) : null,
            status: 'approved', // Auto-approve
          })
          .returning();
          
        // Step 2: Update Mason (Credentials + Status + Points)
        await tx.update(masonPcSide)
          .set({ 
            kycStatus: 'approved',
            firebaseUid: compositeCredentials, // The MAGIC happens here
            pointsBalance: newBalance,
          })
          .where(eq(masonPcSide.id, masonId));

        // Step 3: Add to Ledger if points were given
        if (joiningPoints > 0) {
          await tx.insert(pointsLedger).values({
            id: randomUUID(),
            masonId,
            sourceType: 'adjustment', // or 'joining_bonus'
            sourceId: submission.id,  // Link to the KYC record ID
            points: joiningPoints,
            memo: 'Joining Bonus upon KYC Approval',
          });
        }
          
        return { submission, joiningPoints };
      });

      // 5. Send success response WITH credentials
      return res.status(201).json({
        success: true,
        message: `KYC Approved. User ID generated. ${result.joiningPoints} Points credited.`,
        credentials: {
          userId: newUserId,
          password: newPassword,
          // QR Data for the TSO app to display
          qrData: JSON.stringify({ u: newUserId, p: newPassword })
        },
        data: result.submission,
      });

    } catch (err: any) {
      console.error(`Create ${tableName} error:`, err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      }
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create ${tableName}`, 
        details: err?.message ?? 'Unknown error' 
      });
    }
  });

  console.log('✅ KYC Submissions POST endpoint setup complete (Auto-Approve, Credentials & Points)');
}