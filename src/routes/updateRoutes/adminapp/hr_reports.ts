// src/routes/updateRoutes/adminapp/hr_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { hrReports } from "../../../db/schema"; 
import { sql } from "drizzle-orm";

export default function setupHrReportsUpdateRoutes(app: Express) {
  const endpoint = "adminapp/hr-reports";

  // ==========================================
  // 1. EDIT INTERVIEW (By embedded ID)
  // ==========================================
  app.put(`/api/${endpoint}/interviews/:itemId`, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const payload = req.body; 

      await db.update(hrReports)
        .set({
          interviews: sql`(
            SELECT COALESCE(jsonb_agg(
              CASE
                WHEN elem->>'id' = ${itemId} THEN elem || ${JSON.stringify(payload)}::jsonb
                ELSE elem
              END
            ), '[]'::jsonb)
            FROM jsonb_array_elements(${hrReports.interviews}) elem
          )`
        })
        .where(sql`${hrReports.interviews} @> ${JSON.stringify([{ id: itemId }])}::jsonb`);

      return res.json({ success: true, message: "Interview updated successfully" });
    } catch (error) {
      console.error("[HR EDIT INTERVIEW ERROR]", error);
      return res.status(500).json({ success: false, error: "Failed to update interview" });
    }
  });

  // ==========================================
  // 2. DELETE INTERVIEW (By embedded ID)
  // ==========================================
  app.delete(`/api/${endpoint}/interviews/:itemId`, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;

      await db.update(hrReports)
        .set({
          interviews: sql`(
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(${hrReports.interviews}) elem
            WHERE elem->>'id' != ${itemId}
          )`
        })
        .where(sql`${hrReports.interviews} @> ${JSON.stringify([{ id: itemId }])}::jsonb`);

      return res.json({ success: true, message: "Interview deleted successfully" });
    } catch (error) {
      console.error("[HR DELETE INTERVIEW ERROR]", error);
      return res.status(500).json({ success: false, error: "Failed to delete interview" });
    }
  });

  // ==========================================
  // 3. EDIT PERFORMER (Top/Bottom by embedded ID)
  // ==========================================
  app.put(`/api/${endpoint}/performers/:type/:itemId`, async (req: Request, res: Response) => {
    try {
      const { itemId, type } = req.params;
      const payload = req.body; 

      if (type !== 'top' && type !== 'bottom') {
        return res.status(400).json({ success: false, error: "Type must be 'top' or 'bottom'" });
      }

      const targetColumn = type === 'top' ? hrReports.topPerformers : hrReports.bottomPerformers;
      const updateKey = type === 'top' ? 'topPerformers' : 'bottomPerformers';

      const updatePayload: any = {};
      updatePayload[updateKey] = sql`(
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN elem->>'id' = ${itemId} THEN elem || ${JSON.stringify(payload)}::jsonb
            ELSE elem
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(${targetColumn}) elem
      )`;

      await db.update(hrReports)
        .set(updatePayload)
        .where(sql`${targetColumn} @> ${JSON.stringify([{ id: itemId }])}::jsonb`);

      return res.json({ success: true, message: "Performer updated successfully" });
    } catch (error) {
      console.error("[HR EDIT PERFORMER ERROR]", error);
      return res.status(500).json({ success: false, error: "Failed to update performer" });
    }
  });

  // ==========================================
  // 4. DELETE PERFORMER (Top/Bottom by embedded ID)
  // ==========================================
  app.delete(`/api/${endpoint}/performers/:type/:itemId`, async (req: Request, res: Response) => {
    try {
      const { itemId, type } = req.params;

      if (type !== 'top' && type !== 'bottom') {
        return res.status(400).json({ success: false, error: "Type must be 'top' or 'bottom'" });
      }

      const targetColumn = type === 'top' ? hrReports.topPerformers : hrReports.bottomPerformers;
      const updateKey = type === 'top' ? 'topPerformers' : 'bottomPerformers';

      const updatePayload: any = {};
      updatePayload[updateKey] = sql`(
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(${targetColumn}) elem
        WHERE elem->>'id' != ${itemId}
      )`;

      await db.update(hrReports)
        .set(updatePayload)
        .where(sql`${targetColumn} @> ${JSON.stringify([{ id: itemId }])}::jsonb`);

      return res.json({ success: true, message: "Performer deleted successfully" });
    } catch (error) {
      console.error("[HR DELETE PERFORMER ERROR]", error);
      return res.status(500).json({ success: false, error: "Failed to delete performer" });
    }
  });

  console.log("✅ HR Reports Update endpoints setup complete");
}