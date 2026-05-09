// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveFinance.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { financeReports } from "../../../../db/schema";

// Because all sections are just raw JSONB, we accept them as arrays/records
const financeRecordSchema = z.object({
  reportDate: z.string(),
  rawPayload: z.record(z.any()).optional(),
  detectedMonths: z.record(z.any()).optional(),
  plbsStatus: z.array(z.any()).optional(),
  costSheetJSB: z.array(z.any()).optional(),
  costSheetJUD: z.array(z.any()).optional(),
  investorQueries: z.array(z.any()).optional(),
  parserWarnings: z.array(z.any()).optional()
});

const payloadSchema = z.object({ records: z.array(financeRecordSchema) });

export class SaveDashboardFinance {
  public static async save(req: Request, res: Response): Promise<any> {
    try {
      const parsedBody = payloadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid data format", details: parsedBody.error.format() });
      }

      const { records } = parsedBody.data;
      if (records.length === 0) return res.status(400).json({ error: "No records provided." });

      // There will only be 1 record representing the entire sheet
      const payload = records[0];

      // Format Date
      const dateString = payload.reportDate.split('T')[0];

      const recordToInsert = {
         reportDate: dateString,
         rawPayload: payload.rawPayload || {},
         detectedMonths: payload.detectedMonths || {},
         plbsStatus: payload.plbsStatus || [],
         costSheetJSB: payload.costSheetJSB || [],
         costSheetJUD: payload.costSheetJUD || [],
         investorQueries: payload.investorQueries || [],
         parserWarnings: payload.parserWarnings || [],
      };

      // 3. Clear Existing Data entirely to prevent DB bloat
      await db.delete(financeReports);

      // Insert the massive unified JSONB row
      const insertedData = await db.insert(financeReports)
        .values(recordToInsert)
        .returning({ id: financeReports.id });

      return res.json({
        success: true,
        message: `Successfully saved Finance Dashboard for ${dateString}.`,
        insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE FINANCE REPORTS ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save finance reports" });
    }
  }
}

export default function setupSaveFinanceRoute(app: Express) {
  app.post("/api/excel/finance/save", verifyDashboardJWT, SaveDashboardFinance.save);
}