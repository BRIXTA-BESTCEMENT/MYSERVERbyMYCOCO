// server/src/routes/updateRoutes/bagsLift.ts
// Bags Lift PATCH endpoint for TSO approval and points update

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { bagLifts, pointsLedger, masonPcSide } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// --- IMPORT CORE CALCULATION LOGIC ---
import { calculateExtraBonusPoints, checkReferralBonusTrigger } from '../../utils/pointsCalcLogic';
// --- END IMPORT ---

// --- TSO AUTH IMPORT ---
import { tsoAuth } from '../../middleware/tsoAuth';
// ---

interface CustomRequest extends Request {
    auth?: {
        sub: string;
        role: string;
        phone: string;
        kyc: string;
    };
}

// --- UPDATED ZOD SCHEMA ---
const bagLiftApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  memo: z.string().max(500).optional(),
  
  // New TSO Verification Fields (Optional/Nullable)
  siteId: z.string().optional().nullable().or(z.literal("")), // Handle UUID or empty string
  siteKeyPersonName: z.string().optional().nullable(),
  siteKeyPersonPhone: z.string().optional().nullable(),
  verificationSiteImageUrl: z.string().optional().nullable(),
  verificationProofImageUrl: z.string().optional().nullable(),
}).strict();

export default function setupBagLiftsPatchRoute(app: Express) {
  
  app.patch('/api/bag-lifts/:id', tsoAuth, async (req: CustomRequest, res: Response) => {
    const tableName = 'Bag Lift';
    try {
      const { id } = req.params;

      // 1. Auth Check
      const authenticatedUserId = parseInt(req.auth!.sub, 10);
      if (isNaN(authenticatedUserId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID in auth token." });
      }
      
      // 2. Validate incoming data
      const input = bagLiftApprovalSchema.parse(req.body);

      // 3. Find existing record
      const [existingRecord] = await db.select().from(bagLifts).where(eq(bagLifts.id, id)).limit(1);
      if (!existingRecord) {
        return res.status(404).json({ error: `${tableName} with ID '${id}' not found.` });
      }
      
      const { status, memo } = input;
      const currentStatus = existingRecord.status;
      const masonId = existingRecord.masonId;
      const points = existingRecord.pointsCredited!;

      // 4. Logic checks
      if (status === currentStatus) {
         return res.status(400).json({ success: false, error: `Status is already '${currentStatus}'.` });
      }
      if (status === 'approved' && currentStatus === 'rejected') {
         return res.status(400).json({ success: false, error: 'Cannot directly approve a previously rejected transaction.' });
      }

      // --- Helper: Prepare Verification Data ---
      // We only want to save these if they are provided. 
      // Important: Convert empty string "" to null for UUID column to prevent DB crash.
      const cleanSiteId = (input.siteId && input.siteId.length > 0) ? input.siteId : null;
      
      const verificationUpdates = {
          siteId: cleanSiteId,
          siteKeyPersonName: input.siteKeyPersonName || null,
          siteKeyPersonPhone: input.siteKeyPersonPhone || null,
          verificationSiteImageUrl: input.verificationSiteImageUrl || null,
          verificationProofImageUrl: input.verificationProofImageUrl || null,
      };

      // --- Transactional Update ---
      const updatedBagLift = await db.transaction(async (tx) => {
        
        // --- 5.1. Approving a Pending/New Lift ---
        if (status === 'approved' && currentStatus === 'pending') {
            
            const [masonBeforeCredit] = await tx.select()
                .from(masonPcSide)
                .where(eq(masonPcSide.id, masonId))
                .limit(1);
            
            if (!masonBeforeCredit) {
                tx.rollback();
                throw new Error(`Mason ID ${masonId} not found.`);
            }

            // A. Update Bag Lift Record WITH NEW VERIFICATION FIELDS
            const [updated] = await tx.update(bagLifts)
              .set({
                  status: 'approved',
                  approvedBy: authenticatedUserId,
                  approvedAt: new Date(),
                  // Spread verification fields here
                  ...verificationUpdates
              })
              .where(eq(bagLifts.id, id))
              .returning();
              
            // B. Create Points Ledger (Main Credit)
            await tx.insert(pointsLedger)
                .values({
                    masonId: masonId,
                    sourceType: 'bag_lift',
                    sourceId: updated.id, 
                    points: points, 
                    memo: memo || `Credit for ${updated.bagCount} bags (Base+Bonanza).`,
                })
                .returning();
            
            // C. Update Mason Balance
            await tx.update(masonPcSide)
              .set({
                  pointsBalance: sql`${masonPcSide.pointsBalance} + ${points}`,
                  bagsLifted: sql`${masonPcSide.bagsLifted} + ${updated.bagCount}`,
              })
              .where(eq(masonPcSide.id, masonId));

            // --- D. Extra Bonus Logic ---
            const oldTotalBags = masonBeforeCredit.bagsLifted ?? 0;
            const currentLiftBags = updated.bagCount;
            const extraBonus = calculateExtraBonusPoints(oldTotalBags, currentLiftBags, existingRecord.purchaseDate );

            if (extraBonus > 0) {
                await tx.insert(pointsLedger).values({
                    masonId: masonId,
                    points: extraBonus,
                    sourceType: 'adjustment',
                    memo: `Extra Bonus: ${extraBonus} points for crossing bag slab.`,
                });
                
                await tx.update(masonPcSide)
                    .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${extraBonus}` })
                    .where(eq(masonPcSide.id, masonId));
            }
            
            // --- E. Referral Bonus Logic ---
            if (masonBeforeCredit.referredByUser) {
                const referrerId = masonBeforeCredit.referredByUser;
                const referralPoints = checkReferralBonusTrigger(oldTotalBags, currentLiftBags);

                if (referralPoints > 0) {
                    await tx.insert(pointsLedger).values({
                        masonId: referrerId,
                        points: referralPoints,
                        sourceType: 'referral_bonus', 
                        memo: `Referral bonus for Mason ${masonId} hitting 200 bags.`,
                    });

                    await tx.update(masonPcSide)
                        .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${referralPoints}` })
                        .where(eq(masonPcSide.id, referrerId));
                }
            }

            return updated;
        } 
        
        // 5.2. Rejecting an Approved Lift
        else if (status === 'rejected' && currentStatus === 'approved') {
            
            // A. Update Bag Lift Record
            const [updated] = await tx.update(bagLifts)
                .set({
                    status: 'rejected',
                    // We typically don't update verification fields on rejection,
                    // but if you want to save "Why it was rejected" via memo, that's handled.
                })
                .where(eq(bagLifts.id, id))
                .returning();
            
            // B. Debit Points
            await tx.insert(pointsLedger)
                .values({
                    masonId: masonId,
                    sourceType: 'adjustment', 
                    sourceId: randomUUID(),
                    points: -points, 
                    memo: memo || `Debit: Bag Lift ${id} rejected by User ${authenticatedUserId}.`,
                })
                .returning();
                
            // C. Update Mason Balance
            await tx.update(masonPcSide)
                .set({
                    pointsBalance: sql`${masonPcSide.pointsBalance} - ${points}`,
                    bagsLifted: sql`${masonPcSide.bagsLifted} - ${existingRecord.bagCount!}`, 
                })
                .where(eq(masonPcSide.id, masonId));

            return updated;
        }

        // 5.3. Simple Status Update (Pending -> Rejected)
        else {
            const [updated] = await tx.update(bagLifts)
                .set({ 
                    status: status,
                    // Optional: If they provided verification details even for a rejection (e.g., "Visited site, saw nothing"), save them.
                    ...verificationUpdates
                })
                .where(eq(bagLifts.id, id))
                .returning();
            return updated;
        }
      });

      // 6. Return success
      res.json({
        success: true,
        message: `Bag Lift status updated to '${updatedBagLift.status}' successfully.`,
        data: updatedBagLift,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
      }
      console.error(`PATCH Bag Lift error:`, error);
      return res.status(500).json({
        success: false,
        error: `Failed to update Bag Lift status.`,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  console.log('✅ Bag Lifts PATCH (Approval) endpoint setup complete');
}