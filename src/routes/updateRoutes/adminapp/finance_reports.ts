// src/routes/updateRoutes/adminapp/finance_reports.ts

import {
    Request,
    Response,
    Express
} from "express";

import { db } from "../../../db/db";

import {
    financeReports
} from "../../../db/schema";

import {
    sql
} from "drizzle-orm";

export default function setupFinanceReportsUpdateRoutes(
    app: Express
) {

    const endpoint =
        "adminapp/finance-reports";

    // =====================================================
    // UPDATE FINANCE ITEM
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
                    plbs: financeReports.plbsStatus,
                    jsb: financeReports.costSheetJSB,
                    jud: financeReports.costSheetJUD,
                    investor: financeReports.investorQueries,
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
                    plbs: "plbsStatus",
                    jsb: "costSheetJSB",
                    jud: "costSheetJUD",
                    investor: "investorQueries",
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
                    .update(financeReports)
                    .set(updatePayload)
                    .where(
                        sql`${targetColumn} @> ${JSON.stringify([{ id: itemId }])}::jsonb`
                    );

                return res.json({
                    success: true,
                    message:
                        "Finance item updated successfully",
                });

            }

            catch (err) {

                console.error(
                    "[FINANCE UPDATE ERROR]",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to update finance item",
                });

            }

        }
    );

    // =====================================================
    // DELETE FINANCE ITEM
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
                    plbs: financeReports.plbsStatus,
                    jsb: financeReports.costSheetJSB,
                    jud: financeReports.costSheetJUD,
                    investor: financeReports.investorQueries,
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
                    plbs: "plbsStatus",
                    jsb: "costSheetJSB",
                    jud: "costSheetJUD",
                    investor: "investorQueries",
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
                    .update(financeReports)
                    .set(updatePayload)
                    .where(
                        sql`${targetColumn} @> ${JSON.stringify([{ id: itemId }])}::jsonb`
                    );

                return res.json({
                    success: true,
                    message:
                        "Finance item deleted successfully",
                });

            }

            catch (err) {

                console.error(
                    "[FINANCE DELETE ERROR]",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to delete finance item",
                });

            }

        }
    );

    console.log(
        "✅ Finance Reports Update endpoints setup complete"
    );

}
