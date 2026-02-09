import { Request, Response, Express } from "express";
import { db } from "../../db/db";
import { projectionVsActualReports } from "../../db/schema";
import { eq, and, desc, gte, lte, SQL } from "drizzle-orm";
import { z } from "zod";

/* =========================================================
   VALIDATION
========================================================= */

const querySchema = z.object({
  institution: z.enum(["JUD", "JSB"]).optional(),
  zone: z.string().optional(),
  dealerName: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().default(200),
});

/* =========================================================
   ROUTES
========================================================= */

export default function setupProjectionVsActualRoutes(app: Express) {
  const ENDPOINT = "projection-vs-actual";
  const TABLE = "Projection vs Actual Snapshot";

  /* ---------------- GET ALL ---------------- */

  app.get(`/api/${ENDPOINT}`, async (req: Request, res: Response) => {
    try {
      const q = querySchema.parse(req.query);

      const filters: SQL[] = [];

      if (q.institution)
        filters.push(eq(projectionVsActualReports.institution, q.institution));

      if (q.zone)
        filters.push(eq(projectionVsActualReports.zone, q.zone));

      if (q.dealerName)
        filters.push(eq(projectionVsActualReports.dealerName, q.dealerName));

      if (q.fromDate)
        filters.push(gte(projectionVsActualReports.reportDate, q.fromDate));

      if (q.toDate)
        filters.push(lte(projectionVsActualReports.reportDate, q.toDate));

      const rows = await db
        .select()
        .from(projectionVsActualReports)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(projectionVsActualReports.reportDate))
        .limit(q.limit);

      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: `Failed to fetch ${TABLE}` });
    }
  });

  /* ---------------- GET BY ID ---------------- */

  app.get(`/api/${ENDPOINT}/:id`, async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);

      const [row] = await db
        .select()
        .from(projectionVsActualReports)
        .where(eq(projectionVsActualReports.id, id));

      if (!row)
        return res.status(404).json({ success: false, error: `${TABLE} not found` });

      res.json({ success: true, data: row });
    } catch {
      res.status(400).json({ success: false, error: "Invalid ID" });
    }
  });

  console.log("✅ Projection vs Actual endpoints ready");
}
