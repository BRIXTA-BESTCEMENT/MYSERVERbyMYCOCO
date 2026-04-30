// server/src/routes/dataFetchingRoutes/adminapp/logistics_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { logisticsReports } from "../../../db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export default function setupLogisticsReportsGetRoutes(app: Express) {
  const endpoint = "logistics-reports";

  // ✅ 1. GET Latest Logistics Report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(logisticsReports)
        .orderBy(desc(logisticsReports.reportDate))
        .limit(1);

      return res.json({
        success: true,
        data: result.length > 0 ? result[0] : null,
      });
    } catch (err) {
      console.error("[LOGISTICS REPORTS LATEST ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch latest logistics report",
      });
    }
  });

  // ✅ 2. GET All Logistics Reports
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { reportDate, fromDate, toDate } = req.query as {
        reportDate?: string;
        fromDate?: string;
        toDate?: string;
      };

      const conditions = [];

      if (reportDate) conditions.push(eq(logisticsReports.reportDate, reportDate));
      if (fromDate) conditions.push(gte(logisticsReports.reportDate, fromDate));
      if (toDate) conditions.push(lte(logisticsReports.reportDate, toDate));

      const reports = await db
        .select()
        .from(logisticsReports)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(logisticsReports.reportDate));

      return res.json({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (err) {
      console.error("[LOGISTICS REPORTS ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch logistics reports",
      });
    }
  });

  console.log("✅ Logistics Reports GET endpoints setup complete");
}