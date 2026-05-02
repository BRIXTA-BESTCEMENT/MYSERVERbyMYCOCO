// server/src/routes/dataFetchingRoutes/adminapp/process_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { processReports } from "../../../db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export default function setupProcessReportsGetRoutes(app: Express) {
  const endpoint = "process-reports";

  // ✅ 1. GET Latest Process Report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(processReports)
        .orderBy(desc(processReports.reportDate))
        .limit(1);

      return res.json({
        success: true,
        data: result.length > 0 ? result[0] : null,
      });
    } catch (err) {
      console.error("[PROCESS REPORTS LATEST ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch latest process report",
      });
    }
  });

  // ✅ 2. GET All Process Reports
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { reportDate, fromDate, toDate } = req.query as {
        reportDate?: string;
        fromDate?: string;
        toDate?: string;
      };

      const conditions = [];

      if (reportDate) conditions.push(eq(processReports.reportDate, reportDate));
      if (fromDate) conditions.push(gte(processReports.reportDate, fromDate));
      if (toDate) conditions.push(lte(processReports.reportDate, toDate));

      const reports = await db
        .select()
        .from(processReports)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(processReports.reportDate));

      return res.json({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (err) {
      console.error("[PROCESS REPORTS ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch process reports",
      });
    }
  });

  console.log("✅ Process Reports GET endpoints setup complete");
}