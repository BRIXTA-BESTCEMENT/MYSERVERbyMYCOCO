// src/routes/microsoftGraph/excel/dashboardSheetsEditor/savePurchase.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { purchaseReports } from "../../../../db/schema";

const purchaseRecordSchema = z.object({
  reportDate: z.string(),
  rawPayload: z.record(z.any()).optional(),
  dailyMaterials: z.any().optional(),
  monthlyImportantMaterials: z.any().optional(),
  reportStatus: z.any().optional(),
  parserWarnings: z.array(z.any()).optional()
});

const payloadSchema = z.object({ records: z.array(purchaseRecordSchema) });

export class SaveDashboardPurchase {
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
         dailyMaterials: payload.dailyMaterials || [],
         monthlyImportantMaterials: payload.monthlyImportantMaterials || [],
         reportStatus: payload.reportStatus || [],
         parserWarnings: payload.parserWarnings || [],
      };

      // 3. Clear Existing Data entirely to prevent DB bloat
      await db.delete(purchaseReports);

      const insertedData = await db.insert(purchaseReports)
        .values(recordToInsert)
        .returning({ id: purchaseReports.id });

      return res.json({
        success: true,
        message: `Successfully saved Purchase Report for ${dateString}.`,
        insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE PURCHASE ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save purchase reports" });
    }
  }
}

export default function setupSavePurchaseRoute(app: Express) {
  app.post("/api/excel/purchase/save", verifyDashboardJWT, SaveDashboardPurchase.save);
}