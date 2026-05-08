// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveSales.ts

import { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db"; 
import { salesReports } from "../../../../db/schema"; 

// Helper schema to accept numbers, strings, or empty/null values gracefully
const looseNumberSchema = z.union([z.string(), z.number()]).nullable().optional();

const salesRecordSchema = z.object({
  reportDate: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  dealerName: z.string(),
  responsiblePerson: z.string().nullable().optional(),
  salesDataPayload: z.record(z.any()).optional(),
  rawPayload: z.record(z.any()).optional(),
  
  // All fields are now loose schemas because they map to decimal columns
  currentMonthMTDSales: looseNumberSchema,
  currentMonthTarget: looseNumberSchema,
  percentageTargetAchieved: looseNumberSchema,
  balance: looseNumberSchema,
  prorataSalesTarget: looseNumberSchema,
  percentageAsPerProrata: looseNumberSchema,
  askingRate: looseNumberSchema,
});

const payloadSchema = z.object({
  records: z.array(salesRecordSchema)
});

export class SaveDashboardSales {
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

      // 1. Format records & ensure Drizzle compatibility
      const formattedRecords = records.map(record => {
        let dateString = null;
        if (record.reportDate) {
           dateString = record.reportDate.split('T')[0]; 
        }

        // 🛠️ BULLETPROOF HELPER: Strips commas AND percentage signs!
        const cleanNumeric = (val: any) => {
            if (val === null || val === undefined) return null;
            
            // The regex /[,%]/g removes all commas AND percent symbols
            let str = String(val).replace(/[,%]/g, '').trim();
            
            if (/^[-–—−]+$/.test(str) || str === '') return null; 
            str = str.replace(/^[–—−]/, '-');
            
            if (isNaN(Number(str))) return null;
            
            // Return as string to preserve exact decimals for Postgres 'decimal/numeric' columns
            return str; 
        };

        return {
          ...record,
          reportDate: dateString as string, 
          
          // Apply the cleanNumeric helper to every decimal field
          currentMonthMTDSales: cleanNumeric(record.currentMonthMTDSales),
          currentMonthTarget: cleanNumeric(record.currentMonthTarget),
          percentageTargetAchieved: cleanNumeric(record.percentageTargetAchieved),
          balance: cleanNumeric(record.balance),
          prorataSalesTarget: cleanNumeric(record.prorataSalesTarget),
          percentageAsPerProrata: cleanNumeric(record.percentageAsPerProrata),
          askingRate: cleanNumeric(record.askingRate),

          // JSONB defaults
          rawPayload: record.rawPayload || {},
          salesDataPayload: record.salesDataPayload || {},
        };
      });

      
      // 2 Clear Existing Data entirely to prevent DB bloat
      await db.delete(salesReports);

      // 3. Execute Bulk Insert
      const insertedData = await db.insert(salesReports)
        .values(formattedRecords)
        .returning({ id: salesReports.id }); 

      return res.json({ 
          success: true, 
          message: `Successfully upserted ${insertedData.length} sales records.`,
          insertedIds: insertedData.map(d => d.id)
      });

    } catch (err: any) {
      console.error("SAVE SALES REPORTS ERROR:", err.message);
      return res.status(500).json({ error: "Failed to save sales reports to database" });
    }
  }
}

export default function setupSaveSalesRoute(app: Express) {
  app.post(
    "/api/excel/sales/save", 
    verifyDashboardJWT, 
    SaveDashboardSales.save
  );
}