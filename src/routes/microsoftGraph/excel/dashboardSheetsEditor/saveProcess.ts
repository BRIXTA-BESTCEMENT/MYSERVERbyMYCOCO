// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveProcess.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { processReports } from "../../../../db/schema";

const processRecordSchema = z.object({
  reportDate: z.string(),
  rawPayload: z.record(z.any()).optional(),
  dailyStatusReports: z.any().optional(),
  closingStock: z.any().optional(),
  coalConsumption: z.any().optional(),
  targetAchievement: z.any().optional(),
  parserWarnings: z.array(z.any()).optional()
});

const payloadSchema = z.object({ records: z.array(processRecordSchema) });

export class SaveDashboardProcess {
  public static async save(req: Request, res: Response): Promise<any> {
    try {
      const parsedBody = payloadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid data format", details: parsedBody.error.format() });
      }

      const { records } = parsedBody.data;
      if (records.length === 0) return res.status(400).json({ error: "No records provided." });

      const payload = records[0];
      const dateString = payload.reportDate.split('T')[0];

      const recordToInsert = {
         reportDate: dateString,
         rawPayload: payload.rawPayload || {},
         dailyStatusReports: payload.dailyStatusReports || [],
         closingStock: payload.closingStock || [],
         coalConsumption: payload.coalConsumption || [],
         targetAchievement: payload.targetAchievement || [],
         parserWarnings: payload.parserWarnings || [],
      };

      // 3. Clear Existing Data entirely to prevent DB bloat
      await db.delete(processReports);

      const insertedData = await db.insert(processReports)
        .values(recordToInsert)
        .returning({ id: processReports.id });

      return res.json({
        success: true,
        message: `Successfully saved Process & Quality Report for ${dateString}.`,
        insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE PROCESS ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save process reports" });
    }
  }
}

export default function setupSaveProcessRoute(app: Express) {
  app.post("/api/excel/process/save", verifyDashboardJWT, SaveDashboardProcess.save);
}