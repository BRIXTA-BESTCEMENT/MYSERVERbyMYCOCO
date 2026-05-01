// src/routes/formSubmissionRoutes/adminapp/finance_reports.ts

import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { financeReports } from "../../../db/schema";
import { v4 as uuidv4 } from "uuid";

export default function setupFinanceReportsPostRoutes(app: Express) {

    const endpoint =
        "adminapp/finance-reports";

    // =====================================================
    // POST: ADD SECTION ITEMS
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
                    plbs: "plbsStatus",
                    jsb: "costSheetJSB",
                    jud: "costSheetJUD",
                    investor: "investorQueries",
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
                        particular: item.particular,
                        statuses: item.statuses || {},
                        remarks: item.remarks || "",
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
                    .insert(financeReports)
                    .values(insertData);

                return res.json({
                    success: true,
                    message:
                        "Finance items added successfully",
                });

            }

            catch (err) {

                console.error(
                    "[FINANCE POST ERROR]",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to add finance items",
                });

            }

        }
    );

    console.log(
        "✅ Finance Reports POST endpoints setup complete"
    );

}
