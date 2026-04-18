// server/src/workers/autoApprove.ts
import cron from 'node-cron';
import { db } from '../db/db';
import { dailyTasks } from '../db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

export function setupAutoApproveCron() {
  // CRON EXPLANATION:
  // 0 -> Minute (0)
  // 3 -> Hour (3 AM)
  // * -> Day of Month (Every)
  // * -> Month (Every)
  // 1 -> Day of Week (Monday)
  cron.schedule('0 3 * * 1', async () => {
    console.log('⏳ Running Weekly Monday 3 AM auto-approve check for Daily Tasks...');
    
    try {
      await db
        .update(dailyTasks)
        .set({ 
            status: 'Approved',
            updatedAt: new Date()
        })
        .where(
          and(
            // Use 'Assigned' or 'Pending' based on your actual initial status
            eq(dailyTasks.status, 'Pending'), 
            // Approves tasks older than 24 hours
            lte(dailyTasks.createdAt, sql`NOW() - INTERVAL '24 hours'`) 
          )
        );

      console.log(`✅ Weekly auto-approve cycle complete.`);
    } catch (error) {
      console.error('❌ Error in auto-approve cron job:', error);
    }
  });

  console.log('✅ Weekly Monday 3 AM Auto-Approve Worker initialized.');
}