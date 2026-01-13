// server/src/routes/updateRoutes/logisticsGateIO.ts
import { Express, Request, Response } from "express";
import { db } from "../../db/db";
import { logisticsGateIO } from "../../db/schema";
import { eq } from "drizzle-orm";

export default function setupLogisticsGateIOUpdateRoutes(app: Express) {
  
  // FIX 1: Helper returns "YYYY-MM-DD" string (or undefined/null)
  const formatDateString = (dateString: any) => {
    if (dateString === undefined) return undefined; 
    if (dateString === null) return null; 
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString().split('T')[0]; 
  };

  // Shared update logic function
  const handleUpdate = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
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

      if (!id) {
        return res.status(400).json({ error: "ID is required for updates" });
      }

      // Check if record exists
      const existingRecord = await db
        .select()
        .from(logisticsGateIO)
        .where(eq(logisticsGateIO.id, id));

      if (existingRecord.length === 0) {
        return res.status(404).json({ error: "Logistics record not found" });
      }

      // Prepare update object
      const updateData: any = {};

      if (zone !== undefined) updateData.zone = zone;
      if (district !== undefined) updateData.district = district;
      if (destination !== undefined) updateData.destination = destination;
      
      // FIX 2: Use formatDateString for dates
      if (doOrderDate !== undefined) updateData.doOrderDate = formatDateString(doOrderDate);
      if (gateInDate !== undefined) updateData.gateInDate = formatDateString(gateInDate);
      if (wbInDate !== undefined) updateData.wbInDate = formatDateString(wbInDate);
      if (wbOutDate !== undefined) updateData.wbOutDate = formatDateString(wbOutDate);
      if (gateOutDate !== undefined) updateData.gateOutDate = formatDateString(gateOutDate);

      // Times & Strings
      if (doOrderTime !== undefined) updateData.doOrderTime = doOrderTime;
      if (gateInTime !== undefined) updateData.gateInTime = gateInTime;
      if (processingTime !== undefined) updateData.processingTime = processingTime;
      if (wbInTime !== undefined) updateData.wbInTime = wbInTime;
      if (diffGateInTareWt !== undefined) updateData.diffGateInTareWt = diffGateInTareWt;
      if (wbOutTime !== undefined) updateData.wbOutTime = wbOutTime;
      if (diffTareWtGrossWt !== undefined) updateData.diffTareWtGrossWt = diffTareWtGrossWt;
      if (gateOutTime !== undefined) updateData.gateOutTime = gateOutTime;
      if (diffGrossWtGateOut !== undefined) updateData.diffGrossWtGateOut = diffGrossWtGateOut;
      if (diffGrossWtInvoiceDT !== undefined) updateData.diffGrossWtInvoiceDT = diffGrossWtInvoiceDT;
      if (diffInvoiceDTGateOut !== undefined) updateData.diffInvoiceDTGateOut = diffInvoiceDTGateOut;
      if (diffGateInGateOut !== undefined) updateData.diffGateInGateOut = diffGateInGateOut;

      // FIX 3: Always update 'updatedAt' manually
      updateData.updatedAt = new Date();

      // Perform Update
      const [updatedRecord] = await db
        .update(logisticsGateIO)
        .set(updateData)
        .where(eq(logisticsGateIO.id, id))
        .returning();

      res.status(200).json({
        success: true,
        message: "Logistics record updated successfully",
        data: updatedRecord,
      });

    } catch (error) {
      console.error("Error updating logistics record:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update logistics record" 
      });
    }
  };

  // PUT Route (Full or Partial Update)
  app.put("/api/logistics-gate-io/:id", handleUpdate);

  // PATCH Route (Partial Update)
  app.patch("/api/logistics-gate-io/:id", handleUpdate);
}