// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveLogistics.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { logisticsReports } from "../../../../db/schema";

const logisticsRecordSchema = z.object({
  reportDate: z.string(),
  rawPayload: z.record(z.any()).optional(),
  cementDispatchData: z.any().optional(),
  rawMaterialStockData: z.any().optional(),
  transporterPaymentData: z.any().optional(),
  parserWarnings: z.array(z.any()).optional()
});

const payloadSchema = z.object({ records: z.array(logisticsRecordSchema) });

export class SaveDashboardLogistics {
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
         cementDispatchData: payload.cementDispatchData || [],
         rawMaterialStockData: payload.rawMaterialStockData || [],
         transporterPaymentData: payload.transporterPaymentData || [],
         parserWarnings: payload.parserWarnings || [],
      };

      // 3. Clear Existing Data entirely to prevent DB bloat
      await db.delete(logisticsReports);

      const insertedData = await db.insert(logisticsReports)
        .values(recordToInsert)
        .returning({ id: logisticsReports.id });

      return res.json({
        success: true,
        message: `Successfully saved Logistics Report for ${dateString}.`,
        insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE LOGISTICS ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save logistics reports" });
    }
  }
}

export default function setupSaveLogisticsRoute(app: Express) {
  app.post("/api/excel/logistics/save", verifyDashboardJWT, SaveDashboardLogistics.save);
}