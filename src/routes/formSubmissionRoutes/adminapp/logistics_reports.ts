// src/routes/formSubmissionRoutes/adminapp/logistics_reports.ts

import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { logisticsReports } from "../../../db/schema";
import { v4 as uuidv4 } from "uuid";

export default function setupLogisticsReportsPostRoutes(app: Express) {

    const endpoint =
        "adminapp/logistics-reports";

    // =====================================================
    // POST: ADD LOGISTICS ITEMS
    // =====================================================

    app.post(
        `/api/${endpoint}/:section`,
        async (
            req: Request,
            res: Response
        ) => {

            try {

                const {
                    section
                } = req.params;

                const {
                    reportDate,
                    items
                } = req.body;

                if (
                    !Array.isArray(items) ||
                    items.length === 0
                ) {
                    return res.status(400).json({
                        success: false,
                        error: "Expected items array"
                    });
                }

                const sectionMap: Record<string, string> = {
                    dispatch: "cementDispatchData",
                    stock: "rawMaterialStockData",
                    payment: "transporterPaymentData",
                };

                const targetColumn =
                    sectionMap[section];

                if (!targetColumn) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid section"
                    });
                }

                const payload =
                    items.map((item: any) => ({
                        id: uuidv4(),
                        ...item,
                    }));

                const insertData: any = {
                    reportDate:
                        reportDate ||
                        new Date()
                            .toISOString()
                            .split("T")[0],

                    rawPayload: {},
                };

                insertData[targetColumn] =
                    payload;

                await db
                    .insert(logisticsReports)
                    .values(insertData);

                return res.json({
                    success: true,
                    message:
                        "Logistics items added successfully",
                });

            }

            catch (err) {

                console.error(
                    "[LOGISTICS POST ERROR]",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to add logistics items",
                });

            }

        }
    );

    console.log(
        "✅ Logistics Reports POST endpoints setup complete"
    );

}
