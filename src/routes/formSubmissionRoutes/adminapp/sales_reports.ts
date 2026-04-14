// src/routes/formsubmissionRoutes/adminapp/sales_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { salesReports } from "../../../db/schema";
import { v4 as uuidv4 } from "uuid";

export default function setupSalesReportsPostRoutes(app: Express) {
  const endpoint = "adminapp/sales-reports";

  // POST: Create a new row for Multiple Non-Trade Approvals
  app.post(`/api/${endpoint}/non-trade`, async (req: Request, res: Response) => {
    try {
      const { approvals } = req.body; // Expecting an array from Flutter

      if (!Array.isArray(approvals) || approvals.length === 0) {
        return res.status(400).json({ error: "Expected an array of non-trade approvals." });
      }

      const newApprovals = approvals.map((item: any) => ({
        id: uuidv4(),
        partyName: item.partyName,
        rate: item.rate,
        unit: item.unit, // MT
        status: item.status || 'Pending',
        submittedAt: new Date().toISOString()
      }));

      await db.insert(salesReports).values({
        reportDate: new Date().toISOString().split('T')[0],
        rawPayload: {}, 
        nonTradeDataPayload: newApprovals, 
      });

      return res.json({ success: true, message: "Non-Trade Approvals submitted successfully" });
    } catch (err) {
      console.error("[SALES POST ERROR - Non-Trade]", err);
      return res.status(500).json({ success: false, error: "Failed to submit approvals" });
    }
  });

  console.log("✅ Sales Reports POST endpoints setup complete");
}