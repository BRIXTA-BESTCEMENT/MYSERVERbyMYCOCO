// server/src/routes/updateRoutes/bagsLift.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { bagLifts, pointsLedger, masonPcSide } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// --- IMPORT CORE CALCULATION LOGIC ---
import { calculateBaseAndBonanzaPoints, calculateExtraBonusPoints, checkReferralBonusTrigger } from '../../utils/pointsCalcLogic';
import { tsoAuth } from '../../middleware/tsoAuth';

interface CustomRequest extends Request {
    auth?: { sub: string; role: string; phone: string; kyc: string; };
}

// Input Schema
const bagLiftApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  memo: z.string().max(500).optional(),
  
  // Optional Corrections
  bagCount: z.number().int().positive().optional(),
  purchaseDate: z.string().transform(str => new Date(str)).optional(),
  imageUrl: z.string().url().optional(),

  // Verification Fields
  dealerId: z.string().optional().nullable().or(z.literal("")), 
  siteId: z.string().optional().nullable().or(z.literal("")), 
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
      const authenticatedUserId = parseInt(req.auth!.sub, 10);
      
      const input = bagLiftApprovalSchema.parse(req.body);
      const { status, memo } = input;

      // 1. Find existing record
      const [existingRecord] = await db.select().from(bagLifts).where(eq(bagLifts.id, id)).limit(1);
      if (!existingRecord) return res.status(404).json({ error: `${tableName} with ID '${id}' not found.` });
      
      const currentStatus = existingRecord.status;
      const masonId = existingRecord.masonId;

      // 2. Determine Final Data (Use input if provided, else existing)
      const finalBagCount = input.bagCount ?? existingRecord.bagCount;
      const finalPurchaseDate = input.purchaseDate ?? existingRecord.purchaseDate;
      
      // 3. RE-CALCULATE POINTS
      const recalculatedPoints = calculateBaseAndBonanzaPoints(finalBagCount, finalPurchaseDate);

      // 4. Prepare Updates
      const updates: any = {
          status: status,
          bagCount: finalBagCount,
          purchaseDate: finalPurchaseDate,
          pointsCredited: recalculatedPoints,
      };
      
      // Map optional fields
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;
      if (input.dealerId !== undefined) updates.dealerId = (input.dealerId && input.dealerId.length > 0) ? input.dealerId : null;
      if (input.siteId !== undefined) updates.siteId = (input.siteId && input.siteId.length > 0) ? input.siteId : null;
      if (input.siteKeyPersonName !== undefined) updates.siteKeyPersonName = input.siteKeyPersonName;
      if (input.siteKeyPersonPhone !== undefined) updates.siteKeyPersonPhone = input.siteKeyPersonPhone;
      if (input.verificationSiteImageUrl !== undefined) updates.verificationSiteImageUrl = input.verificationSiteImageUrl;
      if (input.verificationProofImageUrl !== undefined) updates.verificationProofImageUrl = input.verificationProofImageUrl;

      if (status === 'approved') {
          updates.approvedBy = authenticatedUserId;
          updates.approvedAt = new Date();
      }

      // 5. Transaction
      const updatedBagLift = await db.transaction(async (tx) => {
        
        // A. Update Bag Lift Record
        const [updated] = await tx.update(bagLifts)
          .set(updates)
          .where(eq(bagLifts.id, id))
          .returning();

        // --- LOGIC FOR APPROVAL (Pending -> Approved) ---
        if (status === 'approved' && currentStatus !== 'approved') {
            
            // 1. Credit Mason Balance
            await tx.update(masonPcSide)
              .set({
                  pointsBalance: sql`${masonPcSide.pointsBalance} + ${recalculatedPoints}`,
                  bagsLifted: sql`${masonPcSide.bagsLifted} + ${finalBagCount}`,
              })
              .where(eq(masonPcSide.id, masonId));

            // 2. Create Ledger Entry (Main Credit)
            await tx.insert(pointsLedger).values({
                id: randomUUID(),
                masonId: masonId,
                sourceType: 'bag_lift',
                sourceId: updated.id, // Links to BagLift ID
                points: recalculatedPoints, 
                memo: memo || `Credit for ${finalBagCount} bags (Approved by TSO).`,
            });

            // 3. Get Mason state for Bonus Checks
            const [masonState] = await tx.select({ 
                bagsLifted: masonPcSide.bagsLifted, 
                referredByUser: masonPcSide.referredByUser 
            }).from(masonPcSide).where(eq(masonPcSide.id, masonId)).limit(1);

            if (masonState) {
                // The bagsLifted fetched above INCLUDES the current lift because we just updated it.
                // We need the "old" total to check if a slab was crossed.
                const currentTotal = masonState.bagsLifted ?? 0;
                const previousTotal = currentTotal - finalBagCount;

                // 4. Extra Bonus (Slab)
                const extraBonus = calculateExtraBonusPoints(previousTotal, finalBagCount, finalPurchaseDate);
                
                if (extraBonus > 0) {
                    await tx.insert(pointsLedger).values({
                        id: randomUUID(),
                        masonId: masonId,
                        points: extraBonus,
                        sourceType: 'adjustment', // Or 'bonus'
                        sourceId: null, // Cannot link to BagLift ID again (unique constraint). Use Null or random UUID.
                        memo: `Extra Bonus: Slab Crossed via BagLift ${updated.id}.`,
                    });
                    await tx.update(masonPcSide).set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${extraBonus}` }).where(eq(masonPcSide.id, masonId));
                }
                
                // 5. Referral Bonus
                if (masonState.referredByUser) {
                    const referrerId = masonState.referredByUser;
                    const referralPoints = checkReferralBonusTrigger(previousTotal, finalBagCount);
                    
                    if (referralPoints > 0) {
                        await tx.insert(pointsLedger).values({
                            id: randomUUID(),
                            masonId: referrerId,
                            points: referralPoints,
                            sourceType: 'referral_bonus',
                            sourceId: null,
                            memo: `Referral bonus for Mason ${masonId}.`,
                        });
                        await tx.update(masonPcSide).set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${referralPoints}` }).where(eq(masonPcSide.id, referrerId));
                    }
                }
            }
        } 
        
        // --- LOGIC FOR REJECTION (Approved -> Rejected) ---
        else if (status === 'rejected' && currentStatus === 'approved') {
             const pointsToDebit = existingRecord.pointsCredited!; // Debit original amount
             
             await tx.update(masonPcSide)
                .set({
                    pointsBalance: sql`${masonPcSide.pointsBalance} - ${pointsToDebit}`,
                    bagsLifted: sql`${masonPcSide.bagsLifted} - ${existingRecord.bagCount}`, 
                })
                .where(eq(masonPcSide.id, masonId));
                
             await tx.insert(pointsLedger).values({
                id: randomUUID(),
                masonId: masonId,
                sourceType: 'adjustment',
                sourceId: null,
                points: -pointsToDebit, // Negative
                memo: memo || `Debit: Bag Lift ${id} rejected after approval.`
             });
        }

        return updated;
      });

      res.json({ success: true, message: 'Updated successfully.', data: updatedBagLift });

    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
      console.error(`PATCH Bag Lift error:`, error);
      res.status(500).json({ success: false, error: `Failed to update.`, details: error.message });
    }
  });
  console.log('✅ Bag Lifts PATCH (Full Transactional Logic) endpoint ready');
}