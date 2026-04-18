// src/routes/microsoftEmail/email/adminappReports/collection_reports.ts
import { db } from "../../../../db/db";
import { salesReports } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../../email/excelPayloadBuilder";
import { eq } from "drizzle-orm";

export class CollectionReportProcessor {
    private excelBuilder = new ExcelPayloadBuilder();

    async processFile(fileBuffer: Buffer, meta: {
        messageId: string;
        fileName: string;
        subject?: string;
    }) {
        // 1️⃣ Build raw payload via the unified builder
        const payload = await this.excelBuilder.buildFromBuffer(fileBuffer, {
            messageId: meta.messageId,
            fileName: meta.fileName,
            subject: meta.subject,
            sender: null,
        });

        // 2️⃣ Extract Collection data
        const extractedCollections = this.extractCollectionData(payload);

        if (extractedCollections.length === 0) {
            console.warn(`[SALES] ⚠️ No collection data found in ${meta.fileName}`);
            return;
        }

        const reportDate = this.extractReportDate(meta.fileName) || new Date().toISOString().split("T")[0];

        // 3️⃣ Upsert Logic: Check if a report for today already exists
        const [existingReport] = await db
            .select()
            .from(salesReports)
            .where(eq(salesReports.reportDate, reportDate))
            .limit(1);

        if (existingReport) {
            // Merge existing collections with the new ones (e.g., JSB + JUD)
            const currentCollections = Array.isArray(existingReport.collectionDataPayload) 
                ? existingReport.collectionDataPayload 
                : [];
            
            await db.update(salesReports)
                .set({
                    collectionDataPayload: [...currentCollections, ...extractedCollections],
                    sourceMessageId: meta.messageId, // Update to latest message ID
                    rawPayload: payload // Store the latest payload
                })
                .where(eq(salesReports.id, existingReport.id));
                
            console.log(`[SALES] ✅ Merged Collection report: ${meta.fileName}`);
        } else {
            // Insert brand new row
            await db.insert(salesReports).values({
                reportDate: reportDate,
                rawPayload: payload,
                salesDataPayload: [],
                collectionDataPayload: extractedCollections,
                nonTradeDataPayload: [],
                sourceFileName: meta.fileName,
                sourceMessageId: meta.messageId,
            });
            console.log(`[SALES] ✅ Inserted Collection report: ${meta.fileName}`);
        }
    }

    /* =========================================================
       🔍 CORE EXTRACTION LOGIC
    ========================================================= */
    private extractCollectionData(payload: any) {
        let collections: any[] = [];

        // Usually just Sheet1 for collections
        const sheet = payload.workbook.sheets[0]; 
        if (!sheet) return collections;

        const rows = sheet.rows || [];
        let headerIndex = -1;

        // 🔍 Find header row
        for (let i = 0; i < rows.length; i++) {
            const rowText = (rows[i].values || []).join(" ").toLowerCase();
            if (rowText.includes("voucher no") && rowText.includes("amount")) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) return collections;

        const headers = rows[headerIndex].values.map((h: any) => String(h || "").toLowerCase());

        // 🔥 Parse data rows
        for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i].values;
            if (!row || row.length === 0) continue;

            const obj: any = {};
            headers.forEach((h: string, idx: number) => {
                const val = row[idx];
                if (h.includes("voucher no")) obj.voucherNo = val;
                if (h.includes("date") && !h.includes("update")) obj.date = val;
                if (h.includes("party name")) obj.partyName = val;
                if (h.includes("zone")) obj.zone = val;
                if (h.includes("district")) obj.district = val;
                if (h.includes("promoter")) obj.salesPromoter = val;
                if (h.includes("amount")) obj.amount = Number(val || 0);
            });

            // Skip summary rows or empty rows
            if (!obj.voucherNo || String(obj.voucherNo).toLowerCase().includes("period")) continue;

            collections.push(obj);
        }

        return collections;
    }

    /* =========================================================
       📅 REPORT DATE EXTRACTOR (from JSB_Collection_Report_10-04-2026...)
    ========================================================= */
    private extractReportDate(fileName: string): string | null {
        if (!fileName) return null;
        // Matches DD-MM-YYYY
        const match = fileName.match(/(\d{2})-(\d{2})-(\d{4})/);
        if (!match) return null;
        const [_, dd, mm, yyyy] = match;
        return `${yyyy}-${mm}-${dd}`;
    }
}