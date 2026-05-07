// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveOutstanding.ts

import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db"; 
import { outstandingReports, verifiedDealers } from "../../../../db/schema"; 

const outstandingRecordSchema = z.object({
  reportDate: z.string().nullable().optional(),
  institution: z.string().nullable().optional(),
  verifiedDealerId: z.number().nullable().optional(),
  dealerName: z.string(),
  securityDepositAmt: z.string().nullable().optional(),
  pendingAmt: z.string().nullable().optional(),
  ageingData: z.record(z.any()), 
});

const payloadSchema = z.object({
  records: z.array(outstandingRecordSchema)
});

export class SaveDashboardOutstanding {
  public static async save(req: Request, res: Response): Promise<any> {
    try {
      const parsedBody = payloadSchema.safeParse(req.body);

      if (!parsedBody.success) {
        return res.status(400).json({ 
          error: "Invalid data format", 
          details: parsedBody.error.format() 
        });
      }

      const { records } = parsedBody.data;

      if (records.length === 0) {
        return res.status(400).json({ error: "No records provided to save." });
      }

      // 1. Preload Dealers
      const dealers = await db.select().from(verifiedDealers);

      const findDealerId = (name: string) => {
        if (!name) return null;
        const clean = name.toLowerCase().trim();
        const match = dealers.find((d) =>
            d.dealerPartyName?.toLowerCase().includes(clean)
        );
        return match?.id ?? null;
      };

      // 2. Format records & Sanitize Excel formatting
      const formattedRecords = records.map(record => {
        let dateString = null;
        if (record.reportDate) {
           dateString = record.reportDate.split('T')[0]; 
        }

        // 🛠️ BULLETPROOF HELPER: Handles all dashes, commas, and text
        const cleanNumber = (val: any) => {
            if (val === null || val === undefined) return null;
            
            // Convert to string, remove commas, and trim whitespace
            let str = String(val).replace(/,/g, '').trim();
            
            // Check if string is purely made of any kind of dash (hyphen, en-dash, em-dash, minus sign)
            // or if it's completely empty
            if (/^[-–—−]+$/.test(str) || str === '') return null; 
            
            // If it's a negative number with a weird typographic dash, normalize it to standard hyphen
            str = str.replace(/^[–—−]/, '-');

            // Final safety check: if Postgres still won't consider this a number (e.g. "N/A"), return null
            if (isNaN(Number(str))) return null;

            return str;
        };

        const cleanAgeingData: Record<string, number> = {};
        if (record.ageingData) {
            Object.entries(record.ageingData).forEach(([key, val]) => {
                const cleanVal = cleanNumber(val);
                cleanAgeingData[key] = cleanVal ? Number(cleanVal) : 0;
            });
        }

        return {
          ...record,
          reportDate: dateString,
          securityDepositAmt: cleanNumber(record.securityDepositAmt),
          pendingAmt: cleanNumber(record.pendingAmt),
          ageingData: cleanAgeingData,
          verifiedDealerId: record.verifiedDealerId || findDealerId(record.dealerName),
        };
      });

      // 3. Prevent Duplicates
      const primaryDate = formattedRecords[0].reportDate;
      if (primaryDate) {
        await db.delete(outstandingReports)
          .where(eq(outstandingReports.reportDate, primaryDate));
      }

      // 4. Execute Bulk Insert
      const insertedData = await db.insert(outstandingReports)
        .values(formattedRecords)
        .returning({ id: outstandingReports.id }); 

      return res.json({ 
          success: true, 
          message: `Successfully upserted ${insertedData.length} records.`,
          insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE OUTSTANDING REPORTS ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save reports to database" });
    }
  }
}

export default function setupSaveOutstandingRoute(app: Express) {
  app.post(
    "/api/excel/outstanding/save", 
    verifyDashboardJWT, 
    SaveDashboardOutstanding.save
  );
}