// server/src/routes/updateRoutes/kycSubmission.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { kycSubmissions, masonPcSide, pointsLedger } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { calculateJoiningBonusPoints } from '../../utils/pointsCalcLogic';

const kycApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  remark: z.string().max(500).optional().nullable(),
  
  // Allow updating Mason Profile details
  masonUpdates: z.object({
      dealerId: z.string().optional().nullable(), 
      name: z.string().min(1).optional(),
  }).optional(),
  
  documents: z.any().optional(), 
}).strict();

export default function setupKycSubmissionsPatchRoute(app: Express) {
  
  app.patch('/api/kyc-submissions/:id', async (req: Request, res: Response) => {
    const tableName = 'KYC Submission';
    try {
      const { id } = req.params;
      
      // 1. Validate input
      const input = kycApprovalSchema.parse(req.body);
      const { status, remark, masonUpdates, documents } = input;

      // 2. Find existing submission
      const [existingRecord] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.id, id)).limit(1);
      if (!existingRecord) return res.status(404).json({ error: `${tableName} with ID '${id}' not found.` });
      
      const masonId = existingRecord.masonId;

      // 3. Fetch Mason to check current status (prevent double bonus)
      const [mason] = await db.select().from(masonPcSide).where(eq(masonPcSide.id, masonId)).limit(1);
      if (!mason) return res.status(404).json({ error: 'Associated Mason not found.' });

      // 4. Transactional Update
      const [updatedSubmission] = await db.transaction(async (tx) => {
        
        // --- A. Prepare Submission Updates ---
        const subUpdates: any = { status, updatedAt: new Date() };
        if (remark !== undefined) subUpdates.remark = remark;
        if (documents !== undefined) subUpdates.documents = JSON.stringify(documents);

        const [submission] = await tx.update(kycSubmissions)
          .set(subUpdates)
          .where(eq(kycSubmissions.id, id))
          .returning();
          
        // --- B. Prepare Mason Profile Updates ---
        const masonFieldsToUpdate: any = { kycStatus: status }; 
        
        if (masonUpdates) {
            if (masonUpdates.dealerId !== undefined) masonFieldsToUpdate.dealerId = masonUpdates.dealerId;
            if (masonUpdates.name !== undefined) masonFieldsToUpdate.name = masonUpdates.name;
        }

        // --- C. JOINING BONUS LOGIC (Mirroring Prisma) ---
        const joiningBonus = calculateJoiningBonusPoints();
        let appliedBonus = 0;

        // Apply bonus ONLY if:
        // 1. New status is 'approved'
        // 2. Previous status was NOT 'approved' (prevent duplicate if re-approving)
        // 3. Bonus amount is > 0
        if (status === 'approved' && mason.kycStatus !== 'approved' && joiningBonus > 0) {
            appliedBonus = joiningBonus;
            
            // Add Bonus to Update Object
            // We use sql increment to be atomic
            masonFieldsToUpdate.pointsBalance = sql`${masonPcSide.pointsBalance} + ${joiningBonus}`;

            // Create Ledger Entry
            await tx.insert(pointsLedger).values({
                id: randomUUID(),
                masonId: masonId,
                sourceType: 'joining_bonus', // or 'adjustment' depending on your enum convention
                sourceId: submission.id,     // Link to the KYC submission ID
                points: joiningBonus,
                memo: `Joining Bonus: KYC Verified on ${new Date().toLocaleDateString()}`,
            });
        }

        // --- D. Update Mason Table ---
        await tx.update(masonPcSide)
          .set(masonFieldsToUpdate)
          .where(eq(masonPcSide.id, masonId));
          
        return [submission];
      });

      res.json({
        success: true,
        message: `KYC Updated to '${updatedSubmission.status}'. Mason Profile synced.`,
        data: updatedSubmission,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
      console.error(`PATCH ${tableName} error:`, error);
      return res.status(500).json({ success: false, error: `Failed to update.` });
    }
  });

  console.log('✅ KYC Submissions PATCH (Approved + Joining Bonus) endpoint setup complete');
}