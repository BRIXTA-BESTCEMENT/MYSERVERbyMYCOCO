// server/src/routes/updateRoute/officeInternal/it_asset.ts

import { Request, Response, Express } from 'express';
import { db } from '../../../db/db';
import { itAssets } from '../../../db/schema';

import {
    eq
} from 'drizzle-orm';

export default function setupItAssetsUpdateRoutes(app: Express) {

    /**
     * 1. FULL UPDATE
     * PUT /api/it-assets/:id
     */
    app.put('/api/it-assets/:id', async (
        req: Request,
        res: Response
    ) => {

        try {

            const id = Number(req.params.id);

            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid ID'
                });
            }

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

            const [updated] = await db
                .update(itAssets)
                .set({
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
                    reassignedDate,
                    updatedAt: new Date()
                })
                .where(eq(itAssets.id, id))
                .returning();

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'IT Asset not found'
                });
            }

            res.json({
                success: true,
                message: 'IT Asset updated successfully',
                data: updated
            });

        } catch (error) {

            console.error('PUT IT Asset error:', error);

            res.status(500).json({
                success: false,
                error: 'Failed to update IT Asset',
                details:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
            });
        }
    });

    /**
     * 2. PARTIAL UPDATE
     * PATCH /api/it-assets/:id
     */
    app.patch('/api/it-assets/:id', async (
        req: Request,
        res: Response
    ) => {

        try {

            const id = Number(req.params.id);

            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid ID'
                });
            }

            const allowedFields = [
                'item',
                'purchaseDate',
                'makeModel',
                'serialNo',
                'specification',
                'stockStatus',
                'assignedTo',
                'department',
                'designation',
                'place',
                'assignedDate',
                'handoverDate',
                'status',
                'remarks',
                'code',
                'accessories',
                'newUser',
                'reassignedDate'
            ];

            const updateData: Record<string, any> = {};

            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    updateData[key] = req.body[key];
                }
            }

            updateData.updatedAt = new Date();

            if (Object.keys(updateData).length === 1) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid fields provided for update'
                });
            }

            const [updated] = await db
                .update(itAssets)
                .set(updateData)
                .where(eq(itAssets.id, id))
                .returning();

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'IT Asset not found'
                });
            }

            res.json({
                success: true,
                message: 'IT Asset patched successfully',
                data: updated
            });

        } catch (error) {

            console.error('PATCH IT Asset error:', error);

            res.status(500).json({
                success: false,
                error: 'Failed to patch IT Asset',
                details:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
            });
        }
    });

    console.log('✅ IT Assets UPDATE endpoints setup complete');
}