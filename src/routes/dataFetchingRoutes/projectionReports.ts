import { Request, Response, Express } from "express";
import { db } from "../../db/db";
import { projectionReports, users, verifiedDealers } from "../../db/schema";
import { eq, and, desc, gte, lte, SQL, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";

/* =========================================================
   VALIDATION
========================================================= */

const querySchema = z.object({
  institution: z.enum(["JUD", "JSB"]).optional(),
  zone: z.string().optional(),
  verifiedDealerId: z.coerce.number().optional(),
  userId: z.coerce.number().optional(),
  salesPromoterUserId: z.coerce.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().default(100),
});

/* =========================================================
   ROUTES
========================================================= */

export default function setupProjectionRoutes(app: Express) {
  const ENDPOINT = "projection-reports";
  const TABLE = "Projection Plan";

  /* ---------------- GET ALL ---------------- */

  app.get(`/api/${ENDPOINT}`, async (req: Request, res: Response) => {
    try {
      const q = querySchema.parse(req.query);

      const filters: SQL[] = [];

      if (q.institution)
        filters.push(eq(projectionReports.institution, q.institution));

      if (q.zone)
        filters.push(eq(projectionReports.zone, q.zone));

      if (q.verifiedDealerId !== undefined)
        filters.push(eq(projectionReports.verifiedDealerId, q.verifiedDealerId));

      if (q.userId !== undefined)
        filters.push(eq(projectionReports.userId, q.userId));

      if (q.salesPromoterUserId !== undefined)
        filters.push(eq(projectionReports.salesPromoterUserId, q.salesPromoterUserId));

      if (q.fromDate)
        filters.push(gte(projectionReports.reportDate, q.fromDate));

      if (q.toDate)
        filters.push(lte(projectionReports.reportDate, q.toDate));

      const rows = await db
        .select({
          ...getTableColumns(projectionReports),
          userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          dealerPartyName: verifiedDealers.dealerPartyName
        })
        .from(projectionReports)
        .leftJoin(users, eq(projectionReports.userId, users.id))
        .leftJoin(verifiedDealers, eq(projectionReports.verifiedDealerId, verifiedDealers.id))
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(projectionReports.reportDate))
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
        .select({
          ...getTableColumns(projectionReports),
          userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          dealerPartyName: verifiedDealers.dealerPartyName
        })
        .from(projectionReports)
        .leftJoin(users, eq(projectionReports.userId, users.id))
        .leftJoin(verifiedDealers, eq(projectionReports.verifiedDealerId, verifiedDealers.id))
        .where(eq(projectionReports.id, id));

      if (!row)
        return res.status(404).json({ success: false, error: `${TABLE} not found` });

      res.json({ success: true, data: row });
    } catch {
      res.status(400).json({ success: false, error: "Invalid ID" });
    }
  });

  console.log("✅ Projection Plan endpoints ready");
}