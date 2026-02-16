// server/src/routes/dataFetchingRoutes/outstandingReports.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { outstandingReports, verifiedDealers } from '../../db/schema'; 
import { eq, and, desc, asc, SQL, getTableColumns, gte, lte, sql, ilike, or } from 'drizzle-orm';

export default function setupOutstandingReportsGetRoutes(app: Express) {
    const endpoint = 'outstanding-reports';

    // --- Helpers ---
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

    // --- Query Builders ---
    const buildWhere = (q: any): SQL | undefined => {
        const conds: SQL[] = [];

        // 1. ID Filters
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

        // 2. Boolean Filters
        const isOverdue = booleanish(q.isOverdue);
        if (isOverdue !== undefined) {
            conds.push(eq(outstandingReports.isOverdue, isOverdue));
        }

        const isAccountJsbJud = booleanish(q.isAccountJsbJud);
        if (isAccountJsbJud !== undefined) {
            conds.push(eq(outstandingReports.isAccountJsbJud, isAccountJsbJud));
        }

        // 3. Date Filters
        if (q.reportDate) {
            conds.push(eq(outstandingReports.reportDate, String(q.reportDate)));
        }

        const fromDate = q.fromDate as string | undefined;
        const toDate = q.toDate as string | undefined;

        if (fromDate) conds.push(gte(outstandingReports.reportDate, fromDate));
        if (toDate) conds.push(lte(outstandingReports.reportDate, toDate));

        // 4. Search (Temp Dealer Name)
        if (q.search) {
            const searchStr = `%${q.search}%`;
            conds.push(ilike(outstandingReports.tempDealerName, searchStr));
        }

        if (conds.length === 0) return undefined;
        return conds.length === 1 ? conds[0] : and(...conds);
    };

    const buildSort = (sortByRaw?: string, sortDirRaw?: string) => {
        const direction = (sortDirRaw || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
        const sortFn = direction === 'asc' ? asc : desc;

        switch (sortByRaw) {
            case 'securityDepositAmt': return sortFn(outstandingReports.securityDepositAmt);
            case 'pendingAmt': return sortFn(outstandingReports.pendingAmt);
            case 'reportDate': return sortFn(outstandingReports.reportDate);
            
            // Aging Buckets Sorting
            case 'lessThan10Days': return sortFn(outstandingReports.lessThan10Days);
            case 'days10To15': return sortFn(outstandingReports.days10To15);
            case 'days15To21': return sortFn(outstandingReports.days15To21);
            case 'days21To30': return sortFn(outstandingReports.days21To30);
            case 'days30To45': return sortFn(outstandingReports.days30To45);
            case 'days45To60': return sortFn(outstandingReports.days45To60);
            case 'days60To75': return sortFn(outstandingReports.days60To75);
            case 'days75To90': return sortFn(outstandingReports.days75To90);
            case 'greaterThan90Days': return sortFn(outstandingReports.greaterThan90Days);
            
            case 'updatedAt': return sortFn(outstandingReports.updatedAt);
            case 'createdAt': 
            default:
                return desc(outstandingReports.createdAt);
        }
    };

    // --- Main Handler ---
    const listHandler = async (req: Request, res: Response, baseWhere?: SQL) => {
        try {
            const { limit = '50', page = '1', sortBy, sortDir, ...filters } = req.query;
            const lmt = Math.max(1, Math.min(500, parseInt(String(limit), 10) || 50));
            const pg = Math.max(1, parseInt(String(page), 10) || 1);
            const offset = (pg - 1) * lmt;

            // Combine filters
            const extra = buildWhere(filters);
            const conds: SQL[] = [];
            if (baseWhere) conds.push(baseWhere);
            if (extra) conds.push(extra);
            
            const whereCondition: SQL | undefined = conds.length > 0 ? and(...conds) : undefined;
            const orderExpr = buildSort(String(sortBy), String(sortDir));

            // 1. Get Data
            const dataQuery = db.select({
                ...getTableColumns(outstandingReports),
                dealerPartyName: verifiedDealers.dealerPartyName,
                dealerCode: verifiedDealers.dealerCode,
                zone: verifiedDealers.zone
            })
            .from(outstandingReports)
            .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id));

            if (whereCondition) {
                dataQuery.where(whereCondition);
            }

            const data = await dataQuery
                .orderBy(orderExpr)
                .limit(lmt)
                .offset(offset);

            // 2. Get Total Count (for pagination)
            // Note: We use a separate query to get the true total matching the filters
            const countQuery = db.select({ count: sql<number>`count(*)` })
                .from(outstandingReports)
                .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id)); // Join needed if we filter by dealer props later

            if (whereCondition) {
                countQuery.where(whereCondition);
            }
            
            const [totalRes] = await countQuery;
            const total = Number(totalRes?.count || 0);
            const totalPages = Math.ceil(total / lmt);

            res.json({ 
                success: true, 
                page: pg, 
                limit: lmt, 
                total,       // Total matching records
                totalPages,  // Total pages available
                count: data.length, // Count on this specific page
                data 
            });

        } catch (error) {
            console.error(`Get Outstanding Reports list error:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to fetch outstanding reports`,
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // --- Routes ---

    // 1. GET ALL (with filters)
    app.get(`/api/${endpoint}`, (req, res) => listHandler(req, res));

    // 2. GET BY ID (UUID)
    app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const [record] = await db.select({
                ...getTableColumns(outstandingReports),
                dealerPartyName: verifiedDealers.dealerPartyName,
                dealerCode: verifiedDealers.dealerCode,
                zone: verifiedDealers.zone
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