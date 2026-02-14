// server/src/routes/dataFetchingRoutes/outstandingReports.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { outstandingReports, verifiedDealers, } from '../../db/schema'; 
import { eq, and, desc, asc, SQL, getTableColumns } from 'drizzle-orm';

export default function setupOutstandingReportsGetRoutes(app: Express) {
    const endpoint = 'outstanding-reports';

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

        // Foreign Key filters
        const dealerId = numberish(q.verifiedDealerId);
        if (dealerId !== undefined) {
            conds.push(eq(outstandingReports.verifiedDealerId, dealerId));
        }

        if (q.collectionReportId) {
            conds.push(eq(outstandingReports.collectionReportId, String(q.collectionReportId)));
        }

        if (q.dvrId) {
            conds.push(eq(outstandingReports.dvrId, String(q.dvrId)));
        }

        // Boolean filters
        const isOverdue = booleanish(q.isOverdue);
        if (isOverdue !== undefined) {
            conds.push(eq(outstandingReports.isOverdue, isOverdue));
        }

        const isAccountJsbJud = booleanish(q.isAccountJsbJud);
        if (isAccountJsbJud !== undefined) {
            conds.push(eq(outstandingReports.isAccountJsbJud, isAccountJsbJud));
        }

        if (conds.length === 0) return undefined;
        return conds.length === 1 ? conds[0] : and(...conds);
    };

    const buildSort = (sortByRaw?: string, sortDirRaw?: string) => {
        const direction = (sortDirRaw || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

        switch (sortByRaw) {
            case 'securityDepositAmt':
                return direction === 'asc' ? asc(outstandingReports.securityDepositAmt) : desc(outstandingReports.securityDepositAmt);
            case 'pendingAmt':
                return direction === 'asc' ? asc(outstandingReports.pendingAmt) : desc(outstandingReports.pendingAmt);
            case 'createdAt':
            default:
                return desc(outstandingReports.createdAt);
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

            // Execute Query with basic verified dealer join
            const query = db.select({
                ...getTableColumns(outstandingReports),
                dealerPartyName: verifiedDealers.dealerPartyName,
                dealerCode: verifiedDealers.dealerCode,
                zone: verifiedDealers.zone
            })
            .from(outstandingReports)
            .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id));

            if (whereCondition) {
                query.where(whereCondition);
            }

            const data = await query
                .orderBy(orderExpr)
                .limit(lmt)
                .offset(offset);

            res.json({ success: true, page: pg, limit: lmt, count: data.length, data });
        } catch (error) {
            console.error(`Get Outstanding Reports list error:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to fetch outstanding reports`,
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // 1. GET ALL
    app.get(`/api/${endpoint}`, (req, res) => listHandler(req, res));

    // 2. GET BY ID (UUID)
    app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const [record] = await db.select({
                ...getTableColumns(outstandingReports),
                dealerPartyName: verifiedDealers.dealerPartyName,
                dealerCode: verifiedDealers.dealerCode,
            })
                .from(outstandingReports)
                .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id))
                .where(eq(outstandingReports.id, id))
                .limit(1);

            if (!record) {
                return res.status(404).json({ success: false, error: 'Outstanding Report not found' });
            }

            res.json({ success: true, data: record });
        } catch (error) {
            console.error(`Get Outstanding Report by ID error:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to fetch outstanding report`,
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // 3. GET BY VERIFIED DEALER ID
    app.get(`/api/${endpoint}/dealer/:dealerId`, (req, res) => {
        const dealerId = numberish(req.params.dealerId);
        if (dealerId === undefined) {
            return res.status(400).json({ success: false, error: 'Valid Dealer ID is required.' });
        }
        const base = eq(outstandingReports.verifiedDealerId, dealerId);
        return listHandler(req, res, base);
    });

    console.log('✅ Outstanding Reports GET endpoints setup complete');
}