// src/routes/microsoftEmail/email/adminappReports/logistics_reports.ts

import { db } from "../../../../db/db";
import { logisticsReports } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../excelPayloadBuilder";
import { eq } from "drizzle-orm";

type CementDispatchRow = {
    area: string;
    targetDispatchQty: number | null;
    achievedDispatchQty: number | null;
    remarks?: string | null;
};

type RawMaterialStockRow = {
    material: string;
    unit: string;
    jsbClosingStock: number | null;
    judClosingStock: number | null;
    totalStock: number | null;
    remarks?: string | null;
};

type TransporterPaymentRow = {
    serialNo: number | null;
    transporterName: string;
    paymentAmount: number | null;
    remarks?: string | null;
};

export class LogisticsReportsProcessor {
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

        const extracted =
            this.extractLogisticsData(
                payload
            );

        const reportDate =
            extracted.reportDate ||
            new Date()
                .toISOString()
                .split("T")[0];

        await db
            .delete(logisticsReports)
            .where(
                eq(
                    logisticsReports.reportDate,
                    reportDate
                )
            );

        await db.insert(logisticsReports).values({
            reportDate,

            sourceFileName:
                meta.fileName,

            sourceMessageId:
                meta.messageId,

            rawPayload: payload,

            cementDispatchData:
                extracted.cementDispatchData,

            rawMaterialStockData:
                extracted.rawMaterialStockData,

            transporterPaymentData:
                extracted.transporterPaymentData,

            parserWarnings:
                extracted.parserWarnings,
        });

