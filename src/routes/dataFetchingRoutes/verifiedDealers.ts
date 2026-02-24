// server/src/routes/dataFetchingRoutes/verifiedDealers.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
// Removed users and dealers since those relations no longer exist on verifiedDealers
import { verifiedDealers } from '../../db/schema'; 
import { eq, and, desc, asc, SQL, getTableColumns } from 'drizzle-orm';

export default function setupVerifiedDealersGetRoutes(app: Express) {
    const endpoint = 'verified-dealers';

    const numberish = (v: unknown) => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const buildWhere = (q: any): SQL | undefined => {
        const conds: SQL[] = [];

        // New schema string filters
        if (q.zone) conds.push(eq(verifiedDealers.zone, String(q.zone)));
        if (q.area) conds.push(eq(verifiedDealers.area, String(q.area)));
        if (q.district) conds.push(eq(verifiedDealers.district, String(q.district)));
        if (q.state) conds.push(eq(verifiedDealers.state, String(q.state)));
        if (q.dealerSegment) conds.push(eq(verifiedDealers.dealerSegment, String(q.dealerSegment)));
        if (q.gstNo) conds.push(eq(verifiedDealers.gstNo, String(q.gstNo)));
        if (q.contactNo1) conds.push(eq(verifiedDealers.contactNo1, String(q.contactNo1)));

        // New schema foreign key filter
        const salesPromoterId = numberish(q.salesPromoterId);
        if (salesPromoterId !== undefined) {
            conds.push(eq(verifiedDealers.salesPromoterId, salesPromoterId));
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
            case 'district':
                return direction === 'asc' ? asc(verifiedDealers.district) : desc(verifiedDealers.district);
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

            // Removed left joins to users/dealers as the foreign keys were dropped from schema
            const query = db.select().from(verifiedDealers);

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

            // Removed left joins to users/dealers as the foreign keys were dropped from schema
            const [record] = await db.select()
                .from(verifiedDealers)
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

    // 3. GET BY SALES PROMOTER ID (Replaced User ID)
    app.get(`/api/${endpoint}/sales-promoter/:salesPromoterId`, (req, res) => {
        const salesPromoterId = numberish(req.params.salesPromoterId);
        if (salesPromoterId === undefined) {
            return res.status(400).json({ success: false, error: 'Valid Sales Promoter ID is required.' });
        }
        const base = eq(verifiedDealers.salesPromoterId, salesPromoterId);
        return listHandler(req, res, base);
    });

    console.log('✅ Verified Dealers GET endpoints setup complete');
}