// src/routes/dataFetchingRoutes/adminapp/hr_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { hrReports } from "../../../db/schema";
import { desc } from "drizzle-orm"; // Removed isNotNull

export default function setupHrReportsGetRoutes(app: Express) {
  const endpoint = "adminapp/hr-reports";

  // ✅ 1. GET Latest Excel Report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(hrReports)
        // 🛠️ REMOVED the sourceFileName filter here
        .orderBy(desc(hrReports.reportDate))
        .limit(1);

      return res.json({ success: true, data: result.length ? result[0] : null });
    } catch (err) {
      console.error("[HR REPORT FETCH ERROR]", err);
      return res.status(500).json({ success: false, error: "Failed to fetch HR report" });
    }
  });

  // ✅ 2. GET All Manual Data (Updated to new Schema columns)
  app.get(`/api/${endpoint}/manual-data`, async (req: Request, res: Response) => {
    try {
      const allReports = await db
        .select({
          vacancies: hrReports.vacancies,
          underperformersPlant: hrReports.underperformersPlant,
          underperformersHO: hrReports.underperformersHO,
          statutoryClearances: hrReports.statutoryClearances,
          interviewCandidates: hrReports.interviewCandidates,
        })
        .from(hrReports)
        .orderBy(desc(hrReports.createdAt));

      // Aggregate all JSONB arrays into single flat lists
      const aggregatedVacancies: any[] = [];
      const aggregatedPlant: any[] = [];
      const aggregatedHO: any[] = [];
      const aggregatedClearances: any[] = [];
      const aggregatedInterviews: any[] = [];

      allReports.forEach((row) => {
        if (Array.isArray(row.vacancies)) aggregatedVacancies.push(...row.vacancies);
        if (Array.isArray(row.underperformersPlant)) aggregatedPlant.push(...row.underperformersPlant);
        if (Array.isArray(row.underperformersHO)) aggregatedHO.push(...row.underperformersHO);
        if (Array.isArray(row.statutoryClearances)) aggregatedClearances.push(...row.statutoryClearances);
        if (Array.isArray(row.interviewCandidates)) aggregatedInterviews.push(...row.interviewCandidates);
      });

      return res.json({
        success: true,
        data: {
          vacancies: aggregatedVacancies,
          underperformersPlant: aggregatedPlant,
          underperformersHO: aggregatedHO,
          statutoryClearances: aggregatedClearances,
          interviewCandidates: aggregatedInterviews,
        }
      });
    } catch (err) {
      console.error("[HR MANUAL DATA FETCH ERROR]", err);
      return res.status(500).json({ success: false, error: "Failed to fetch manual data" });
    }
  });

  console.log("✅ HR Reports GET endpoints setup complete");
}
