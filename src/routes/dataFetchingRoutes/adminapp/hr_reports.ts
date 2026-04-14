// src/routes/dataFetchingRoutes/adminapp/hr_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { hrReports } from "../../../db/schema";
import { desc, isNotNull } from "drizzle-orm";

export default function setupHrReportsGetRoutes(app: Express) {
  const endpoint = "adminapp/hr-reports";

  // ✅ 1. GET Latest Excel Report (For Vacancies Tab)
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(hrReports)
        .where(isNotNull(hrReports.sourceFileName)) // CRITICAL: Ignores user-entered rows
        .orderBy(desc(hrReports.reportDate))
        .limit(1);

      return res.json({ success: true, data: result.length ? result[0] : null });
    } catch (err) {
      console.error("[HR REPORT FETCH ERROR]", err);
      return res.status(500).json({ success: false, error: "Failed to fetch HR report" });
    }
  });

  // ✅ 2. GET All Manual Data (For Interviews & Performers Tabs)
  app.get(`/api/${endpoint}/manual-data`, async (req: Request, res: Response) => {
    try {
      const allReports = await db
        .select({
          interviews: hrReports.interviews,
          topPerformers: hrReports.topPerformers,
          bottomPerformers: hrReports.bottomPerformers,
        })
        .from(hrReports)
        .orderBy(desc(hrReports.createdAt));

      // Aggregate all JSONB arrays from all rows into single flat lists
      const aggregatedInterviews: any[] = [];
      const aggregatedTop: any[] = [];
      const aggregatedBottom: any[] = [];

      allReports.forEach((row) => {
        if (Array.isArray(row.interviews)) aggregatedInterviews.push(...row.interviews);
        if (Array.isArray(row.topPerformers)) aggregatedTop.push(...row.topPerformers);
        if (Array.isArray(row.bottomPerformers)) aggregatedBottom.push(...row.bottomPerformers);
      });

      return res.json({
        success: true,
        data: {
          interviews: aggregatedInterviews,
          topPerformers: aggregatedTop,
          bottomPerformers: aggregatedBottom,
        }
      });
    } catch (err) {
      console.error("[HR MANUAL DATA FETCH ERROR]", err);
      return res.status(500).json({ success: false, error: "Failed to fetch manual data" });
    }
  });

  console.log("✅ HR Reports GET endpoints setup complete");
}