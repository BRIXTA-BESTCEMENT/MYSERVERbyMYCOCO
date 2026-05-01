// src/routes/updateRoutes/adminapp/logistics_reports.ts

import {
    Request,
    Response,
    Express
} from "express";

import { db } from "../../../db/db";

import {
    logisticsReports
} from "../../../db/schema";

import {
    sql
} from "drizzle-orm";

export default function setupLogisticsReportsUpdateRoutes(
    app: Express
) {

    const endpoint =
        "adminapp/logistics-reports";

    // =====================================================
    // UPDATE LOGISTICS ITEM
    // =====================================================

    app.put(
        `/api/${endpoint}/:section/:itemId`,
        async (
            req: Request,
            res: Response
        ) => {

            try {

                const {
                    section,
                    itemId
                } = req.params;

                const payload =
                    req.body;

                const sectionMap: Record<string, any> = {
                    dispatch: logisticsReports.cementDispatchData,
                    stock: logisticsReports.rawMaterialStockData,
                    payment: logisticsReports.transporterPaymentData,
                };

                const targetColumn =
                    sectionMap[section];

                if (!targetColumn) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid section"
                    });
                }

                const updateKeyMap: Record<string, string> = {
                    dispatch: "cementDispatchData",
                    stock: "rawMaterialStockData",
                    payment: "transporterPaymentData",
                };

                const updateKey =
                    updateKeyMap[section];

                const updatePayload: any = {};

                updatePayload[updateKey] = sql`(
                    SELECT COALESCE(
                        jsonb_agg(
                            CASE
                                WHEN elem->>'id' = ${itemId}
                                THEN elem || ${JSON.stringify(payload)}::jsonb
                                ELSE elem
                            END
                        ),
                        '[]'::jsonb
                    )
                    FROM jsonb_array_elements(${targetColumn}) elem
                )`;

                await db
                    .update(logisticsReports)
                    .set(updatePayload)
                    .where(
                        sql`${targetColumn} @> ${JSON.stringify([{ id: itemId }])}::jsonb`
                    );

                return res.json({
                    success: true,
                    message:
                        "Logistics item updated successfully",
                });

            }

            catch (err) {

                console.error(
                    "[LOGISTICS UPDATE ERROR]",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to update logistics item",
                });

            }

        }
    );

    // =====================================================
    // DELETE LOGISTICS ITEM
    // =====================================================

    app.delete(
        `/api/${endpoint}/:section/:itemId`,
        async (
            req: Request,
            res: Response
        ) => {

            try {

                const {
                    section,
                    itemId
                } = req.params;

                const sectionMap: Record<string, any> = {
                    dispatch: logisticsReports.cementDispatchData,
                    stock: logisticsReports.rawMaterialStockData,
                    payment: logisticsReports.transporterPaymentData,
                };

                const targetColumn =
                    sectionMap[section];

                if (!targetColumn) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid section"
                    });
                }

                const updateKeyMap: Record<string, string> = {
                    dispatch: "cementDispatchData",
                    stock: "rawMaterialStockData",
                    payment: "transporterPaymentData",
                };

                const updateKey =
                    updateKeyMap[section];

                const updatePayload: any = {};

                updatePayload[updateKey] = sql`(
                    SELECT COALESCE(
                        jsonb_agg(elem),
                        '[]'::jsonb
                    )
                    FROM jsonb_array_elements(${targetColumn}) elem
                    WHERE elem->>'id' != ${itemId}
                )`;

                await db
                    .update(logisticsReports)
                    .set(updatePayload)
                    .where(
                        sql`${targetColumn} @> ${JSON.stringify([{ id: itemId }])}::jsonb`
                    );

                return res.json({
                    success: true,
                    message:
                        "Logistics item deleted successfully",
                });

            }

            catch (err) {

                console.error(
                    "[LOGISTICS DELETE ERROR]",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to delete logistics item",
                });

            }

        }
    );

    console.log(
        "✅ Logistics Reports Update endpoints setup complete"
    );

}
