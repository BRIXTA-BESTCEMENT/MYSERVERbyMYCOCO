// src/routes/microsoftGraph/excel/dashboardSheetsEditor/saveCollection.ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { db } from "../../../../db/db";
import { collectionReports, verifiedDealers } from "../../../../db/schema";

// 🛠️ LOOSENED SCHEMA: Prevent Zod from crashing on nulls. We handle them manually below.
const collectionRecordSchema = z.object({
  institution: z.any(),
  voucherNo: z.any(),
  voucherDate: z.any(),
  partyName: z.any(),
  zone: z.any(),
  district: z.any(),
  salesPromoterName: z.any(),
  bankAccount: z.any(),
  amount: z.any(), 
  remarks: z.any(),
});

const payloadSchema = z.object({
    records: z.array(collectionRecordSchema)
});

export class SaveDashboardCollection {
    public static async save(req: Request, res: Response): Promise<any> {
        try {
            const parsedBody = payloadSchema.safeParse(req.body);

            if (!parsedBody.success) {
                // 🛠️ DETAILED LOGGING: If Zod fails, it will now explicitly print WHY in your terminal!
                console.error("ZOD VALIDATION FAILED:", JSON.stringify(parsedBody.error.format(), null, 2));
                return res.status(400).json({
                    error: "Invalid data format",
                    details: parsedBody.error.format()
                });
            }

            const { records } = parsedBody.data;
            if (records.length === 0) return res.status(400).json({ error: "No records provided." });

            // 1. Preload Dealers for Auto-linking Party Name to Verified Dealers
            const dealers = await db.select().from(verifiedDealers);
            const findDealerId = (name: string) => {
                if (!name) return null;
                const clean = name.toLowerCase().trim();
                const match = dealers.find((d) => d.dealerPartyName?.toLowerCase().includes(clean));
                return match?.id ?? null;
            };

            // 2. Format & Sanitize
            const formattedRecords = [];

            for (const record of records) {
                if (!record.voucherNo || !record.voucherDate || !record.institution || !record.partyName) {
                    console.warn(`Skipping incomplete row - Voucher: ${record.voucherNo}, Date: ${record.voucherDate}, Inst: ${record.institution}`);
                    continue;
                }

                const cleanNumeric = (val: any) => {
                    if (val === null || val === undefined) return null;
                    let str = String(val).replace(/[,%]/g, '').trim();
                    if (/^[-–—−]+$/.test(str) || str === '') return null;
                    str = str.replace(/^[–—−]/, '-');
                    if (isNaN(Number(str))) return null;
                    return str;
                };

                formattedRecords.push({
                    institution: record.institution.toUpperCase().substring(0, 10),
                    voucherNo: record.voucherNo,
                    voucherDate: record.voucherDate,
                    partyName: record.partyName,
                    zone: record.zone,
                    district: record.district,
                    salesPromoterName: record.salesPromoterName,
                    bankAccount: record.bankAccount,
                    amount: cleanNumeric(record.amount) || "0", // Fallback to 0 if null as schema requires it
                    remarks: record.remarks,
                    verifiedDealerId: findDealerId(record.partyName)
                });
            }

            if (formattedRecords.length === 0) {
                return res.status(400).json({ error: "No valid records found to insert. Check if Date, Institution, or Voucher No are missing." });
            }

            // 3. Prevent Duplicates: Delete any existing records with the same Voucher Numbers
            await db.delete(collectionReports)

            // 4. Execute Bulk Insert
            const insertedData = await db.insert(collectionReports)
                .values(formattedRecords)
                .returning({ id: collectionReports.id });

            return res.json({
                success: true,
                message: `Successfully upserted ${insertedData.length} collection records.`,
                insertedIds: insertedData.map(d => d.id)
            });

        } catch (err: any) {
            console.error("SAVE COLLECTION ERROR:", err.message);
            return res.status(500).json({ error: "Failed to save collection reports" });
        }
    }
}

export default function setupSaveCollectionRoute(app: Express) {
    app.post(
        "/api/excel/collection/save",
        verifyDashboardJWT,
        SaveDashboardCollection.save
    );
}