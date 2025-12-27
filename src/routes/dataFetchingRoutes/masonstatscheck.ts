import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { bagLifts, masonPcSide } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

export default function setupMasonStatsRoute(app: Express) {
  
  app.get('/api/mason-stats', async (req: Request, res: Response) => {
    try {
      const { masonId, siteId } = req.query;

      // Validate inputs
      if (!masonId || !siteId) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required query parameters: masonId and siteId" 
        });
      }

      // --- CHECK 1: Mason's Overall Bags ---
      const [masonRecord] = await db
        .select({ totalLifted: masonPcSide.bagsLifted })
        .from(masonPcSide)
        .where(eq(masonPcSide.id, String(masonId)))
        .limit(1);

      const overallBags = masonRecord?.totalLifted || 0;

      // --- CHECK 2: Site's Total Approved Bags ---
      const [siteStats] = await db
        .select({ siteTotal: sql<number>`sum(${bagLifts.bagCount})` })
        .from(bagLifts)
        .where(
          and(
            eq(bagLifts.siteId, String(siteId)),
            eq(bagLifts.status, 'approved') 
          )
        );

      const siteBags = Number(siteStats?.siteTotal || 0);

      // ⚠️ FIX: Wrap the response in 'data' to satisfy Flutter ApiService
      res.json({
        success: true,
        data: {            // <--- ADDED THIS WRAPPER
          overall: overallBags, 
          site: siteBags
        }
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