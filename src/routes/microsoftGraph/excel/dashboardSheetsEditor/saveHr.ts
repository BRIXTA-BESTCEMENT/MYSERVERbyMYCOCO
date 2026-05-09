// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveHr.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { hrReports } from "../../../../db/schema";

const hrRecordSchema = z.object({
  reportDate: z.string(),
  rawPayload: z.record(z.any()).optional(),
  vacancies: z.any().optional(),
  underperformersPlant: z.any().optional(),
  underperformersHO: z.any().optional(),
  statutoryClearances: z.any().optional(),
  interviewCandidates: z.any().optional(),
});

const payloadSchema = z.object({ records: z.array(hrRecordSchema) });

export class SaveDashboardHR {
  public static async save(req: Request, res: Response): Promise<any> {
    try {
      const parsedBody = payloadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid data format", details: parsedBody.error.format() });
      }

      const { records } = parsedBody.data;
      if (records.length === 0) return res.status(400).json({ error: "No records provided." });

      // HR Dashboard will be sent as a single unified daily record
      const payload = records[0];
      const dateString = payload.reportDate.split('T')[0];

      const recordToInsert = {
         reportDate: dateString,
         rawPayload: payload.rawPayload || {},
         vacancies: payload.vacancies || [],
         underperformersPlant: payload.underperformersPlant || [],
         underperformersHO: payload.underperformersHO || [],
         statutoryClearances: payload.statutoryClearances || [],
         interviewCandidates: payload.interviewCandidates || [],
      };

      // 3. Clear Existing Data entirely to prevent DB bloat
      await db.delete(hrReports);

      // Insert the new daily snapshot
      const insertedData = await db.insert(hrReports)
        .values(recordToInsert)
        .returning({ id: hrReports.id });

      return res.json({
        success: true,
        message: `Successfully saved HR Dashboard for ${dateString}.`,
        insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE HR ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save HR reports" });
    }
  }
}

export default function setupSaveHrRoute(app: Express) {
  app.post("/api/excel/hr/save", verifyDashboardJWT, SaveDashboardHR.save);
}