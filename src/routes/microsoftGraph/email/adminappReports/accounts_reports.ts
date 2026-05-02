// src/routes/microsoftEmail/email/adminappReports/accounts_reports.ts
import { db } from "../../../../db/db";
import { accountsReports } from "../../../../db/schema";
import { ExcelPayloadBuilder } from "../excelPayloadBuilder";
import { eq } from "drizzle-orm";

export class AccountsReportsProcessor {

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
            this.extractAccountsData(payload);

        const reportDate =
            parsed.reportDate ||
            new Date()
                .toISOString()
                .split("T")[0];

        await db
            .delete(accountsReports)
            .where(
                eq(
                    accountsReports.reportDate,
                    reportDate
                )
            );

        await db.insert(accountsReports).values({

            reportDate,

            sourceFileName:
                meta.fileName,

            sourceMessageId:
                meta.messageId,

            rawPayload:
                payload,

            accountsDashboardData:
                parsed.accountsDashboardData,

            parserWarnings:
                parsed.parserWarnings,
        });

        console.log(
            `[ACCOUNTS] ✅ Upserted Accounts Report ${reportDate}`
        );
    }

    private extractAccountsData(
        payload: any
    ) {

        const parserWarnings:
            string[] = [];

        const result = {

            reportDate:
                null as string | null,

            accountsDashboardData:
                [] as any[],

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

        if (rows.length < 3) {

            parserWarnings.push(
                "Insufficient rows"
            );

            return result;
        }

        const headerRow1 =
            rows[0]?.values || [];

        const headerRow2 =
            rows[1]?.values || [];

        const compositeHeaders:
            string[] = [];

        for (
            let i = 0;
            i <
            Math.max(
                headerRow1.length,
                headerRow2.length
            );
            i++
        ) {

            const main =
                String(
                    headerRow1[i] || ""
                )
                    .trim();

            const sub =
                String(
                    headerRow2[i] || ""
                )
                    .trim();

            let finalHeader = "";

            if (main && sub) {

                finalHeader =
                    `${main}_${sub}`;
            }

            else {

                finalHeader =
                    main || sub;
            }

            finalHeader =
                finalHeader
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                    .replace(/[^\w]/g, "");

            compositeHeaders.push(
                finalHeader
            );
        }

        for (let i = 2; i < rows.length; i++) {

            const values =
                rows[i]?.values || [];

            if (!values.length)
                continue;

            const rowObj:
                Record<
                    string,
                    any
                > = {};

            compositeHeaders.forEach(
                (header, idx) => {

                    rowObj[header] =
                        values[idx];
                }
            );

            const hasData =
                Object.values(
                    rowObj
                ).some(
                    v =>
                        v !== null &&
                        v !== undefined &&
                        String(v)
                            .trim() !== ""
                );

            if (!hasData)
                continue;

            result.accountsDashboardData.push(
                rowObj
            );
        }

        return result;
    }
}
