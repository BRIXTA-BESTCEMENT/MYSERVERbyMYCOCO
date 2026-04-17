// server/src/routes/dataFetchingRoutes/salesmanapp/destinationList.ts
import { Request, Response, Express } from 'express';
import { db } from '../../../db/db';
import { destinationMaster } from '../../../db/schema';
import { eq, and, desc, asc, ilike, sql, SQL } from 'drizzle-orm';

type TableLike = typeof destinationMaster;

// ---------- helpers ----------
const integerish = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : undefined;
}

function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: TableLike,
  tableName: string,
}) {
  const { endpoint, table, tableName } = config;

  // --- buildSort ---
  const buildSort = (sortByRaw?: string, sortDirRaw?: string) => {
    const dir = (sortDirRaw || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
    
    switch (sortByRaw) {
      case 'id':
        return dir === 'asc' ? asc(table.id) : desc(table.id);
      case 'institution':
        return dir === 'asc' ? asc(table.institution) : desc(table.institution);
      case 'zone':
        return dir === 'asc' ? asc(table.zone) : desc(table.zone);
      case 'district':
        return dir === 'asc' ? asc(table.district) : desc(table.district);
      case 'destination':
        return dir === 'asc' ? asc(table.destination) : desc(table.destination);
      default:
        // Default sort by ID descending (newest first)
        return desc(table.id); 
    }
  };

  // --- buildWhere ---
  const buildWhere = (q: any) => {
    const conds: (SQL | undefined)[] = [];

    // Exact matches
    const id = integerish(q.id);
    if (id !== undefined) conds.push(eq(table.id, id));
    if (q.institution) conds.push(eq(table.institution, String(q.institution)));
    if (q.zone) conds.push(eq(table.zone, String(q.zone)));
    if (q.district) conds.push(eq(table.district, String(q.district)));
    if (q.destination) conds.push(eq(table.destination, String(q.destination)));

    // Broad Search across multiple text fields
    if (q.search) {
      const s = `%${String(q.search).trim()}%`;
      conds.push(
        sql`(${ilike(table.destination, s)}
          OR ${ilike(table.district, s)}
          OR ${ilike(table.zone, s)}
          OR ${ilike(table.institution, s)})`
      );
    }

    const finalConds = conds.filter(Boolean) as SQL[];
    if (finalConds.length === 0) return undefined;
    return finalConds.length === 1 ? finalConds[0] : and(...finalConds);
  };

  // ===== GET ALL =====
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { limit = '100', page = '1', sortBy, sortDir, ...filters } = req.query;
      const lmt = Math.max(1, Math.min(500, parseInt(String(limit), 10) || 50));
      const pg = Math.max(1, parseInt(String(page), 10) || 1);
      const offset = (pg - 1) * lmt;

      const whereCond = buildWhere(filters);
      const orderExpr = buildSort(String(sortBy), String(sortDir));

      let q = db.select().from(table).$dynamic();
      if (whereCond) {
        q = q.where(whereCond);
      }
      const data = await q.orderBy(orderExpr).limit(lmt).offset(offset);

      res.json({ success: true, page: pg, limit: lmt, count: data.length, data });
    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}s` });
    }
  });

  // ===== GET ONE =====
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id, 10);
      
      if (isNaN(parsedId)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }

      const [record] = await db.select().from(table).where(eq(table.id, parsedId)).limit(1);
      
      if (!record) return res.status(404).json({ success: false, error: `${tableName} not found` });
      
      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}` });
    }
  });
}

export default function setupDestinationGetRoutes(app: Express) {
  createAutoCRUD(app, {
    endpoint: 'destinations',
    table: destinationMaster,
    tableName: 'Destination',
  });
  console.log('✅ Destinations GET endpoints ready');
}