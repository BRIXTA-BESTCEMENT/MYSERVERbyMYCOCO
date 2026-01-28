// server/src/routes/formSubmissionRoutes/kycSubmissions.ts

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

// ---------------- Route ----------------

export default function setupKycSubmissionsPostRoute(app: Express) {

  app.post('/api/kyc-submissions', async (req: Request, res: Response) => {
    try {
      const input = kycSubmissionSchema.parse(req.body);
      const { masonId, name, documents, ...rest } = input;

      // 1️⃣ Fetch Mason (needed for idempotency)
      const [mason] = await db
        .select()
        .from(masonPcSide)
        .where(eq(masonPcSide.id, masonId))
        .limit(1);

      if (!mason) {
        return res.status(404).json({ success: false, error: 'Mason not found.' });
      }

      const finalName =
        name && name.trim().length > 0 ? name.trim() : mason.name;

      // 2️⃣ Transaction
      const { submission, appliedBonus } = await db.transaction(async (tx) => {

        // A. Insert KYC submission (auto-approved)
        const [submission] = await tx.insert(kycSubmissions).values({
          id: randomUUID(),
          masonId,
          ...rest,
          documents: documents ?? null,
          status: 'approved',
          remark: rest.remark ?? null,
        }).returning();

        // B. Prepare mason updates
        const masonUpdates: any = {
          kycStatus: 'approved',
          name: finalName,
        };

        // C. JOINING BONUS (IDENTICAL TO PATCH LOGIC)
        const joiningBonus = calculateJoiningBonusPoints();
        let appliedBonus = 0;

        if (
          mason.kycStatus !== 'approved' &&
          joiningBonus > 0
        ) {
          appliedBonus = joiningBonus;

          masonUpdates.pointsBalance = sql`
            ${masonPcSide.pointsBalance} + ${joiningBonus}
          `;

          await tx.insert(pointsLedger).values({
            id: randomUUID(),
            masonId,
            sourceType: 'joining_bonus',
            sourceId: submission.id,
            points: joiningBonus,
            memo: 'Joining Bonus on first KYC approval',
          });
        }

        // D. Update mason record
        await tx.update(masonPcSide)
          .set(masonUpdates)
          .where(eq(masonPcSide.id, masonId));

        return { submission, appliedBonus };
      });

      // 3️⃣ Response
      return res.status(201).json({
        success: true,
        message: appliedBonus > 0
          ? `KYC approved. ${appliedBonus} joining points credited.`
          : `KYC approved. No joining bonus applied.`,
        data: submission,
      });

    } catch (err: any) {
      console.error('POST KYC error:', err);

      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: err.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to submit KYC',
        details: err?.message ?? 'Unknown error',
      });
    }
  });

  console.log('✅ KYC POST endpoint ready (Approved + Joining Bonus, Idempotent)');
}