// server/src/routes/formSubmissionRoute/officeInternal/it_asset.ts

import { Request, Response, Express } from 'express';
import { db } from '../../../db/db';
import { itAssets } from '../../../db/schema';

export default function setupItAssetsPostRoutes(app: Express) {

    /**
     * 1. CREATE SINGLE IT ASSET
     * POST /api/it-assets
     */
    app.post('/api/it-assets', async (
        req: Request,
        res: Response
    ) => {

        try {

            const {
                item,
                purchaseDate,
                makeModel,
                serialNo,
                specification,
                stockStatus,
                assignedTo,
                department,
                designation,
                place,
                assignedDate,
                handoverDate,
                status,
                remarks,
                code,
                accessories,
                newUser,
                reassignedDate
            } = req.body;

            // Basic validation
            if (!item) {
                return res.status(400).json({
                    success: false,
                    error: 'Item is required'
                });
            }

            const [created] = await db
                .insert(itAssets)
                .values({
                    item,
                    purchaseDate,
                    makeModel,
                    serialNo,
                    specification,
                    stockStatus,
                    assignedTo,
                    department,
                    designation,
                    place,
                    assignedDate,
                    handoverDate,
                    status,
                    remarks,
                    code,
                    accessories,
                    newUser,
                    reassignedDate
                })
                .returning();

            res.status(201).json({
                success: true,
                message: 'IT Asset created successfully',
                data: created
            });

        } catch (error) {

            console.error('Create IT Asset error:', error);

            res.status(500).json({
                success: false,
                error: 'Failed to create IT Asset',
                details:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
            });
        }
    });

    /**
     * 2. BULK CREATE IT ASSETS
     * POST /api/it-assets/bulk
     */
    app.post('/api/it-assets/bulk', async (
        req: Request,
        res: Response
    ) => {

        try {

            const { data } = req.body;

            if (!Array.isArray(data)) {
                return res.status(400).json({
                    success: false,
                    error: 'data must be an array'
                });
            }

            if (data.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Empty data array'
                });
            }

            const inserted = await db
                .insert(itAssets)
                .values(
                    data.map((row: any) => ({
                        item: row.item,
                        purchaseDate: row.purchaseDate,
                        makeModel: row.makeModel,
                        serialNo: row.serialNo,
                        specification: row.specification,
                        stockStatus: row.stockStatus,
                        assignedTo: row.assignedTo,
                        department: row.department,
                        designation: row.designation,
                        place: row.place,
                        assignedDate: row.assignedDate,
                        handoverDate: row.handoverDate,
                        status: row.status,
                        remarks: row.remarks,
                        code: row.code,
                        accessories: row.accessories,
                        newUser: row.newUser,
                        reassignedDate: row.reassignedDate
                    }))
                )
                .returning();

            res.status(201).json({
                success: true,
                insertedCount: inserted.length,
                data: inserted
            });

        } catch (error) {

            console.error('Bulk Create IT Assets error:', error);

            res.status(500).json({
                success: false,
                error: 'Failed to bulk create IT Assets',
                details:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
            });
        }
    });

    console.log('✅ IT Assets POST endpoints setup complete');
}