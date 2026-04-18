// src/routes/updateRoutes/adminapp/sales_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { sql } from "drizzle-orm";
import { salesReports } from "../../../db/schema"; 

export default function setupSalesReportsUpdateRoutes(app: Express) {
  const endpoint = "adminapp/sales-reports";

  // ==========================================
  // 1. EDIT NON-TRADE APPROVAL (By embedded ID)
  // ==========================================
  app.put(`/api/${endpoint}/non-trade/:itemId`, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const payload = req.body; // { partyName, rate, unit, status }

      // db.update automatically resolves your custom schema
      await db.update(salesReports)
        .set({
          nonTradeDataPayload: sql`(
            SELECT COALESCE(jsonb_agg(
              CASE
                WHEN elem->>'id' = ${itemId} THEN elem || ${JSON.stringify(payload)}::jsonb
                ELSE elem
              END
            ), '[]'::jsonb)
            FROM jsonb_array_elements(${salesReports.nonTradeDataPayload}) elem
          )`
        })
        .where(sql`${salesReports.nonTradeDataPayload} @> ${JSON.stringify([{ id: itemId }])}::jsonb`);

      return res.json({ success: true, message: "Non-Trade Approval updated successfully" });
    } catch (error) {
      console.error("[EDIT NON-TRADE ERROR]", error);
      return res.status(500).json({ success: false, error: "Failed to update approval" });
    }
  });

  // ==========================================
  // 2. DELETE NON-TRADE APPROVAL (By embedded ID)
  // ==========================================
  app.delete(`/api/${endpoint}/non-trade/:itemId`, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;

      await db.update(salesReports)
        .set({
          nonTradeDataPayload: sql`(
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(${salesReports.nonTradeDataPayload}) elem
            WHERE elem->>'id' != ${itemId}
          )`
        })
        .where(sql`${salesReports.nonTradeDataPayload} @> ${JSON.stringify([{ id: itemId }])}::jsonb`);

      return res.json({ success: true, message: "Non-Trade Approval deleted successfully" });
    } catch (error) {
      console.error("[DELETE NON-TRADE ERROR]", error);
      return res.status(500).json({ success: false, error: "Failed to delete approval" });
    }
  });

  console.log("✅ Sales Reports Update endpoints setup complete");
}