// server/src/routes/dataFetchingRoutes/collectionReports.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { collectionReports, users, dealers } from '../../db/schema';
import { eq, and, desc, asc, gte, lte, SQL, getTableColumns, sql } from 'drizzle-orm';
import { z } from 'zod';

export default function setupCollectionReportsRoutes(app: Express) {
  const ENDPOINT = 'collection-reports';
  const TABLE_NAME = 'Collection Report';

  // Helper to safely convert to a number or undefined
  const numberish = (v: unknown) => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Helper to build WHERE clause for filtering
  const buildWhere = (q: any): SQL | undefined => {
    const conds: SQL[] = [];

    // Filter: Institution (JUD | JSB)
    if (q.institution) {
      conds.push(eq(collectionReports.institution, String(q.institution)));
    }

    // Filter: Dealer
    if (q.dealerId) {
      conds.push(eq(collectionReports.dealerId, String(q.dealerId)));
    }

    // Filter: Sales Promoter (User ID)
    const salesPromoterUserId = numberish(q.salesPromoterUserId);
    if (salesPromoterUserId !== undefined) {
      conds.push(eq(collectionReports.salesPromoterUserId, salesPromoterUserId));
    }

    // Filter: Date Range (using voucherDate)
    const fromDate = q.fromDate as string | undefined;
    const toDate = q.toDate as string | undefined;

    if (fromDate) conds.push(gte(collectionReports.voucherDate, fromDate));
    if (toDate) conds.push(lte(collectionReports.voucherDate, toDate));

    if (conds.length === 0) return undefined;
    return conds.length === 1 ? conds[0] : and(...conds);
  };

  // Helper to build ORDER BY clause
  const buildSort = (sortByRaw?: string, sortDirRaw?: string) => {
    const direction = (sortDirRaw || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

    switch (sortByRaw) {
      case 'createdAt':
        return direction === 'asc' ? asc(collectionReports.createdAt) : desc(collectionReports.createdAt);
      case 'voucherDate':
      default:
        // Default sort by voucherDate descending (most recent first)
        return direction === 'asc' ? asc(collectionReports.voucherDate) : desc(collectionReports.voucherDate);
    }
  };

  // Generic list handler for reuse in specific routes
  const listHandler = async (req: Request, res: Response, baseWhere?: SQL) => {
    try {
      const { limit = '50', page = '1', sortBy, sortDir, ...filters } = req.query;
      const lmt = Math.max(1, Math.min(500, parseInt(String(limit), 10) || 50));
      const pg = Math.max(1, parseInt(String(page), 10) || 1);
      const offset = (pg - 1) * lmt;

      const extra = buildWhere(filters);

      // Combine all where conditions
      const conds: SQL[] = [];
      if (baseWhere) conds.push(baseWhere);
      if (extra) conds.push(extra);

      const whereCondition: SQL | undefined = conds.length > 0 ? and(...conds) : undefined;
      const orderExpr = buildSort(String(sortBy), String(sortDir));

      // Query with joins to get contextual data (Sales Promoter Name & Dealer Name)
      let query = db.select({
          ...getTableColumns(collectionReports),
          salesPromoterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          dealerName: dealers.name
        })
        .from(collectionReports)
        .leftJoin(users, eq(collectionReports.salesPromoterUserId, users.id))
        .leftJoin(dealers, eq(collectionReports.dealerId, dealers.id))
        .$dynamic();

      // Conditionally apply where clause
      if (whereCondition) {
        query = query.where(whereCondition);
      }

      const data = await query
        .orderBy(orderExpr)
        .limit(lmt)
        .offset(offset);

      res.json({ success: true, page: pg, limit: lmt, count: data.length, data });
    } catch (error) {
      console.error(`Get ${TABLE_NAME}s list error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${TABLE_NAME} entries`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // -------------------------------------------------------
  // 1. GET ALL (with pagination, filtering, and sorting)
  // -------------------------------------------------------
  app.get(`/api/${ENDPOINT}`, (req, res) => listHandler(req, res));

  // -------------------------------------------------------
  // 2. GET BY ID (Single Record)
  // -------------------------------------------------------
  app.get(`/api/${ENDPOINT}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate UUID format to prevent DB throwing errors on malformed strings
      const uuidSchema = z.string().uuid();
      const validId = uuidSchema.safeParse(id);

      if (!validId.success) {
        return res.status(400).json({ success: false, error: "Invalid ID format" });
      }

      const [record] = await db.select({
          ...getTableColumns(collectionReports),
          salesPromoterName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          dealerName: dealers.name
        })
        .from(collectionReports)
        .leftJoin(users, eq(collectionReports.salesPromoterUserId, users.id))
        .leftJoin(dealers, eq(collectionReports.dealerId, dealers.id))
        .where(eq(collectionReports.id, id))
        .limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${TABLE_NAME} not found`
        });
      }

      res.json({ success: true, data: record });

    } catch (error) {
      console.error(`Get ${TABLE_NAME} by ID error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${TABLE_NAME} entry`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // -------------------------------------------------------
  // 3. GET BY SALES PROMOTER (User Context)
  // -------------------------------------------------------
  app.get(`/api/${ENDPOINT}/user/:userId`, (req, res) => {
    const userId = numberish(req.params.userId);
    if (userId === undefined) {
      return res.status(400).json({ success: false, error: 'Valid User ID is required.' });
    }
    const base = eq(collectionReports.salesPromoterUserId, userId);
    return listHandler(req, res, base);
  });

  console.log(`✅ ${TABLE_NAME}s GET endpoints setup complete`);
}