// server/src/routes/formSubmissionRoutes/logisticsGateIO.ts
import { Express, Request, Response } from "express";
import { db } from '../../db/db';
import { logisticsGateIO } from "../../db/schema";
import { randomUUID } from "crypto"; // Import Node's built-in UUID generator

export default function setupLogisticsGateIOSubmissionRoute(app: Express) {

  app.post("/api/logistics-gate-io", async (req: Request, res: Response) => {
    try {
      const {
        zone,
        district,
        destination,
        doOrderDate,
        doOrderTime,
        gateInDate,
        gateInTime,
        processingTime,
        wbInDate,
        wbInTime,
        diffGateInTareWt,
        wbOutDate,
        wbOutTime,
        diffTareWtGrossWt,
        gateOutDate,
        gateOutTime,
        diffGrossWtGateOut,
        diffGrossWtInvoiceDT,
        diffInvoiceDTGateOut,
        diffGateInGateOut,
      } = req.body;

      // Helper function to handle empty strings or nulls for Date fields
      const parseDate = (dateString: any) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0]; 
      };
      const now = new Date();

      const insertData = {
        id: randomUUID(), // FIX: Manually generate UUID to satisfy Not-Null constraint
        zone,
        district,
        destination,
        
        // FIX: Apply the parseDate function to convert Strings to Date objects
        doOrderDate: parseDate(doOrderDate),
        doOrderTime,
        
        gateInDate: parseDate(gateInDate),
        gateInTime,
        
        processingTime,
        
        wbInDate: parseDate(wbInDate),
        wbInTime,
        
        diffGateInTareWt,
        
        wbOutDate: parseDate(wbOutDate),
        wbOutTime,
        
        diffTareWtGrossWt,
        
        gateOutDate: parseDate(gateOutDate),
        gateOutTime,
        
        diffGrossWtGateOut,
        diffGrossWtInvoiceDT,
        diffInvoiceDTGateOut,
        diffGateInGateOut,

        createdAt: now,
        updatedAt: now,
      } satisfies typeof logisticsGateIO.$inferInsert;
      
      const [newEntry] = await db
        .insert(logisticsGateIO)
        .values(insertData)
        .returning();

      res.status(201).json({
        success: true,
        message: "Logistics data submitted successfully",
        data: newEntry,
      });

    } catch (error) {
      console.error("Error submitting logistics data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save logistics data. Please check your inputs."
      });
    }
  });
}