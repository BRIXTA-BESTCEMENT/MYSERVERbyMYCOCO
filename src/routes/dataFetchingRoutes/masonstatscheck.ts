import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { bagLifts, masonPcSide } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

// ----------------------------------------------------------------------
// GET /api/mason-stats
// Query Params: ?masonId=... & ?siteId=...
// Returns: { success: true, overall: number, site: number }
// ----------------------------------------------------------------------
export default function setupMasonStatsRoute(app: Express) {
  
  app.get('/api/mason-stats', async (req: Request, res: Response) => {
    try {
      const { masonId, siteId } = req.query;

      if (!masonId || !siteId) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required query parameters: masonId and siteId" 
        });
      }

      // --- CHECK 1: Mason's Overall Bags (Limit: 800) ---
      // We look at the 'masonPcSide' table for the running total
      const [masonRecord] = await db
        .select({
          totalLifted: masonPcSide.bagsLifted
        })
        .from(masonPcSide)
        .where(eq(masonPcSide.id, String(masonId)))
        .limit(1);

      // Default to 0 if null
      const overallBags = masonRecord?.totalLifted || 0;


      // --- CHECK 2: Site's Total Approved Bags (Limit: 600) ---
      // We calculate this live by summing 'bag_lifts' where status = 'approved'
      const [siteStats] = await db
        .select({
          siteTotal: sql<number>`sum(${bagLifts.bagCount})`
        })
        .from(bagLifts)
        .where(
          and(
            eq(bagLifts.siteId, String(siteId)),
            eq(bagLifts.status, 'approved') // Only count APPROVED bags
          )
        );

      // Cast to number (Postgres sum can return string)
      const siteBags = Number(siteStats?.siteTotal || 0);

      // --- SEND RESPONSE ---
      res.json({
        success: true,
        overall: overallBags,  // Checked against 800 in Flutter
        site: siteBags         // Checked against 600 in Flutter
      });

    } catch (error) {
      console.error("Error fetching mason stats:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to calculate stats",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  console.log('✅ Mason Stats Check Endpoint setup complete');
}