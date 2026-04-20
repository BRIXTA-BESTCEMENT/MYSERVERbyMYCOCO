// src/routes/microsoftEmail/email/adminappReports/outstanding_reports.ts

import { db } from "../../../../db/db";
import { outstandingReports, verifiedDealers } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../../email/excelPayloadBuilder";
import { ilike, eq, and } from "drizzle-orm";

export class OutstandingReportsProcessor {
    private excelBuilder = new ExcelPayloadBuilder();

    async processFile(
        fileBuffer: Buffer,
        meta: {
            messageId: string;
            fileName: string;
            subject?: string;
        }
    ) {
        /* =========================================================
           1️⃣ BUILD PAYLOAD
        ========================================================= */
        const payload = await this.excelBuilder.buildFromBuffer(fileBuffer, {
            messageId: meta.messageId,
            fileName: meta.fileName,
            subject: meta.subject,
            sender: null,
        });

        /* =========================================================
           2️⃣ EXTRACT DATA
        ========================================================= */
        const extracted = await this.extractOutstandingData(payload, meta);

        if (extracted.length === 0) {
            console.warn(`[OUTSTANDING] ⚠️ No data found in ${meta.fileName}`);
            return;
        }

        const reportDate =
            this.extractReportDate(meta.fileName) ||
            new Date().toISOString().split("T")[0];

        const institution =
            extracted.find(r => r.institution)?.institution || "UNKNOWN";

        /* =========================================================
           3️⃣ UPSERT (DELETE + INSERT)
        ========================================================= */

        await db
            .delete(outstandingReports)
            .where(
                and(
                    eq(outstandingReports.reportDate, reportDate),
                )
            );

        await db.insert(outstandingReports).values(
            extracted.map((row) => ({
                reportDate,
                dealerName: row.dealerName,

                pendingAmt: row.pendingAmt,
                securityDepositAmt: row.securityDepositAmt,

                ageingData: row.ageingData,

                institution: row.institution,
                verifiedDealerId: row.verifiedDealerId,

                sourceFileName: meta.fileName,
                sourceMessageId: meta.messageId,
            }))
        );

        console.log(
            `[OUTSTANDING] ✅ Upserted ${extracted.length} rows for ${reportDate} (${institution})`
        );
    }

    /* =========================================================
       🔍 EXTRACTION LOGIC
    ========================================================= */

    private async extractOutstandingData(payload: any, meta: any) {
        const results: any[] = [];

        const sheet = payload.workbook.sheets[0];
        if (!sheet) return results;

        const rows = sheet.rows || [];

        /* ---------------- FIND HEADER ---------------- */

        let headerIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            const rowText = (rows[i].values || []).join(" ").toLowerCase();

            if (
                rowText.includes("dealer") &&
                (rowText.includes("pending") || rowText.includes("outstanding"))
            ) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            console.warn("[OUTSTANDING] ❌ Header not found");
            return results;
        }

        const headers = rows[headerIndex].values.map((h: any) =>
            String(h || "")
                .toLowerCase()
                .replace(/\n/g, " ")
                .replace(/\s+/g, " ")
                .trim()
        );

        /* ---------------- DETECT AGEING COLUMNS ---------------- */

        const ageingCols = headers.filter(
            (h: string) =>
                h.includes("-") || h.includes("+") || h.includes("days")
        );

        /* ---------------- PRELOAD DEALERS (NO N+1) ---------------- */

        const dealers = await db.select().from(verifiedDealers);

        function findDealer(name: string) {
            const clean = name.toLowerCase().trim();
            return dealers.find((d) =>
                d.dealerPartyName?.toLowerCase().includes(clean)
            );
        }

        /* ---------------- DETECT INSTITUTION ---------------- */

        const institution = this.detectInstitution(meta.fileName);

        /* ---------------- PROCESS ROWS ---------------- */

        for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i].values;
            if (!row || row.length === 0) continue;

            const obj: any = {
                ageingData: {},
                pendingAmt: 0,
                securityDepositAmt: 0,
                dealerName: null,
                institution: null,
            };

            headers.forEach((h: string, idx: number) => {
                const val = row[idx];
                const cleanVal =
                    typeof val === "object" && val !== null && "result" in val
                        ? val.result
                        : val;

                // Dealer
                if (h.includes("dealer") || h.includes("customer")) {
                    obj.dealerName = String(cleanVal || "").trim();
                }

                // Pending
                else if (h.includes("pending") || h.includes("outstanding")) {
                    obj.pendingAmt = Number(cleanVal) || 0;
                }

                // Security
                else if (h.includes("security")) {
                    obj.securityDepositAmt = Number(cleanVal) || 0;
                }

                // Ageing buckets
                else if (ageingCols.includes(h)) {
                    obj.ageingData[h] = Number(cleanVal) || 0;
                }

                // institution JUD/JSB
                else if (h.includes("institution")) {
                    const inst = String(cleanVal || "").toUpperCase().trim();
                    if (inst === "JUD" || inst === "JSB") {
                        obj.institution = inst;
                    }
                }
            });

            if (!obj.dealerName) continue;

            if (!obj.institution) {
                obj.institution = this.detectInstitution(meta.fileName);
            }

            /* ---------------- DEALER MATCH ---------------- */

            const dealer = findDealer(obj.dealerName);
            obj.verifiedDealerId = dealer?.id ?? null;

            results.push(obj);
        }

        return results;
    }

    /* =========================================================
       🏢 INSTITUTION DETECTION
    ========================================================= */

    private detectInstitution(fileName: string): string {
        const name = fileName.toLowerCase();

        if (name.includes("jud")) return "JUD";
        if (name.includes("jsb")) return "JSB";

        return "UNKNOWN";
    }

    /* =========================================================
       📅 DATE FROM FILE NAME
    ========================================================= */

    private extractReportDate(fileName: string): string | null {
        if (!fileName) return null;

        const match =
            fileName.match(/(\d{2})[-.](\d{2})[-.](\d{2,4})/) ||
            fileName.match(/(\d{2})\.(\d{2})\.(\d{4})/);

        if (!match) return null;

        let [_, dd, mm, yyyy] = match;

        if (yyyy.length === 2) {
            yyyy = "20" + yyyy;
        }

        return `${yyyy}-${mm}-${dd}`;
    }
}