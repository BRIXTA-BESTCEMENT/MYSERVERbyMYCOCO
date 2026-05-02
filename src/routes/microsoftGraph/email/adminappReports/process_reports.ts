// src/routes/microsoftEmail/email/adminappReports/process_reports.ts
import { db } from "../../../../db/db";
import { processReports } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../excelPayloadBuilder";
import { eq } from "drizzle-orm";

type ProcessMetricRow = {
    parameter: string;
    value?: any;
    unit?: string | null;
    remarks?: string | null;
};

type TargetAchievementRow = {
    parameter: string;
    target?: any;
    achievement?: any;
    variance?: any;
    unit?: string | null;
    remarks?: string | null;
};

export class ProcessReportsProcessor {

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

        const parsed = this.extractProcessData(payload);

        const reportDate = parsed.reportDate || new Date().toISOString().split("T")[0];

        await db
            .delete(processReports)
            .where(eq(processReports.reportDate, reportDate));

        await db.insert(processReports).values({
            reportDate,
            sourceFileName: meta.fileName,
            sourceMessageId: meta.messageId,
            rawPayload: payload,
            dailyStatusReports: parsed.dailyStatusReports,
            closingStock: parsed.closingStock,
            coalConsumption: parsed.coalConsumption,
            targetAchievement: parsed.targetAchievement,
            parserWarnings: parsed.parserWarnings,
        });

        console.log(`[PROCESS] ✅ Upserted Process Report ${reportDate}`);
    }

    private extractProcessData(payload: any) {

        const parserWarnings: string[] = [];

        const result = {
            reportDate: null as string | null,
            dailyStatusReports: [] as ProcessMetricRow[],
            closingStock: [] as ProcessMetricRow[],
            coalConsumption: [] as ProcessMetricRow[],
            targetAchievement: [] as TargetAchievementRow[],
            parserWarnings,
        };

        const sheet = payload?.workbook?.sheets?.[0];

        if (!sheet) {
            parserWarnings.push("No sheets found");
            return result;
        }

        const rows = sheet.rows || [];

        // Safely extract text, unwrapping formulas (.result) if they exist
        const clean = (v: any) => {
            if (v && typeof v === "object" && "result" in v) return String(v.result || "").replace(/\s+/g, " ").trim();
            return String(v || "").replace(/\s+/g, " ").trim();
        };

        let currentSection: "DAILY" | "STOCK" | "COAL" | "TARGET" | null = null;
        let colMap: any = {};

        for (let i = 0; i < rows.length; i++) {
            const values = rows[i]?.values || [];
            const rowText = values.map(clean).join(" ").toLowerCase();

            // 1. EXTRACT DATE
            if (!result.reportDate) {
                for (const cell of values) {
                    const txt = clean(cell);
                    // Matches formats like 2/5/2026 or 02-05-2026
                    const dateMatch = txt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                    if (dateMatch) {
                        const [_, dd, mm, yyyy] = dateMatch;
                        result.reportDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
                        break;
                    }
                }
            }

            // 2. DETECT SECTION TRANSITIONS
            if (rowText.includes("1. daily status")) {
                currentSection = "DAILY"; 
                colMap = {}; // Reset column map for new section
                continue;
            } else if (rowText.includes("2. closing stock")) {
                currentSection = "STOCK"; 
                colMap = {};
                continue;
            } else if (rowText.includes("3. coal consumption")) {
                currentSection = "COAL"; 
                colMap = {};
                continue;
            } else if (rowText.includes("4. target vs achievement")) {
                currentSection = "TARGET"; 
                colMap = {};
                continue;
            }

            if (!currentSection) continue;

            // 3. DYNAMICALLY MAP COLUMN HEADERS
            if (Object.keys(colMap).length === 0) {
                // If we see one of these keywords, this is the header row for the section
                if (rowText.includes("item") || rowText.includes("material") || rowText.includes("metric")) {
                    const headers = values.map((v: any) => clean(v).toLowerCase());
                    colMap = {
                        parameter: headers.findIndex((h: string) => h === "item" || h === "material" || h === "metric"),
                        value: headers.findIndex((h: string) => h === "status" || h === "closing stock" || h === "value"),
                        unit: headers.findIndex((h: string) => h === "unit" || h.includes("time")), // Time/Ref serves as unit for Daily Status
                        remarks: headers.findIndex((h: string) => h.includes("remark")),
                        target: headers.findIndex((h: string) => h === "target"),
                        achievement: headers.findIndex((h: string) => h.includes("achievement") || h.includes("achv")),
                        variance: headers.findIndex((h: string) => h.includes("variance") || h.includes("var")),
                    };
                    continue; // Skip the header row itself
                }
            }

            // 4. PARSE DATA ROWS
            if (Object.keys(colMap).length > 0) {
                const paramVal = clean(values[colMap.parameter]);
                
                // Skip blank rows or repeated header rows
                if (!paramVal || paramVal.toLowerCase() === "item" || paramVal.toLowerCase() === "material" || paramVal.toLowerCase() === "metric") continue;

                if (currentSection === "DAILY") {
                    result.dailyStatusReports.push({
                        parameter: paramVal,
                        value: colMap.value !== -1 ? clean(values[colMap.value]) : null,
                        unit: colMap.unit !== -1 ? clean(values[colMap.unit]) : null,
                        remarks: colMap.remarks !== -1 ? clean(values[colMap.remarks]) : null,
                    });
                } 
                else if (currentSection === "STOCK") {
                    result.closingStock.push({
                        parameter: paramVal,
                        // Try to convert to number, fallback to string if it's text
                        value: colMap.value !== -1 ? (Number(clean(values[colMap.value])) || clean(values[colMap.value])) : null,
                        unit: colMap.unit !== -1 ? clean(values[colMap.unit]) : null,
                        remarks: colMap.remarks !== -1 ? clean(values[colMap.remarks]) : null,
                    });
                } 
                else if (currentSection === "COAL") {
                    result.coalConsumption.push({
                        parameter: paramVal,
                        value: colMap.value !== -1 ? (Number(clean(values[colMap.value])) || clean(values[colMap.value])) : null,
                        unit: colMap.unit !== -1 ? clean(values[colMap.unit]) : null,
                        remarks: colMap.remarks !== -1 ? clean(values[colMap.remarks]) : null,
                    });
                } 
                else if (currentSection === "TARGET") {
                    result.targetAchievement.push({
                        parameter: paramVal,
                        target: colMap.target !== -1 ? (Number(clean(values[colMap.target])) || null) : null,
                        achievement: colMap.achievement !== -1 ? (Number(clean(values[colMap.achievement])) || null) : null,
                        variance: colMap.variance !== -1 ? (Number(clean(values[colMap.variance])) || null) : null,
                        unit: colMap.unit !== -1 ? clean(values[colMap.unit]) : null,
                        remarks: colMap.remarks !== -1 ? clean(values[colMap.remarks]) : null,
                    });
                }
            }
        }

        return result;
    }
}