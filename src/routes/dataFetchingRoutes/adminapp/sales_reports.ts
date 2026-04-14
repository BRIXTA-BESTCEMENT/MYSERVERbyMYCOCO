// src/routes/dataFetchingRoutes/adminapp/sales_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { salesReports } from "../../../db/schema";
import { desc, isNotNull } from "drizzle-orm";

export default function setupSalesReportsGetRoutes(app: Express) {
  const endpoint = "adminapp/sales-reports";

  // 1. GET Latest Automated Excel Data (Sales & Collections)
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      // 1A. Find the absolute latest row (usually Sales)
      const [latestRow] = await db
        .select()
        .from(salesReports)
        .where(isNotNull(salesReports.sourceFileName)) // Ignores manual entries
        .orderBy(desc(salesReports.reportDate))
        .limit(1);

      if (!latestRow) {
        return res.json({ success: true, data: null });
      }

      // 1B. Scan the last 10 reports to find the most recent Collection data
      const recentRows = await db
        .select()
        .from(salesReports)
        .where(isNotNull(salesReports.sourceFileName))
        .orderBy(desc(salesReports.reportDate))
        .limit(10); 

      let bestCollectionData: any[] = [];
      for (const row of recentRows) {
        const cols = row.collectionDataPayload as any[];
        if (cols && cols.length > 0) {
          bestCollectionData = cols;
          break; // Stop looking once we find the most recent non-empty collections
        }
      }

      // 1C. Merge them into a single response
      const mergedResponse = {
         id: latestRow.id,
         reportDate: latestRow.reportDate,
         salesDataPayload: latestRow.salesDataPayload || [],
         collectionDataPayload: bestCollectionData,
      };

      return res.json({ success: true, data: mergedResponse });
    } catch (err) {
      console.error("[SALES REPORT FETCH ERROR]", err);
      return res.status(500).json({ success: false, error: "Failed to fetch Sales report" });
    }
  });

  // 2. GET All Manual Data (Non-Trade Approvals)
  app.get(`/api/${endpoint}/manual-data`, async (req: Request, res: Response) => {
    try {
      const allReports = await db
        .select({
          nonTrade: salesReports.nonTradeDataPayload,
        })
        .from(salesReports)
        .orderBy(desc(salesReports.createdAt));

      const aggregatedNonTrade: any[] = [];

      allReports.forEach((row) => {
        if (Array.isArray(row.nonTrade)) aggregatedNonTrade.push(...row.nonTrade);
      });

      return res.json({
        success: true,
        data: {
          nonTradeApprovals: aggregatedNonTrade,
        }
      });
    } catch (err) {
      console.error("[SALES MANUAL DATA FETCH ERROR]", err);
      return res.status(500).json({ success: false, error: "Failed to fetch manual sales data" });
    }
  });

  console.log("✅ Sales Reports GET endpoints setup complete");
}