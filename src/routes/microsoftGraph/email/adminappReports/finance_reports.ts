// src/routes/microsoftEmail/email/adminappReports/finance_reports.ts

import { db } from "../../../../db/db";
import { financeReports } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../excelPayloadBuilder";
import { eq } from "drizzle-orm";

type FinanceRow = {
    particular: string;
    statuses: Record<string, any>;
    remarks?: string | null;
};

const SECTION_MAP: Record<string, string> = {
    "P&L & BS STATUS":
        "plbsStatus",

    "COST SHEET - JSB":
        "costSheetJSB",

    "COST SHEET - JUD":
        "costSheetJUD",

    "INVESTOR QUERIES":
        "investorQueries",
};

export class FinanceReportsProcessor {
    private excelBuilder =
        new ExcelPayloadBuilder();

    async processFile(
        fileBuffer: Buffer,
        meta: {
            messageId: string;
            fileName: string;
            subject?: string;
        }
    ) {
        const payload =
            await this.excelBuilder.buildFromBuffer(
                fileBuffer,
                {
                    messageId: meta.messageId,
                    fileName: meta.fileName,
                    subject: meta.subject,
                    sender: null,
                }
            );

        const parsed =
            this.extractFinanceData(payload);

        const reportDate =
            parsed.reportDate ||
            new Date()
                .toISOString()
                .split("T")[0];

        await db
            .delete(financeReports)
            .where(
                eq(
                    financeReports.reportDate,
                    reportDate
                )
            );

        await db.insert(financeReports).values({
            reportDate,

            sourceFileName:
                meta.fileName,

            sourceMessageId:
                meta.messageId,

            rawPayload: payload,

            detectedMonths:
                parsed.detectedMonths,

            plbsStatus:
                parsed.plbsStatus,

            costSheetJSB:
                parsed.costSheetJSB,

            costSheetJUD:
                parsed.costSheetJUD,

            investorQueries:
                parsed.investorQueries,

            parserWarnings:
                parsed.parserWarnings,
        });

        console.log(
            `[FINANCE] ✅ Upserted Finance Report ${reportDate}`
        );
    }

    private extractFinanceData(
        payload: any
    ) {
        const result = {
            reportDate: null as string | null,

            detectedMonths:
                [] as string[],

            plbsStatus:
                [] as FinanceRow[],

            costSheetJSB:
                [] as FinanceRow[],

            costSheetJUD:
                [] as FinanceRow[],

            investorQueries:
                [] as FinanceRow[],

            parserWarnings:
                [] as string[],
        };

        const sheet =
            payload?.workbook?.sheets?.[0];

        if (!sheet) {
            result.parserWarnings.push(
                "No sheets found"
            );

            return result;
        }

        const rows =
            sheet.rows || [];

        let headerIndex = -1;

        for (
            let i = 0;
            i < rows.length;
            i++
        ) {
            const rowText = (
                rows[i]?.values || []
            )
                .join(" ")
                .toLowerCase();

            if (
                rowText.includes(
                    "particular"
                ) &&
                rowText.includes(
                    "remark"
                )
            ) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            result.parserWarnings.push(
                "Header row not found"
            );

            return result;
        }

        const headers =
            rows[
                headerIndex
            ].values.map((h: any) =>
                String(h || "")
                    .replace(/\s+/g, " ")
                    .trim()
            );

        const sectionCol =
            headers.findIndex((h : any) =>
                h.toLowerCase().includes(
                    "section"
                )
            );

        const particularsCol =
            headers.findIndex((h : any) =>
                h.toLowerCase().includes(
                    "particular"
                )
            );

        const remarksCol =
            headers.findIndex((h : any) =>
                h.toLowerCase().includes(
                    "remark"
                )
            );

        const monthCols: {
            index: number;
            label: string;
        }[] = [];

        headers.forEach(
            (h: string, idx: number) => {
                const lower =
                    h.toLowerCase();

                if (
                    lower.includes(
                        "status"
                    )
                ) {
                    monthCols.push({
                        index: idx,
                        label:
                            h.replace(
                                /status/i,
                                ""
                            ).trim(),
                    });
                }
            }
        );

        result.detectedMonths =
            monthCols.map(
                m => m.label
            );

        let currentSection =
            "";

        for (
            let i = headerIndex + 1;
            i < rows.length;
            i++
        ) {
            const values =
                rows[i]?.values || [];

            const sectionValue =
                String(
                    values[
                        sectionCol
                    ] || ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            const particularsValue =
                String(
                    values[
                        particularsCol
                    ] || ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            if (sectionValue) {
                const normalized =
                    sectionValue.toUpperCase();

                if (
                    SECTION_MAP[
                        normalized
                    ]
                ) {
                    currentSection =
                        SECTION_MAP[
                            normalized
                        ];

                    continue;
                }
            }

            if (
                !currentSection
            ) {
                continue;
            }

            if (
                !particularsValue &&
                !sectionValue
            ) {
                continue;
            }

            const statuses:
                Record<
                    string,
                    any
                > = {};

            monthCols.forEach(
                month => {
                    statuses[
                        month.label
                    ] =
                        values[
                            month.index
                        ] || "";
                }
            );

            const rowObj: FinanceRow =
                {
                    particular:
                        particularsValue,

                    statuses,

                    remarks:
                        values[
                            remarksCol
                        ] || "",
                };

            (
                result as any
            )[currentSection].push(
                rowObj
            );
        }

        return result;
    }
}
