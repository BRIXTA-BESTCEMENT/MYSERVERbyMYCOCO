// src/routes/microsoftEmail/email/adminappReports/purchase_reports.ts
import { db } from "../../../../db/db";
import { purchaseReports } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../excelPayloadBuilder";
import { eq } from "drizzle-orm";

type PurchaseMaterialRow = {
    materialName: string;
    vendorName?: string | null;
    amount?: number | null;
    remarks?: string | null;
};

type PurchaseReportStatusRow = {
    reportName: string;
    status: string;
};

const SECTION_MAP: Record<string, string> = {
    "DAILY MATERIALS (TOP 5)": "dailyMaterials",
    "DAILY MATERIALS": "dailyMaterials",
    "MONTHLY IMPORTANT MATERIALS (TOP 10)": "monthlyImportantMaterials",
    "MONTHLY IMPORTANT MATERIALS": "monthlyImportantMaterials",
};

export class PurchaseReportsProcessor {

    private excelBuilder = new ExcelPayloadBuilder();

    async processFile(
        fileBuffer: Buffer,
        meta: {
            messageId: string;
            fileName: string;
            subject?: string;
        }
    ) {
        const payload = await this.excelBuilder.buildFromBuffer(fileBuffer, {
            messageId: meta.messageId,
            fileName: meta.fileName,
            subject: meta.subject,
            sender: null,
        });

        const parsed = this.extractPurchaseData(payload);

        const reportDate = parsed.reportDate || new Date().toISOString().split("T")[0];

        await db
            .delete(purchaseReports)
            .where(eq(purchaseReports.reportDate, reportDate));

        await db.insert(purchaseReports).values({
            reportDate,
            sourceFileName: meta.fileName,
            sourceMessageId: meta.messageId,
            rawPayload: payload,
            dailyMaterials: parsed.dailyMaterials,
            monthlyImportantMaterials: parsed.monthlyImportantMaterials,
            reportStatus: parsed.reportStatus,
            parserWarnings: parsed.parserWarnings,
        });

        console.log(`[PURCHASE] ✅ Upserted Purchase Report ${reportDate}`);
    }

    private extractPurchaseData(payload: any) {
        const parserWarnings: string[] = [];
        const result = {
            reportDate: null as string | null,
            dailyMaterials: [] as PurchaseMaterialRow[],
            monthlyImportantMaterials: [] as PurchaseMaterialRow[],
            reportStatus: [] as PurchaseReportStatusRow[],
            parserWarnings,
        };

        const sheet = payload?.workbook?.sheets?.[0];

        if (!sheet) {
            parserWarnings.push("No sheets found");
            return result;
        }

        const rows = sheet.rows || [];

        const clean = (v: any) => {
            if (v && typeof v === "object" && "result" in v) {
                return String(v.result || "").replace(/\s+/g, " ").trim();
            }
            return String(v || "").replace(/\s+/g, " ").trim();
        };

        // 1. EXTRACT DATE GLOBALLY FIRST
        for (const row of rows) {
            for (const cell of (row.values || [])) {
                const txt = clean(cell);
                const dateMatch = txt.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
                if (dateMatch) {
                    const [_, dd, mm, yyyy] = dateMatch;
                    result.reportDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
                    break;
                }
            }
            if (result.reportDate) break;
        }

        // 2. FIND HEADER ROW DYNAMICALLY
        let headerIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            const rowText = (rows[i]?.values || []).map(clean).join(" ").toLowerCase();
            if (rowText.includes("section") && rowText.includes("particulars")) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            result.parserWarnings.push("Header row not found");
            return result; // Cannot proceed safely without knowing column structure
        }

        const headers = rows[headerIndex].values.map((h: any) => clean(h).toLowerCase());

        // 3. MAP COLUMN INDICES
        const sectionCol = headers.findIndex((h: string) => h.includes("section"));
        const particularsCol = headers.findIndex((h: string) => h.includes("particulars"));
        const detailsCol = headers.findIndex((h: string) => h.includes("details"));
        const amountCol = headers.findIndex((h: string) => h.includes("amount") || h.includes("qty") || h.includes("value"));
        const remarksCol = headers.findIndex((h: string) => h.includes("status") || h.includes("remark"));

        let currentSection = "";

        // 4. PROCESS DATA ROWS
        for (let i = headerIndex + 1; i < rows.length; i++) {
            const values = rows[i]?.values || [];
            
            const sectionValue = clean(values[sectionCol]);
            const particularsValue = clean(values[particularsCol]);
            const detailsValue = clean(values[detailsCol]);
            const amountValue = clean(values[amountCol]);
            const remarksValue = clean(values[remarksCol]);

            // --- DETECT REPORT STATUS SECTION (Special Case at the bottom) ---
            if (sectionValue === "PURCHASE MASTER LIST" || sectionValue === "STORE REPORT - JSB" || sectionValue === "STORE REPORT - JUD") {
                result.reportStatus.push({
                    reportName: sectionValue, // e.g. "STORE REPORT - JSB"
                    status: particularsValue  // e.g. "Received"
                });
                continue;
            }

            // --- DETECT MATERIAL SECTIONS ---
            if (sectionValue) {
                const normalized = sectionValue.toUpperCase();
                
                // Allow fuzzy matching since the Excel might have "(TOP 5)" or just "DAILY MATERIALS"
                const matchedKey = Object.keys(SECTION_MAP).find(k => normalized.includes(k));
                
                if (matchedKey) {
                    currentSection = SECTION_MAP[matchedKey];
                }
            }

            if (!currentSection) continue;

            // Skip inner headers like "Material Name", "Vendor Name"
            if (particularsValue.toLowerCase().includes("material name")) continue;
            
            // Skip empty rows within a section
            if (!particularsValue && !detailsValue && !amountValue) continue;

            // --- ROUTE ROW TO CORRECT ARRAY ---
            const rowObj: PurchaseMaterialRow = {
                materialName: particularsValue,
                vendorName: detailsValue || null,
                amount: Number(amountValue) || null,
                remarks: remarksValue || null,
            };

            (result as any)[currentSection].push(rowObj);
        }

        return result;
    }
}