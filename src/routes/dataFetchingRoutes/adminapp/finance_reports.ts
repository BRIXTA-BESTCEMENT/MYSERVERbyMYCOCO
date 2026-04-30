// server/src/routes/dataFetchingRoutes/adminapp/finance_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { financeReports } from "../../../db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export default function setupFinanceReportsGetRoutes(app: Express) {
  const endpoint = "finance-reports";

  // ✅ 1. GET Latest Finance Report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(financeReports)
        .orderBy(desc(financeReports.reportDate))
        .limit(1);

      return res.json({
        success: true,
        data: result.length > 0 ? result[0] : null,
      });
    } catch (err) {
      console.error("[FINANCE REPORTS LATEST ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch latest finance report",
      });
    }
  });

  // ✅ 2. GET All Finance Reports
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { reportDate, fromDate, toDate } = req.query as {
        reportDate?: string;
        fromDate?: string;
        toDate?: string;
      };

      const conditions = [];

      if (reportDate) conditions.push(eq(financeReports.reportDate, reportDate));
      if (fromDate) conditions.push(gte(financeReports.reportDate, fromDate));
      if (toDate) conditions.push(lte(financeReports.reportDate, toDate));

      const reports = await db
        .select()
        .from(financeReports)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(financeReports.reportDate));

      return res.json({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (err) {
      console.error("[FINANCE REPORTS ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch finance reports",
      });
    }
  });

  console.log("✅ Finance Reports GET endpoints setup complete");
}