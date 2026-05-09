// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveAccounts.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { accountsReports } from "../../../../db/schema";

const looseNumberSchema = z.union([z.string(), z.number()]).nullable().optional();

const accountsRecordSchema = z.object({
  reportDate: z.string(),
  rawPayload: z.record(z.any()).optional(),
  
  // 🛠️ Strict mappings
  collectionTargetLakhs: looseNumberSchema,
  collectionAchievementLakhs: looseNumberSchema,
  spendTargetLakhs: looseNumberSchema,
  spendAchievementLakhs: looseNumberSchema,
  pettyCashBalanceLakhs: looseNumberSchema,
  billsPendingLakhs: looseNumberSchema,
  tenDaysCashReqCr: looseNumberSchema,
  expectedInflowSalesCr: looseNumberSchema,
  cmdPaymentDueLakhs: looseNumberSchema,
  cashBookStatusJUD: z.string().nullable().optional(),
  cashBookStatusJSB: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),

  parserWarnings: z.array(z.any()).optional()
});

const payloadSchema = z.object({ records: z.array(accountsRecordSchema) });

export class SaveDashboardAccounts {
  public static async save(req: Request, res: Response): Promise<any> {
    try {
      const parsedBody = payloadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid data format", details: parsedBody.error.format() });
      }

      const { records } = parsedBody.data;
      if (records.length === 0) return res.status(400).json({ error: "No records provided." });

      const formattedRecords = [];

      for (const record of records) {
        if (!record.reportDate) continue;

        const dateString = record.reportDate.split('T')[0];

        const cleanNumeric = (val: any) => {
          if (val === null || val === undefined) return null;
          let str = String(val).replace(/[,%]/g, '').trim();
          if (/^[-–—−]+$/.test(str) || str === '') return null;
          str = str.replace(/^[–—−]/, '-');
          if (isNaN(Number(str))) return null;
          return str;
        };

        formattedRecords.push({
          reportDate: dateString,
          rawPayload: record.rawPayload || {},
          
          collectionTargetLakhs: cleanNumeric(record.collectionTargetLakhs),
          collectionAchievementLakhs: cleanNumeric(record.collectionAchievementLakhs),
          spendTargetLakhs: cleanNumeric(record.spendTargetLakhs),
          spendAchievementLakhs: cleanNumeric(record.spendAchievementLakhs),
          pettyCashBalanceLakhs: cleanNumeric(record.pettyCashBalanceLakhs),
          billsPendingLakhs: cleanNumeric(record.billsPendingLakhs),
          tenDaysCashReqCr: cleanNumeric(record.tenDaysCashReqCr),
          expectedInflowSalesCr: cleanNumeric(record.expectedInflowSalesCr),
          cmdPaymentDueLakhs: cleanNumeric(record.cmdPaymentDueLakhs),
          
          cashBookStatusJUD: record.cashBookStatusJUD || null,
          cashBookStatusJSB: record.cashBookStatusJSB || null,
          remarks: record.remarks || null,

          parserWarnings: record.parserWarnings || [],
        });
      }

      if (formattedRecords.length === 0) {
          return res.status(400).json({ error: "No valid records with a Date found." });
      }

      // 3. Clear Existing Data entirely to prevent DB bloat
      const primaryDate = formattedRecords[0].reportDate;
      await db.delete(accountsReports);
      

      const insertedData = await db.insert(accountsReports)
        .values(formattedRecords)
        .returning({ id: accountsReports.id });

      return res.json({
        success: true,
        message: `Successfully saved Accounts Report for ${primaryDate}.`,
        insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE ACCOUNTS ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save accounts reports" });
    }
  }
}

export default function setupSaveAccountsRoute(app: Express) {
  app.post("/api/excel/accounts/save", verifyDashboardJWT, SaveDashboardAccounts.save);
}