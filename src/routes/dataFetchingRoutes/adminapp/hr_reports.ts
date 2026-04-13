// src/routes/dataFetchingRoutes/adminapp/hr_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { hrReports } from "../../../db/schema";
import { desc } from "drizzle-orm";

export default function setupHrReportsRoutes(app: Express) {
  const endpoint = "adminapp/hr-reports";

  // ✅ GET latest HR report
  app.get(`/api/${endpoint}/latest`, async (req: Request, res: Response) => {
    try {
      const result = await db
        .select()
        .from(hrReports)
        .orderBy(desc(hrReports.reportDate))
        .limit(1);

      if (!result.length) {
        return res.json({
          success: true,
          data: null,
        });
      }

      return res.json({
        success: true,
        data: result[0],
      });
    } catch (err) {
      console.error("[HR REPORT FETCH ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch HR report",
      });
    }
  });

  console.log("✅ HR Reports GET endpoint setup complete");
}