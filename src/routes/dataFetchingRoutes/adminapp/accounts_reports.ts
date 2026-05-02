// server/src/routes/dataFetchingRoutes/adminapp/accounts_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { accountsReports } from "../../../db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export default function setupAccountsReportsGetRoutes(app: Express) {
  const endpoint = "accounts-reports";

  // ✅ 1. GET Latest Accounts Report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(accountsReports)
        .orderBy(desc(accountsReports.reportDate))
        .limit(1);

      return res.json({
        success: true,
        data: result.length > 0 ? result[0] : null,
      });
    } catch (err) {
      console.error("[ACCOUNTS REPORTS LATEST ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch latest accounts report",
      });
    }
  });

  // ✅ 2. GET All Accounts Reports
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { reportDate, fromDate, toDate } = req.query as {
        reportDate?: string;
        fromDate?: string;
        toDate?: string;
      };

      const conditions = [];

      if (reportDate) conditions.push(eq(accountsReports.reportDate, reportDate));
      if (fromDate) conditions.push(gte(accountsReports.reportDate, fromDate));
      if (toDate) conditions.push(lte(accountsReports.reportDate, toDate));

      const reports = await db
        .select()
        .from(accountsReports)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(accountsReports.reportDate));

      return res.json({
        success: true,
        count: reports.length,
        data: reports,
      });
    } catch (err) {
      console.error("[ACCOUNTS REPORTS ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch accounts reports",
      });
    }
  });

  console.log("✅ Accounts Reports GET endpoints setup complete");
}