        console.log(
            `[LOGISTICS] ✅ Upserted Logistics Report ${reportDate}`
        );
    }

    private extractLogisticsData(
        payload: any
    ) {
        const parserWarnings:
            string[] = [];

        const result = {
            reportDate:
                null as string | null,

            cementDispatchData:
                [] as CementDispatchRow[],

            rawMaterialStockData:
                [] as RawMaterialStockRow[],

            transporterPaymentData:
                [] as TransporterPaymentRow[],

            parserWarnings,
        };

        const sheet =
            payload?.workbook?.sheets?.[0];

        if (!sheet) {
            parserWarnings.push(
                "No sheets found"
            );

            return result;
        }

        const rows =
            sheet.rows || [];

        for (const row of rows) {
            const values =
                row.values || [];

            for (const val of values) {
                const str =
                    String(val || "");

                const match =
                    str.match(
                        /(\d{1,2})\/(\d{1,2})\/(\d{4})/
                    );

                if (match) {
                    const [
                        _,
                        dd,
                        mm,
                        yyyy,
                    ] = match;

                    result.reportDate =
                        `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

                    break;
                }
            }

            if (
                result.reportDate
            )
                break;
        }

        const tableIndexes: {
            index: number;
            title: string;
        }[] = [];

        rows.forEach(
            (
                row: any,
                idx: number
            ) => {
                const rowText = (
                    row.values || []
                )
                    .join(" ")
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

                if (
                    /^\d+\./.test(
                        rowText
                    )
                ) {
                    tableIndexes.push({
                        index: idx,
                        title:
                            rowText,
                    });
                }
            }
        );

        for (
            let t = 0;
            t <
            tableIndexes.length;
            t++
        ) {
            const current =
                tableIndexes[t];

            const next =
                tableIndexes[
                t + 1
                ];

            const startRow =
                current.index;

            const endRow =
                next?.index ||
                rows.length;

            const title =
                current.title.toLowerCase();

            if (
                title.includes(
                    "cement dispatch"
                )
            ) {
                result.cementDispatchData =
                    this.parseCementDispatchTable(
                        rows,
                        startRow,
                        endRow
                    );
            }

            else if (
                title.includes(
                    "raw materials"
                )
            ) {
                result.rawMaterialStockData =
                    this.parseRawMaterialTable(
                        rows,
                        startRow,
                        endRow
                    );
            }

            else if (
                title.includes(
                    "transporter payments"
                )
            ) {
                result.transporterPaymentData =
                    this.parseTransporterPaymentsTable(
                        rows,
                        startRow,
                        endRow
                    );
            }
        }

        return result;
    }

    private getCell(
        row: any[],
        index: number
    ) {
        if (
            index < 0 ||
            index >= row.length
        ) {
            return null;
        }

        const val =
            row[index];

        if (
            val &&
            typeof val ===
            "object" &&
            "result" in val
        ) {
            return val.result;
        }

        return val;
    }

    private cleanString(
        value: any
    ): string {
        return String(
            value || ""
        )
            .replace(
                /\n/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    private parseCementDispatchTable(
        rows: any[],
        startRow: number,
        endRow: number
    ): CementDispatchRow[] {
        const results:
            CementDispatchRow[] =
            [];

        let headerIndex =
            -1;

        for (
            let i = startRow;
            i < endRow;
            i++
        ) {
            const rowText = (
                rows[i]
                    ?.values ||
                []
            )
                .join(" ")
                .toLowerCase();

            if (
                rowText.includes(
                    "area"
                ) &&
                rowText.includes(
                    "target"
                )
            ) {
                headerIndex = i;
                break;
            }
        }

        if (
            headerIndex === -1
        )
            return results;

        const headers =
            rows[
                headerIndex
            ].values.map(
                (h: any) =>
                    this.cleanString(
                        h
                    ).toLowerCase()
            );

        const areaCol =
            headers.findIndex((h: any) =>
                h.includes(
                    "area"
                )
            );

        const targetCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "target"
                    )
            );

        const achievedCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "ach"
                    )
            );

        const remarksCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "remark"
                    )
            );

        for (
            let i =
                headerIndex +
                1;
            i < endRow;
            i++
        ) {
            const row =
                rows[i]
                    ?.values ||
                [];

            if (
                !row.length
            )
                continue;

            const firstCell =
                this.cleanString(
                    row[0]
                ).toLowerCase();

            if (
                firstCell ===
                "total"
            ) {
                break;
            }

            const obj: CementDispatchRow =
            {
                area:
                    this.cleanString(
                        this.getCell(
                            row,
                            areaCol
                        )
                    ),

                targetDispatchQty:
                    Number(
                        this.getCell(
                            row,
                            targetCol
                        )
                    ) ||
                    0,

                achievedDispatchQty:
                    Number(
                        this.getCell(
                            row,
                            achievedCol
                        )
                    ) ||
                    0,

                remarks:
                    this.cleanString(
                        this.getCell(
                            row,
                            remarksCol
                        )
                    ),
            };

            if (
                !obj.area ||
                obj.area
                    .toLowerCase()
                    .includes(
                        "area"
                    )
            ) {
                continue;
            }

            results.push(
                obj
            );
        }

        return results;
    }

    private parseRawMaterialTable(
        rows: any[],
        startRow: number,
        endRow: number
    ): RawMaterialStockRow[] {
        const results:
            RawMaterialStockRow[] =
            [];

        let headerIndex =
            -1;

        for (
            let i = startRow;
            i < endRow;
            i++
        ) {
            const rowText = (
                rows[i]
                    ?.values ||
                []
            )
                .join(" ")
                .toLowerCase();

            if (
                rowText.includes(
                    "material"
                ) &&
                rowText.includes(
                    "closing stock"
                )
            ) {
                headerIndex = i;
                break;
            }
        }

        if (
            headerIndex === -1
        )
            return results;

        const headers =
            rows[
                headerIndex
            ].values.map(
                (h: any) =>
                    this.cleanString(
                        h
                    ).toLowerCase()
            );

        const materialCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "material"
                    )
            );

        const unitCol =
            headers.findIndex(
                (h: any) =>
                    h ===
                    "unit"
            );

        const jsbCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "jsb"
                    )
            );

        const judCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "jud"
                    )
            );

        const totalCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "total"
                    )
            );

        const remarksCol =
            headers.findIndex(
                (h: any) =>
                    h.includes(
                        "remark"
                    )
            );

        for (
            let i =
                headerIndex +
                1;
            i < endRow;
            i++
        ) {
            const row =
                rows[i]
                    ?.values ||
                [];

            if (
                !row.length
            )
                continue;

            const firstCell =
                this.cleanString(
                    row[0]
                ).toLowerCase();

            if (
                firstCell ===
                "total"
            ) {
                break;
            }

            const obj: RawMaterialStockRow =
            {
                material:
                    this.cleanString(
                        this.getCell(
                            row,
                            materialCol
                        )
                    ),

                unit:
                    this.cleanString(
                        this.getCell(
                            row,
                            unitCol
                        )
                    ),

                jsbClosingStock:
                    Number(
                        this.getCell(
                            row,
                            jsbCol
                        )
                    ) ||
                    0,

                judClosingStock:
                    Number(
                        this.getCell(
                            row,
                            judCol
                        )
                    ) ||
                    0,

                totalStock:
                    Number(
                        this.getCell(
                            row,
                            totalCol
                        )
                    ) ||
                    0,

                remarks:
                    this.cleanString(
                        this.getCell(
                            row,
                            remarksCol
                        )
                    ),
            };

            const lower =
                obj.material.toLowerCase();

            if (
                !obj.material ||
                lower ===
                "material" ||
                lower.includes(
                    "remark"
                ) ||
                lower.includes(
                    "stock"
                )
            ) {
                continue;
            }

            results.push(
                obj
            );
        }

        return results;
    }

    private parseTransporterPaymentsTable(
        rows: any[],
        startRow: number,
        endRow: number
    ): TransporterPaymentRow[] {
        const results:
            TransporterPaymentRow[] =
            [];

        let headerIndex =
            -1;

        for (
            let i = startRow;
            i < endRow;
            i++
        ) {
            const rowText = (
                rows[i]
                    ?.values ||
                []
            )
                .join(" ")
                .toLowerCase();

            if (
                rowText.includes(
                    "transporter"
                ) &&
                rowText.includes(
                    "payment"
                )
            ) {
                headerIndex = i;
                break;
            }
        }

        if (
            headerIndex === -1
        )
            return results;

        for (
            let i =
                headerIndex +
                1;
            i < endRow;
            i++
        ) {
            const row =
                rows[i]
                    ?.values ||
                [];

            if (
                !row.length
            )
                continue;

            const cleanValues =
                row
                    .map(
                        (
                            v: any
                        ) =>
                            this.cleanString(
                                this.getCell(
                                    row,
                                    row.indexOf(
                                        v
                                    )
                                )
                            )
                    )
                    .filter(
                        (
                            v: string
                        ) =>
                            v !==
                            ""
                    );

            if (
                cleanValues.length ===
                0
            ) {
                continue;
            }

            const first =
                cleanValues[0]
                    ?.toLowerCase()
                    .trim();

            if (
                first ===
                "total"
            ) {
                break;
            }

            if (
                cleanValues.length <
                2
            ) {
                continue;
            }

            const serialNo =
                Number(
                    cleanValues[0]
                ) || null;

            const paymentAmount =
                Number(
                    cleanValues[
                    cleanValues.length -
                    1
                    ]
                ) || null;

            const obj: TransporterPaymentRow =
            {
                serialNo,

                transporterName:
                    "",

                paymentAmount,

                remarks:
                    null,
            };

            results.push(
                obj
            );
        }

        return results;
    }
}
