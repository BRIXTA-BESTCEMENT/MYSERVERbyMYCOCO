// server/src/routes/dataFetchingRoutes/adminapp/purchase_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { purchaseReports } from "../../../db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export default function setupPurchaseReportsGetRoutes(app: Express) {
  const endpoint = "purchase-reports";

  // ✅ 1. GET Latest Purchase Report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(purchaseReports)
        .orderBy(desc(purchaseReports.reportDate))
        .limit(1);

      return res.json({
        success: true,
        data: result.length > 0 ? result[0] : null,
      });
    } catch (err) {
      console.error("[PURCHASE REPORTS LATEST ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch latest purchase report",
      });
    }
  });

  // ✅ 2. GET All Purchase Reports
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { reportDate, fromDate, toDate } = req.query as {
        reportDate?: string;
        fromDate?: string;
        toDate?: string;
      };

      const conditions = [];

      if (reportDate) conditions.push(eq(purchaseReports.reportDate, reportDate));
      if (fromDate) conditions.push(gte(purchaseReports.reportDate, fromDate));
      if (toDate) conditions.push(lte(purchaseReports.reportDate, toDate));

      const reports = await db
        .select()
        .from(purchaseReports)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(purchaseReports.reportDate));

      return res.json({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (err) {
      console.error("[PURCHASE REPORTS ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch purchase reports",
      });
    }
  });

  console.log("✅ Purchase Reports GET endpoints setup complete");
}