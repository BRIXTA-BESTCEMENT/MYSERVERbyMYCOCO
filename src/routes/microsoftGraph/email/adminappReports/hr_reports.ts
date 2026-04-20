// src/routes/microsoftEmail/email/adminappReports/hr_reports.ts
import { db } from "../../../../db/db";
import { hrReports } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { ExcelPayloadBuilder } from "../../email/excelPayloadBuilder";

export class HrReportsProcessor {
    private excelBuilder = new ExcelPayloadBuilder();

    async processFile(fileBuffer: Buffer, meta: {
        messageId: string;
        fileName: string;
        subject?: string;
    }) {
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
        const extracted = this.extractHrData(payload);

        const reportDate =
            this.extractReportDate(meta.fileName) ||
            new Date().toISOString().split("T")[0];

        /* =========================================================
           3️⃣ UPSERT (DELETE + INSERT)
        ========================================================= */

        // delete existing report for same date
        await db
            .delete(hrReports)
            .where(eq(hrReports.reportDate, reportDate));

        // insert fresh
        await db.insert(hrReports).values({
            reportDate,

            rawPayload: payload,

            vacancies: extracted.vacancies,
            statutoryClearances: extracted.statutory,

            topPerformers: [],
            bottomPerformers: [],
            interviews: [],

            sourceFileName: meta.fileName,
            sourceMessageId: meta.messageId,
        });

        console.log(`[HR] ✅ Upserted HR report for ${reportDate}`);
    }

    /* =========================================================
       🔍 CORE EXTRACTION LOGIC
    ========================================================= */
    private extractHrData(payload: any) {
        let vacancies: any[] = [];

        const sheet = payload.workbook.sheets.find(
            (s: any) => s.name.toLowerCase().includes("tba")
        );

        if (!sheet) {
            console.warn("[HR] ❌ TBA sheet not found");
            return { vacancies: null, statutory: null };
        }

        const rows = sheet.rows || [];

        // 🔍 Find header row
        let headerIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            const rowText = (rows[i].values || []).join(" ").toLowerCase();

            if (rowText.includes("position") && rowText.includes("department")) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            console.warn("[HR] ❌ Header row not found");
            return { vacancies: null, statutory: null };
        }

        const headers = rows[headerIndex].values.map((h: any) =>
            String(h || "").toLowerCase()
        );

        // 🔥 Parse data rows
        for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i].values;

            if (!row || row.length === 0) continue;

            const obj: any = {};

            headers.forEach((h: string, idx: number) => {
                const val = row[idx];

                if (h.includes("position")) obj.position = val;
                if (h.includes("department")) obj.department = val;
                if (h.includes("vacant")) obj.vacantNos = Number(val || 0);
                if (h.includes("location")) obj.location = val;
                if (h.includes("company")) obj.company = val;
                if (h.includes("status")) obj.status = val;
                if (h.includes("critical")) obj.critical = val;
            });

            // Skip empty rows
            if (!obj.position) continue;

            vacancies.push(obj);
        }

        return {
            vacancies,
            statutory: null // not implemented yet
        };
    }

    /* =========================================================
       📅 REPORT DATE EXTRACTOR (from filename)
    ========================================================= */
    private extractReportDate(fileName: string): string | null {
        if (!fileName) return null;

        const match = fileName.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!match) return null;

        const [_, dd, mm, yyyy] = match;
        return `${yyyy}-${mm}-${dd}`;
    }
}