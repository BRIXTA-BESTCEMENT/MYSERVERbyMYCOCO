import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { kycSubmissions, masonPcSide, pointsLedger } from '../../db/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { calculateJoiningBonusPoints } from '../../utils/pointsCalcLogic';

// ---------------- Schema ----------------

const kycSubmissionSchema = z.object({
  masonId: z.string().uuid(),
  name: z.string().optional(),
  aadhaarNumber: z.string().trim().max(50).optional().nullable(),
  panNumber: z.string().trim().max(50).optional().nullable(),
  voterIdNumber: z.string().trim().max(50).optional().nullable(),
  documents: z.object({
    aadhaarFrontUrl: z.string().url().optional(),
    aadhaarBackUrl: z.string().url().optional(),
    panUrl: z.string().url().optional(),
    voterUrl: z.string().url().optional(),
  }).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
}).strict();

// 🟢 HELPER: FROM OLD COMMIT
function generateSimplePassword(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ---------------- Route ----------------

export default function setupKycSubmissionsPostRoute(app: Express) {

  app.post('/api/kyc-submissions', async (req: Request, res: Response) => {
    try {
      const input = kycSubmissionSchema.parse(req.body);
      const { masonId, name, documents, ...rest } = input;

      // 1. Fetch Mason
      const [mason] = await db.select().from(masonPcSide).where(eq(masonPcSide.id, masonId)).limit(1);

      if (!mason) {
        return res.status(404).json({ success: false, error: 'Mason not found.' });
      }

      // 2. Determine Name
      const finalName = name && name.trim().length > 0 ? name.trim() : (mason.name || "USER");

      // 🟢 3. GENERATE CREDENTIALS (COPIED FROM OLD COMMIT)
      // ---------------------------------------------------------
      const cleanName = finalName.replace(/[^a-zA-Z]/g, '').toUpperCase();
      const prefix = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'X');
      const phoneStr = mason.phoneNumber || "0000";
      const suffix = phoneStr.length >= 4 ? phoneStr.substring(phoneStr.length - 4) : "0000";
      
      const newUserId = `${prefix}${suffix}`;
      const newPassword = generateSimplePassword(6);
      const compositeCredentials = `${newUserId}|${newPassword}`; 
      // ---------------------------------------------------------

      // 4. Transaction
      const { submission, appliedBonus } = await db.transaction(async (tx) => {

        // A. Insert KYC
        const [submission] = await tx.insert(kycSubmissions).values({
          id: randomUUID(),
          masonId,
          ...rest,
          documents: documents ?? null,
          status: 'approved',
          remark: rest.remark ?? null,
        }).returning();

        // B. Prepare Mason Update
        const masonUpdates: any = {
          kycStatus: 'approved',
          name: finalName,
          // 🟢 SAVE CREDENTIALS TO DB
          firebaseUid: compositeCredentials, 
        };

        // C. Calculate Points (Your NEW Logic)
        const joiningBonus = calculateJoiningBonusPoints();
        let appliedBonus = 0;

        if (mason.kycStatus !== 'approved' && joiningBonus > 0) {
          appliedBonus = joiningBonus;
          masonUpdates.pointsBalance = sql`${masonPcSide.pointsBalance} + ${joiningBonus}`;

          await tx.insert(pointsLedger).values({
            id: randomUUID(),
            masonId,
            sourceType: 'joining_bonus',
            sourceId: submission.id,
            points: joiningBonus,
            memo: 'Joining Bonus on first KYC approval',
          });
        }

        // D. Update Mason
        await tx.update(masonPcSide)
          .set(masonUpdates)
          .where(eq(masonPcSide.id, masonId));

        return { submission, appliedBonus };
      });

      // 5. Response
      return res.status(201).json({
        success: true,
        message: appliedBonus > 0
          ? `KYC approved. ${appliedBonus} joining points credited.`
          : `KYC approved. No joining bonus applied.`,
        
        // 🟢 RETURN CREDENTIALS TO APP
        credentials: {
          userId: newUserId,
          password: newPassword,
          qrData: JSON.stringify({ u: newUserId, p: newPassword })
        },
        
        data: submission,
      });

    } catch (err: any) {
      console.error('POST KYC error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
      }
      return res.status(500).json({ success: false, error: 'Failed to submit KYC', details: err?.message });
    }
  });

  console.log('✅ KYC POST endpoint ready');
}