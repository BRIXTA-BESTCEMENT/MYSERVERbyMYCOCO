// server/src/routes/dataFetchingRoutes/technicalSites.ts

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { technicalSites, insertTechnicalSiteSchema, siteAssociatedDealers, siteAssociatedMasons } from '../../db/schema';
import { eq, and, desc, asc, ilike, sql, SQL, gte, lte, isNotNull, not, inArray } from 'drizzle-orm';
import { z } from 'zod';

// Ensure the table type is correctly inferred for Drizzle ORM helpers
type TableLike = typeof technicalSites;

// ---------- helpers (copied from dealers.ts/dvr.ts for self-containment) ----------
const numberish = (v: unknown) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const boolish = (v: unknown) => {
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return undefined;
};

// Custom auto-CRUD function tailored for the TechnicalSite table
function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: TableLike,
  schema: z.ZodSchema,
  tableName: string,
}) {
  const { endpoint, table, tableName } = config;

  // --- buildWhere: Custom logic for TechnicalSite filters ---
  const buildWhere = (q: any) => {
    const conds: (SQL | undefined)[] = [];

    // General filters
    if (q.region) conds.push(eq(table.region, String(q.region)));
    if (q.area) conds.push(eq(table.area, String(q.area)));
    if (q.siteType) conds.push(eq(table.siteType, String(q.siteType)));
    if (q.stageOfConstruction) conds.push(eq(table.stageOfConstruction, String(q.stageOfConstruction)));

    // Query the MANY-TO-MANY junction table for Dealers
    if (q.relatedDealerID) {
      const siteIdsWithDealer = db
        .select({ id: siteAssociatedDealers.B })
        .from(siteAssociatedDealers)
        .where(eq(siteAssociatedDealers.A, String(q.relatedDealerID)));

      conds.push(inArray(table.id, siteIdsWithDealer));
    }

    // Query the MANY-TO-MANY junction table for Masons
    if (q.relatedMasonpcID) {
      const siteIdsWithMason = db
        .select({ id: siteAssociatedMasons.B })
        .from(siteAssociatedMasons)
        .where(eq(siteAssociatedMasons.A, String(q.relatedMasonpcID)));

      conds.push(inArray(table.id, siteIdsWithMason));
    }

    // Boolean filters (convertedSite, needFollowUp)
    const convertedSite = boolish(q.convertedSite);
    if (convertedSite !== undefined) conds.push(eq(table.convertedSite, convertedSite));

    const needFollowUp = boolish(q.needFollowUp);
    if (needFollowUp !== undefined) conds.push(eq(table.needFollowUp, needFollowUp));

    const hasPhoto = boolish(q.hasPhoto);
    if (hasPhoto === true) {
      conds.push(and(isNotNull(table.imageUrl), not(eq(table.imageUrl, ''))));
    } else if (hasPhoto === false) {
      conds.push(sql`(${table.imageUrl} IS NULL OR ${table.imageUrl} = '')`);
    }

    // Date Range Filters
    const dateField = table.firstVisitDate;
    if (q.startDate && q.endDate && dateField) {
      conds.push(
        and(
          gte(dateField, q.startDate as string),
          lte(dateField, q.endDate as string)
        )
      );
    }

    // Search filter
    if (q.search) {
      const s = `%${String(q.search).trim()}%`;
      conds.push(
        sql`(${ilike(table.siteName, s)} 
          OR ${ilike(table.concernedPerson, s)} 
          OR ${ilike(table.phoneNo, s)} 
          OR ${ilike(table.keyPersonName, s)})`
      );
    }

    const finalConds = conds.filter(Boolean) as SQL[];
    if (finalConds.length === 0) return undefined;
    return finalConds.length === 1 ? finalConds[0] : and(...finalConds);
  };

  // --- buildSort: Custom sort logic for TechnicalSite ---
  const buildSort = (sortByRaw?: string, sortDirRaw?: string) => {
    const direction = (sortDirRaw || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

    switch (sortByRaw) {
      case 'siteName':
        return direction === 'asc' ? asc(table.siteName) : desc(table.siteName);
      case 'region':
        return direction === 'asc' ? asc(table.region) : desc(table.region);
      case 'lastVisitDate':
        return direction === 'asc' ? asc(table.lastVisitDate) : desc(table.lastVisitDate);
      case 'firstVisitDate':
        return direction === 'asc' ? asc(table.firstVisitDate) : desc(table.firstVisitDate);
      case 'convertedSite':
        return direction === 'asc' ? asc(table.convertedSite) : desc(table.convertedSite);
      case 'imageUrl':
        return direction === 'asc' ? asc(table.imageUrl) : desc(table.imageUrl);
      case 'createdAt':
        return direction === 'asc' ? asc(table.createdAt) : desc(table.createdAt);
      default:
        return desc(table.lastVisitDate || table.createdAt);
    }
  };

  const listHandler = async (req: Request, res: Response, baseWhere?: SQL) => {
    try {
      const { limit = '50', page = '1', sortBy, sortDir, ...filters } = req.query;
      const lmt = Math.max(1, Math.min(500, parseInt(String(limit), 10) || 50));
      const pg = Math.max(1, parseInt(String(page), 10) || 1);
      const offset = (pg - 1) * lmt;

      const extra = buildWhere(filters);
      const whereCondition = baseWhere ? (extra ? and(baseWhere, extra) : baseWhere) : extra;

      let orderExpr: SQL | any = buildSort(String(sortBy), String(sortDir));

      // If searching AND no specific sort requested, prioritize relevance on Site Name
      if (filters.search && !sortBy) {
        const s = String(filters.search).trim();
        orderExpr = sql`
          CASE 
            WHEN ${table.siteName} ILIKE ${s} THEN 0       -- Exact Match
            WHEN ${table.siteName} ILIKE ${s + '%'} THEN 1 -- Starts With
            ELSE 2 
          END, 
          ${table.siteName} ASC
        `;
      }

      let q = db.select().from(table).$dynamic();
      if (whereCondition) {
        q = q.where(whereCondition);
      }
      const data = await q.orderBy(orderExpr).limit(lmt).offset(offset);

      res.json({ success: true, page: pg, limit: lmt, count: data.length, data });
    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // ===== GET ALL (Base Filtered List) =====
  app.get(`/api/${endpoint}`, (req, res) => listHandler(req, res));

  // ===== GET BY ID =====
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);

      if (!record) return res.status(404).json({ success: false, error: `${tableName} not found` });

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== GET BY PHONE NUMBER (Unique Lookup) =====
  app.get(`/api/${endpoint}/phone/:phoneNo`, async (req: Request, res: Response) => {
    try {
      const { phoneNo } = req.params;
      const [record] = await db.select().from(table).where(eq(table.phoneNo, phoneNo)).limit(1);

      if (!record) return res.status(404).json({ success: false, error: `${tableName} not found` });

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}` });
    }
  });

  // ===== GET BY REGION =====
  app.get(`/api/${endpoint}/region/:region`, (req, res) => {
    const base = eq(table.region, String(req.params.region));
    return listHandler(req, res, base);
  });

  // ===== GET BY AREA =====
  app.get(`/api/${endpoint}/area/:area`, (req, res) => {
    const base = eq(table.area, String(req.params.area));
    return listHandler(req, res, base);
  });

  // ===== GET BY DEALER ID (Primary Dealer) =====
  app.get(`/api/${endpoint}/dealer/:dealerId`, (req, res) => {
    const base = inArray(
      table.id,
      db.select({ id: siteAssociatedDealers.B })
        .from(siteAssociatedDealers)
        .where(eq(siteAssociatedDealers.A, String(req.params.dealerId)))
    );

    return listHandler(req, res, base);
  });

  // ===== GET BY MASONS ID (Primary Dealer) =====
  app.get(`/api/${endpoint}/mason/:masonId`, (req, res) => {
    const base = inArray(
      table.id,
      db.select({ id: siteAssociatedMasons.B })
        .from(siteAssociatedMasons)
        .where(eq(siteAssociatedMasons.A, String(req.params.masonId)))
    );
    return listHandler(req, res, base);
  });

  // GET nearby sites within X meters
  app.get('/api/technical-sites/discovery/nearby', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radiusInKm = 0.1; // 100 meters

      // Haversine distance formula in SQL
      const distanceSql = sql`
      (6371 * acos(
        cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + 
        sin(radians(${lat})) * sin(radians(latitude))
      ))
    `;

      const nearby = await db.select({
        id: technicalSites.id,
        siteName: technicalSites.siteName,
        address: technicalSites.address,
        distance: distanceSql,
      })
        .from(technicalSites)
        .where(sql`${distanceSql} < ${radiusInKm}`)
        .orderBy(distanceSql)
        .limit(5);

      res.json({ success: true, data: nearby });
    } catch (error) {
      console.error('Nearby Discovery Error:', error);
      res.status(500).json({ success: false, error: 'Discovery failed' });
    }
  });
}

export default function setupTechnicalSitesRoutes(app: Express) {
  createAutoCRUD(app, {
    endpoint: 'technical-sites',
    table: technicalSites,
    schema: insertTechnicalSiteSchema,
    tableName: 'Technical Site',
  });

  console.log('✅ Technical Sites GET endpoints setup complete');
}