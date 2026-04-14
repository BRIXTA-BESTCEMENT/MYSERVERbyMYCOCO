// src/routes/microsoftEmail/adminappReports/sales_reports.ts
import { db } from "../../../db/db";
import { salesReports } from "../../../db/schema";
import { ExcelPayloadBuilder } from "../excelPayloadBuilder";
import { eq } from "drizzle-orm";

export class SalesReportProcessor {
    private excelBuilder = new ExcelPayloadBuilder();

    async processFile(fileBuffer: Buffer, meta: {
        messageId: string;
        fileName: string;
        subject?: string;
    }) {
        const payload = await this.excelBuilder.buildFromBuffer(fileBuffer, {
            messageId: meta.messageId,
            fileName: meta.fileName,
            subject: meta.subject,
            sender: null,
        });

        const extractedSales = this.extractSalesData(payload);

        if (extractedSales.length === 0) {
            console.warn(`[SALES] ⚠️ No sales data found in ${meta.fileName}`);
            return;
        }

        // Sales reports usually lack an exact daily date in the title ("April'26"), 
        // so we default to today's date to sync it with today's collections.
        const reportDate = new Date().toISOString().split("T")[0];

        const [existingReport] = await db
            .select()
            .from(salesReports)
            .where(eq(salesReports.reportDate, reportDate))
            .limit(1);

        if (existingReport) {
            await db.update(salesReports)
                .set({
                    salesDataPayload: extractedSales, // Overwrite sales data for the day
                    sourceFileName: meta.fileName,
                    rawPayload: payload
                })
                .where(eq(salesReports.id, existingReport.id));

            console.log(`[SALES] ✅ Updated Sales report for ${reportDate}`);
        } else {
            await db.insert(salesReports).values({
                reportDate: reportDate,
                rawPayload: payload,
                salesDataPayload: extractedSales,
                collectionDataPayload: [],
                nonTradeDataPayload: [],
                sourceFileName: meta.fileName,
                sourceMessageId: meta.messageId,
            });
            console.log(`[SALES] ✅ Inserted Sales report for ${reportDate}`);
        }
    }

    private extractSalesData(payload: any) {
        let sales: any[] = [];
        const sheet = payload.workbook.sheets[0];
        if (!sheet) return sales;

        const rows = sheet.rows || [];
        let headerIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            const rowText = (rows[i].values || []).join(" ").toLowerCase();
            if (rowText.includes("dealer name") && rowText.includes("area")) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) return sales;

        const headers = rows[headerIndex].values.map((h: any) =>
            String(h || "")
                .toLowerCase()
                .replace(/\n/g, " ")
                .replace(/\s+/g, " ")
                .trim()
        );
        //console.log("Headers: ", headers);

        for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i].values;
            if (!row || row.length === 0) continue;

            const obj: any = {
                dailySales: {},
                total: 0,
                target: 0,
                achievedPercentage: '0%',
                askingRate: 0
            };

            headers.forEach((h: string, idx: number) => {
                const val = row[idx];
                const cleanVal = val?.result ?? val;

                // 1. Basic Info
                if (h === "area") obj.area = val;
                else if (h.includes("distrct") || h.includes("district")) obj.district = val;
                else if (h.includes("dealer name")) obj.dealerName = val;
                else if (h.includes("responsible person")) obj.responsiblePerson = val;

                // 2. MUST check for % or "ach" BEFORE "target" to catch "% Target" or "Ach %"
                else if (h.includes("ach") || h.includes("%")) {
                    let numVal: number | null = null;

                    if (typeof val === 'number') {
                        numVal = val;
                    } else if (val && typeof val === 'object' && 'result' in val) {
                        numVal = Number(val.result);
                    } else {
                        const parsed = parseFloat(String(val).replace('%', ''));
                        if (!isNaN(parsed)) {
                            obj.achievedPercentage = parsed + "%";
                        } else {
                            obj.achievedPercentage = "0%";
                        }
                    }

                    if (numVal !== null) {
                        obj.achievedPercentage = (numVal * 100).toFixed(1) + "%";
                    } else {
                        obj.achievedPercentage = "0%";
                    }
                }

                // 3. Analytical Columns 
                // SALES (MTD)
                else if (
                    h.includes("mtd") ||
                    h.includes("sales mtd") ||
                    h.includes("total sales")
                ) {
                    obj.total = Number(cleanVal) || 0;
                }

                // TARGET
                else if (
                    h.includes("target") &&
                    !h.includes("%")
                ) {
                    obj.target = Number(cleanVal) || 0;
                }

                // ASKING RATE
                else if (
                    h.includes("asking rate")
                ) {
                    obj.askingRate = Number(cleanVal) || 0;
                }

                // ❌ IGNORE OTHER % COLUMNS
                else if (h.includes("%")) {
                    // do nothing (skip "% as per prorata")
                }

                // 4. Date Matching
                else if (h.match(/\d{4}-\d{2}-\d{2}/) || (!isNaN(Number(h)) && Number(h) >= 1 && Number(h) <= 31)) {
                    obj.dailySales[String(h)] = Number(val) || 0;
                }
            });

            if (!obj.dealerName || obj.dealerName.includes("new party")) continue;

            sales.push(obj);
        }

        return sales;
    }
}