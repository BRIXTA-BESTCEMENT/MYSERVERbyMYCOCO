// server/src/routes/updateRoutes/rewardsRedemption.ts
// Reward Redemption PATCH endpoint (NO AUTH - PUBLIC)

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { 
  rewardRedemptions, 
  masonPcSide, 
  pointsLedger, 
  rewards 
} from '../../db/schema'; 
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

// REMOVED: import { requireAuth } ...
// REMOVED: import { tsoAuth } ...

const redemptionFulfillmentSchema = z.object({
  status: z.enum(['approved', 'shipped', 'delivered', 'rejected']),
  fulfillmentNotes: z.string().max(500).optional().nullable(),
}).strict();

export default function setupRewardsRedemptionPatchRoute(app: Express) {
  
  // NO MIDDLEWARE - Direct access
  app.patch('/api/rewards-redemption/:id', async (req: Request, res: Response) => {
    const tableName = 'Reward Redemption';
    
    try {
      const { id } = req.params;

      // REMOVED: Auth checks and req.auth.sub extraction
      
      // Validate UUID
      if (!z.string().uuid().safeParse(id).success) {
        return res.status(400).json({ success: false, error: 'Invalid Redemption ID format. Expected UUID.' });
      }
      
      // 2. Validate input body
      const input = redemptionFulfillmentSchema.parse(req.body);
      const { status, fulfillmentNotes } = input;
      
      // 3. Fetch existing record to check current state
      const [existingRecord] = await db.select()
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, id))
        .limit(1);

      if (!existingRecord) {
        return res.status(404).json({ error: `${tableName} with ID '${id}' not found.` });
      }
      
      const currentStatus = existingRecord.status;
      const { masonId, pointsDebited: points, quantity: qty, rewardId } = existingRecord;

      // Flow Logic Checks
      if (currentStatus === 'delivered' && status !== 'delivered') {
         return res.status(400).json({ success: false, error: 'Cannot change status of an already delivered item.' });
      }
      if (currentStatus === 'rejected') {
         return res.status(400).json({ success: false, error: 'Cannot update a rejected order. Please place a new order.' });
      }

      // --- 4. CORE FINANCIAL & INVENTORY TRANSACTION ---
      const updatedRecord = await db.transaction(async (tx) => {
          
          // ==================================================================
          // SCENARIO A: APPROVING (Placed -> Approved)
          // Action: DEDUCT STOCK. (Points were already deducted on creation)
          // ==================================================================
          if (currentStatus === 'placed' && status === 'approved') {
              
              // Check Stock
              const [item] = await tx.select({ stock: rewards.stock })
                                     .from(rewards)
                                     .where(eq(rewards.id, rewardId));
                                     
              if (!item || item.stock < qty) {
                   throw new Error(`Insufficient stock to approve. Available: ${item?.stock ?? 0}, Required: ${qty}`);
              }

              // Deduct Stock
              await tx.update(rewards)
                  .set({ stock: sql`${rewards.stock} - ${qty}` })
                  .where(eq(rewards.id, rewardId));

              // Update Status
              const [updated] = await tx.update(rewardRedemptions)
                  .set({ 
                      status: 'approved', 
                      updatedAt: new Date() 
                  })
                  .where(eq(rewardRedemptions.id, id))
                  .returning();
              
              return updated;
          } 
          
          // ==================================================================
          // SCENARIO B: REJECTING (Placed -> Rejected)
          // Action: REFUND POINTS (Stock was never taken)
          // ==================================================================
          else if (currentStatus === 'placed' && status === 'rejected') {
              
              // Refund Points Logic
              await tx.insert(pointsLedger).values({
                  id: crypto.randomUUID(), 
                  masonId: masonId,
                  sourceType: 'adjustment', // or 'refund'
                  sourceId: id, // Link back to the order
                  points: points, // Positive value adds back to balance
                  memo: `Refund: Order ${id} rejected by TSO. Reason: ${fulfillmentNotes || 'N/A'}`,
              });

              // Add to Balance
              await tx.update(masonPcSide)
                  .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${points}` })
                  .where(eq(masonPcSide.id, masonId));

              // Update Status
              const [updated] = await tx.update(rewardRedemptions)
                  .set({ status: 'rejected', updatedAt: new Date() })
                  .where(eq(rewardRedemptions.id, id))
                  .returning();

              return updated;
          }

          // ==================================================================
          // SCENARIO C: REJECTING (Approved -> Rejected)
          // Action: REFUND POINTS + RETURN STOCK
          // ==================================================================
          else if (currentStatus === 'approved' && status === 'rejected') {
              
              // Refund Points
              await tx.insert(pointsLedger).values({
                  id: crypto.randomUUID(),
                  masonId: masonId,
                  sourceType: 'adjustment',
                  sourceId: id,
                  points: points, 
                  memo: `Refund: Approved Order ${id} cancelled.`,
              });

              await tx.update(masonPcSide)
                  .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${points}` })
                  .where(eq(masonPcSide.id, masonId));

              // Return Stock
              await tx.update(rewards)
                  .set({ stock: sql`${rewards.stock} + ${qty}` })
                  .where(eq(rewards.id, rewardId));

              // Update Status
              const [updated] = await tx.update(rewardRedemptions)
                  .set({ status: 'rejected', updatedAt: new Date() })
                  .where(eq(rewardRedemptions.id, id))
                  .returning();

              return updated;
          }
          
          // ==================================================================
          // SCENARIO D: FULFILLMENT (Approved -> Shipped -> Delivered)
          // Action: Just update status. No financial/stock changes needed.
          // ==================================================================
          else {
              const [updated] = await tx.update(rewardRedemptions)
                  .set({ status: status, updatedAt: new Date() })
                  .where(eq(rewardRedemptions.id, id))
                  .returning();
              return updated;
          }
      });
      
      res.json({
        success: true,
        message: `Status updated to '${updatedRecord.status}'.`,
        data: updatedRecord,
      });

    } catch (error: any) {
      // Handle Zod Errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
      }
      
      console.error(`PATCH ${tableName} error:`, error);
      
      // Handle Business Logic Errors
      const msg = (error as Error)?.message ?? '';
      if (msg.includes('Insufficient') || msg.includes('Cannot change')) {
         return res.status(400).json({ success: false, error: msg });
      }
      
      return res.status(500).json({
        success: false,
        error: `Failed to update ${tableName} status.`,
      });
    }
  });

  console.log('✅ Reward Redemptions PATCH (NO AUTH) endpoint ready');
}