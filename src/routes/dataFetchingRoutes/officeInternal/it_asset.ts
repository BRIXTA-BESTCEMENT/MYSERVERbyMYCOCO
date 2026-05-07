// server/src/routes/dataFetchingRoutes/officeInternal/it_asset.ts

import { Request, Response, Express } from 'express';
import { db } from '../../../db/db';
import { itAssets } from '../../../db/schema';

import {
    eq,
    and,
    desc,
    asc,
    SQL,
    gte,
    lte,
    getTableColumns,
    ilike
} from 'drizzle-orm';

export default function setupItAssetsGetRoutes(app: Express) {

    // Helper to build WHERE clause
    const buildWhere = (q: any): SQL | undefined => {
        const conds: SQL[] = [];

        // Item
        if (q.item) {
            conds.push(
                ilike(itAssets.item, `%${String(q.item)}%`)
            );
        }

        // Status
        if (q.status) {
            conds.push(
                eq(itAssets.status, String(q.status))
            );
        }

        // Assigned To
        if (q.assignedTo) {
            conds.push(
                ilike(itAssets.assignedTo, `%${String(q.assignedTo)}%`)
            );
        }

        // Department
        if (q.department) {
            conds.push(
                ilike(itAssets.department, `%${String(q.department)}%`)
            );
        }

        // Stock Status
        if (q.stockStatus) {
            conds.push(
                eq(itAssets.stockStatus, String(q.stockStatus))
            );
        }

        // Place
        if (q.place) {
            conds.push(
                ilike(itAssets.place, `%${String(q.place)}%`)
            );
        }

        // Serial No
        if (q.serialNo) {
            conds.push(
                ilike(itAssets.serialNo, `%${String(q.serialNo)}%`)
            );
        }

        // Generic search
        if (q.search) {
            const s = `%${String(q.search)}%`;

            conds.push(
                ilike(itAssets.item, s) 
            );
        }

        // Date filtering
        const startDate = q.startDate as string | undefined;
        const endDate = q.endDate as string | undefined;

        let dateColumn: any = itAssets.createdAt;

        switch (q.dateField) {
            case 'purchaseDate':
                dateColumn = itAssets.purchaseDate;
                break;

            case 'assignedDate':
                dateColumn = itAssets.assignedDate;
                break;

            case 'handoverDate':
                dateColumn = itAssets.handoverDate;
                break;

            case 'reassignedDate':
                dateColumn = itAssets.reassignedDate;
                break;

            case 'createdAt':
            default:
                dateColumn = itAssets.createdAt;
                break;
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                conds.push(
                    gte(dateColumn, start.toISOString())
                );

                conds.push(
                    lte(dateColumn, end.toISOString())
                );
            } else {
                console.warn('Invalid startDate or endDate for IT Assets filter.');
            }
        }

        if (conds.length === 0) return undefined;

        return conds.length === 1
            ? conds[0]
            : and(...conds);
    };

    // Helper to build ORDER BY clause
    const buildSort = (
        sortByRaw?: string,
        sortDirRaw?: string
    ) => {

        const direction =
            (sortDirRaw || '').toLowerCase() === 'asc'
                ? 'asc'
                : 'desc';

        switch (sortByRaw) {

            case 'item':
                return direction === 'asc'
                    ? asc(itAssets.item)
                    : desc(itAssets.item);

            case 'purchaseDate':
                return direction === 'asc'
                    ? asc(itAssets.purchaseDate)
                    : desc(itAssets.purchaseDate);

            case 'assignedDate':
                return direction === 'asc'
                    ? asc(itAssets.assignedDate)
                    : desc(itAssets.assignedDate);

            case 'status':
                return direction === 'asc'
                    ? asc(itAssets.status)
                    : desc(itAssets.status);

            case 'assignedTo':
                return direction === 'asc'
                    ? asc(itAssets.assignedTo)
                    : desc(itAssets.assignedTo);

            case 'createdAt':
            default:
                return desc(itAssets.createdAt);
        }
    };

    // Generic list handler
    const listHandler = async (
        req: Request,
        res: Response,
        baseWhere?: SQL
    ) => {

        try {

            const {
                limit = '50',
                page = '1',
                sortBy,
                sortDir,
                ...filters
            } = req.query;

            const lmt = Math.max(
                1,
                Math.min(500, parseInt(String(limit), 10) || 50)
            );

            const pg = Math.max(
                1,
                parseInt(String(page), 10) || 1
            );

            const offset = (pg - 1) * lmt;

            const extra = buildWhere(filters);

            const conds: SQL[] = [];

            if (baseWhere) {
                conds.push(baseWhere);
            }

            if (extra !== undefined) {
                conds.push(extra);
            }

            const whereCondition =
                conds.length > 0
                    ? and(...conds)
                    : undefined;

            const orderExpr = buildSort(
                String(sortBy),
                String(sortDir)
            );

            let query = db
                .select({
                    ...getTableColumns(itAssets)
                })
                .from(itAssets)
                .$dynamic();

            if (whereCondition) {
                query = query.where(whereCondition);
            }

            const data = await query
                .orderBy(orderExpr)
                .limit(lmt)
                .offset(offset);

            res.json({
                success: true,
                page: pg,
                limit: lmt,
                count: data.length,
                data
            });

        } catch (error) {

            console.error('Get IT Assets list error:', error);

            res.status(500).json({
                success: false,
                error: 'Failed to fetch IT Assets',
                details:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
            });
        }
    };

    // 1. GET ALL
    app.get('/api/it-assets', (req, res) =>
        listHandler(req, res)
    );

    // 2. GET BY ID
    app.get('/api/it-assets/:id', async (
        req: Request,
        res: Response
    ) => {

        try {

            const { id } = req.params;

            const [record] = await db
                .select({
                    ...getTableColumns(itAssets)
                })
                .from(itAssets)
                .where(eq(itAssets.id, Number(id)))
                .limit(1);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: 'IT Asset not found'
                });
            }

            res.json({
                success: true,
                data: record
            });

        } catch (error) {

            console.error('Get IT Asset by ID error:', error);

            res.status(500).json({
                success: false,
                error: 'Failed to fetch IT Asset',
                details:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
            });
        }
    });

    console.log('✅ IT Assets GET endpoints setup complete');
}