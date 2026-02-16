// server/src/routes/formSubmissionRoutes/logisticsIO.ts
import { Express, Request, Response } from "express";
import { db } from '../../db/db';
import { logisticsIO } from "../../db/schema";
import { randomUUID } from "crypto";

export default function setupLogisticsIOSubmissionRoute(app: Express) {

  app.post("/api/logistics-io", async (req: Request, res: Response) => {
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
        gateOutNoOfInvoice,
        gateOutInvoiceNos,
        gateOutBillNos,
        diffGrossWtGateOut,
        diffGrossWtInvoiceDT,
        diffInvoiceDTGateOut,
        diffGateInGateOut,
        // --- New Fields ---
        purpose,
        typeOfMaterials,
        vehicleNumber,
        storeDate,
        storeTime,
        noOfInvoice,
        partyName,
        invoiceNos,
        billNos,
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
        id: randomUUID(),
        zone,
        district,
        destination,
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
        gateOutNoOfInvoice,
        gateOutInvoiceNos: Array.isArray(gateOutInvoiceNos) ? gateOutInvoiceNos : [], 
        gateOutBillNos: Array.isArray(gateOutBillNos) ? gateOutBillNos : [],
        diffGrossWtGateOut,
        diffGrossWtInvoiceDT,
        diffInvoiceDTGateOut,
        diffGateInGateOut,
        purpose,
        typeOfMaterials,
        vehicleNumber,
        storeDate: parseDate(storeDate),
        storeTime,
        noOfInvoice,
        partyName,
        invoiceNos: Array.isArray(invoiceNos) ? invoiceNos : [], 
        billNos: Array.isArray(billNos) ? billNos : [],          

        createdAt: now,
        updatedAt: now,
      } satisfies typeof logisticsIO.$inferInsert;
      
      const [newEntry] = await db
        .insert(logisticsIO)
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