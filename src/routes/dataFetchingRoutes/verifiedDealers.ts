// server/src/routes/dataFetchingRoutes/verifiedDealers.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { verifiedDealers, users, dealers } from '../../db/schema';
import { eq, and, desc, asc, SQL, getTableColumns, sql } from 'drizzle-orm';

export default function setupVerifiedDealersGetRoutes(app: Express) {
    const endpoint = 'verified-dealers';

    const numberish = (v: unknown) => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const booleanish = (v: unknown) => {
        if (v === 'true' || v === '1') return true;
        if (v === 'false' || v === '0') return false;
        return undefined;
    };

    const buildWhere = (q: any): SQL | undefined => {
        const conds: SQL[] = [];

        if (q.zone) conds.push(eq(verifiedDealers.zone, String(q.zone)));
        if (q.area) conds.push(eq(verifiedDealers.area, String(q.area)));
        if (q.dealerCategory) conds.push(eq(verifiedDealers.dealerCategory, String(q.dealerCategory)));
        if (q.dealerCode) conds.push(eq(verifiedDealers.dealerCode, String(q.dealerCode)));

        const isSub = booleanish(q.isSubdealer);
        if (isSub !== undefined) {
            conds.push(eq(verifiedDealers.isSubdealer, isSub));
        }

        // Foreign keys
        const userId = numberish(q.userId);
        if (userId !== undefined) {
            conds.push(eq(verifiedDealers.userId, userId));
        }

        if (q.dealerId) {
            conds.push(eq(verifiedDealers.dealerId, String(q.dealerId)));
        }

        if (conds.length === 0) return undefined;
        return conds.length === 1 ? conds[0] : and(...conds);
    };

    const buildSort = (sortByRaw?: string, sortDirRaw?: string) => {
        const direction = (sortDirRaw || '').toLowerCase() === 'desc' ? 'desc' : 'asc';

        switch (sortByRaw) {
            case 'dealerPartyName':
                return direction === 'asc' ? asc(verifiedDealers.dealerPartyName) : desc(verifiedDealers.dealerPartyName);
            case 'zone':
                return direction === 'asc' ? asc(verifiedDealers.zone) : desc(verifiedDealers.zone);
            case 'id':
            default:
                return direction === 'desc' ? desc(verifiedDealers.id) : asc(verifiedDealers.id);
        }
    };

    const listHandler = async (req: Request, res: Response, baseWhere?: SQL) => {
        try {
            const { limit = '50', page = '1', sortBy, sortDir, ...filters } = req.query;
            const lmt = Math.max(1, Math.min(500, parseInt(String(limit), 10) || 50));
            const pg = Math.max(1, parseInt(String(page), 10) || 1);
            const offset = (pg - 1) * lmt;

            const extra = buildWhere(filters);
            
            const conds: SQL[] = [];
            if (baseWhere) conds.push(baseWhere);
            if (extra) conds.push(extra);
            
            const whereCondition: SQL | undefined = conds.length > 0 ? and(...conds) : undefined;
            const orderExpr = buildSort(String(sortBy), String(sortDir));

            const query = db.select({
                ...getTableColumns(verifiedDealers),
                tsoName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
                systemDealerName: dealers.name
            })
            .from(verifiedDealers)
            .leftJoin(users, eq(verifiedDealers.userId, users.id))
            .leftJoin(dealers, eq(verifiedDealers.dealerId, dealers.id));

            if (whereCondition) {
                query.where(whereCondition);
            }

            const data = await query
                .orderBy(orderExpr)
                .limit(lmt)
                .offset(offset);

            res.json({ success: true, page: pg, limit: lmt, count: data.length, data });
        } catch (error) {
            console.error(`Get Verified Dealers list error:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to fetch verified dealers`,
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // 1. GET ALL
    app.get(`/api/${endpoint}`, (req, res) => listHandler(req, res));

    // 2. GET BY ID (Serial/Integer)
    app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
        try {
            const id = numberish(req.params.id);
            if (id === undefined) {
                return res.status(400).json({ success: false, error: 'Invalid ID format' });
            }

            const [record] = await db.select({
                ...getTableColumns(verifiedDealers),
                tsoName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
                systemDealerName: dealers.name
            })
                .from(verifiedDealers)
                .leftJoin(users, eq(verifiedDealers.userId, users.id))
                .leftJoin(dealers, eq(verifiedDealers.dealerId, dealers.id))
                .where(eq(verifiedDealers.id, id))
                .limit(1);

            if (!record) {
                return res.status(404).json({ success: false, error: 'Verified Dealer not found' });
            }

            res.json({ success: true, data: record });
        } catch (error) {
            console.error(`Get Verified Dealer by ID error:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to fetch verified dealer`,
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // 3. GET BY USER ID (TSO)
    app.get(`/api/${endpoint}/user/:userId`, (req, res) => {
        const userId = numberish(req.params.userId);
        if (userId === undefined) {
            return res.status(400).json({ success: false, error: 'Valid User ID is required.' });
        }
        const base = eq(verifiedDealers.userId, userId);
        return listHandler(req, res, base);
    });

    console.log('✅ Verified Dealers GET endpoints setup complete');
}