import { db } from "../../db/db";
import { emailReports } from "../../db/schema";
import { eq } from "drizzle-orm";

import { EmailSystem } from "./emailSystem";
import { HrReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/hr_reports";
import { SalesReportProcessor } from "../../routes/microsoftGraph/email/adminappReports/sales_reports";
import { CollectionReportProcessor } from "../../routes/microsoftGraph/email/adminappReports/collection_reports";
import { OutstandingReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/outstanding_reports";
import { LogisticsReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/logistics_reports";
import { FinanceReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/finance_reports";
import { AccountsReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/accounts_reports";
import { ProcessReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/process_reports";
import { PurchaseReportsProcessor } from "../../routes/microsoftGraph/email/adminappReports/purchase_reports";

enum WorkerState {
    IDLE = "IDLE",
    RUNNING = "RUNNING",
    SLEEPING = "SLEEPING",
    STOPPED = "STOPPED",
}

export class MasterEmailWorker {
    private emailSystem = new EmailSystem();
    private hrProcessor = new HrReportsProcessor();
    private salesReportsProcessor = new SalesReportProcessor();
    private collectionReportsProcessor = new CollectionReportProcessor();
    private outstandingReportsProcessor = new OutstandingReportsProcessor();
    private logisticsReportsProcessor = new LogisticsReportsProcessor();
    private financeReportsProcessor = new FinanceReportsProcessor();
    private accountsReportsProcessor = new AccountsReportsProcessor();
    private processReportsProcessor = new ProcessReportsProcessor();
    private purchaseReportsProcessor = new PurchaseReportsProcessor();

    private processedFolderId = process.env.PROCESSED_FOLDER_ID!;
    private state: WorkerState = WorkerState.IDLE;
    private shouldStop = false;
    private sleepTimer: NodeJS.Timeout | null = null;

    /* =========================================================
       SLEEP UTILS
    ========================================================= */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.sleepTimer = setTimeout(() => {
                this.sleepTimer = null;
                resolve();
            }, ms);
        });
    }

    private wakeUp() {
        if (this.sleepTimer) {
            clearTimeout(this.sleepTimer);
            this.sleepTimer = null;
        }
    }

    /* =========================================================
       WORKER LIFECYCLE
    ========================================================= */
    async Start() {
        if (this.state === WorkerState.RUNNING) return;
        console.log("Started Mail Extractor Worker NOW!.. (Master Router Mode)");
        this.shouldStop = false;
        this.state = WorkerState.RUNNING;

        while (!this.shouldStop) {
            try {
                const didWork = await this.processInbox();

                if (didWork) continue;

                this.state = WorkerState.SLEEPING;
                console.log("INBOX EMPTY....");
                await this.sleep(10000);
                this.state = WorkerState.RUNNING;

            } catch (e: any) {
                console.error("ERROR: ", e);
                this.state = WorkerState.SLEEPING;
                await this.sleep(30000);
                this.state = WorkerState.RUNNING;
            }
        }

        this.state = WorkerState.STOPPED;
        console.log("Nothing worked. Worker execution failed!");
    }

    async stop() {
        this.shouldStop = true;
        this.wakeUp();
    }

    public triggerWake() {
        if (this.state === WorkerState.SLEEPING) {
            this.wakeUp();
        }
    }

    // Helper to prevent flagMail from crashing the loop if categories are missing
    private async safeFlagMail(messageId: string) {
        try {
            await this.emailSystem.flagMail(messageId);
        } catch (e) {
            console.log(`[Router] Could not flag mail ${messageId}. Ignoring flag error.`);
        }
    }

    /* =========================================================
       MAIN ROUTER LOGIC
    ========================================================= */
    private async processInbox(): Promise<boolean> {
        let processedAnyMail = false;

        const mails = await this.emailSystem.getUnreadWithAttachments();
        const list = Array.isArray(mails?.value) ? mails.value : [];

        if (!list.length) return false;

        for (const mail of list) {
            try {
                if (!mail?.id) continue;
                
                const existingRecords = await db
                    .select()
                    .from(emailReports)
                    .where(eq(emailReports.messageId, mail.id))
                    .limit(1);

                const existing = existingRecords[0];

                if (existing) {
                    console.log(`[Router] ♻️ Re-processing previously seen mail (Test Mode): ${mail.id}`);
                    await db.delete(emailReports).where(eq(emailReports.messageId, mail.id));
                }

                const subject = (mail.subject || "").toUpperCase();
                const attachments = await this.emailSystem.getAttachments(mail.id);
                const allFiles = Array.isArray(attachments?.value) ? attachments.value : [];

                // 🛡️ CRITICAL FIX: Only grab actual Excel files. Ignores Gmail signature images!
                const files = allFiles.filter((f : any) => 
                    f.name?.toLowerCase().endsWith(".xlsx") || 
                    f.name?.toLowerCase().endsWith(".xls")
                );

                if (!files.length) {
                    await db
                        .insert(emailReports)
                        .values({
                            messageId: mail.id,
                            subject: mail.subject,
                            payload: mail,
                            processed: true,
                            isSuccess: false,
                            errorMessage: "No valid Excel attachments found",
                            processingStage: "no_attachments",
                        });
                    
                    console.log(`[Router] ⚠️ No Excel attachments found. Flagging and marking read.`);
                    await this.safeFlagMail(mail.id);
                    await this.emailSystem.markAsRead(mail.id);
                    continue;
                }

                // 🚦 THE ROUTER : Correct mail to correct inbox
                if (subject.includes("HR REPORT") || subject.includes("HR-REPORT") || subject.includes("HR REPORTS")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to HR Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.hrProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("SALES REPORT") || subject.includes("SALES REPORTS") ||
                    subject.includes("SALE REPORT") || subject.includes("SALE REPORTS") || subject.includes("SALES") || subject.includes("SALE")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to SALES REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.salesReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("COLLECTION REPORT") || subject.includes("COLLECTION REPORTS") || subject.includes("COLLECTION")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to COLLECTION REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.collectionReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("OUTSTANDING REPORT") || subject.includes("OUTSTANDING REPORTS") || subject.includes("OUTSTANDING")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to OUTSTANDING REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.outstandingReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("LOGISTICS REPORT") || subject.includes("LOGISTICS REPORTS") || subject.includes("LOGISTICS_RAWMATERIAL_CMD_DAILY_REPORT")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to LOGISTICS REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.logisticsReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("FINANCE REPORT") || subject.includes("FINANCE REPORTS") || subject.includes("FINANCE_CMD_DAILY_REPORT")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to FINANCE REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.financeReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("ACCOUNTS REPORT") || subject.includes("ACCOUNTS REPORTS") || subject.includes("MD_DAILY_ACCOUNTS_DASHBOARD")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to ACCOUNTS REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.accountsReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("PROCESS REPORT") || subject.includes("PROCESS REPORTS") || subject.includes("PROCESS QUALITY REPORTS") ||
                    subject.includes("PROCESS QUALITY REPORT") || subject.includes("PROCESS_QUALITY_CMD_DAILY_REPORT")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to PROCESS REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.processReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else if (subject.includes("PURCHASE REPORT") || subject.includes("PURCHASE REPORTS") || subject.includes("PURCHASE_CMD_DAILY_REPORT")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to PURCHASE REPORTS Processor...`);
                    for (const file of files) {
                        const buffer = Buffer.from(file.contentBytes, "base64");
                        await this.purchaseReportsProcessor.processFile(buffer, { messageId: mail.id, fileName: file.name, subject: mail.subject });
                    }
                }
                else {
                    console.log(`[Router] ⚠️ Ignored unknown mail format: ${subject}`);
                    await db
                        .insert(emailReports)
                        .values({
                            messageId: mail.id,
                            subject: mail.subject,
                            payload: mail,
                            sender: mail?.from?.emailAddress?.address,
                            isSuccess: false,
                            processingStage: "ignored",
                            errorMessage: "Unknown report format",
                        });
                    
                    await this.safeFlagMail(mail.id);
                    await this.emailSystem.markAsRead(mail.id);
                    continue;
                }

                // 🧹 CLEANUP: Only runs if the processor above successfully finishes
                await db
                    .insert(emailReports)
                    .values({
                        messageId: mail.id,
                        subject: mail.subject,
                        sender: mail?.from?.emailAddress?.address,
                        payload: mail,
                        processed: true,
                        isSuccess: true,
                        processingStage: "completed",
                    });

                await this.emailSystem.markAsRead(mail.id);
                if (this.processedFolderId) {
                    await this.emailSystem.moveMail(mail.id, this.processedFolderId);
                }
                processedAnyMail = true;
                
            } catch (e: any) {
                console.error(`[Router] ❌ Mail ${mail?.id} crashed.`, e.message);
                try {
                    await db
                        .insert(emailReports)
                        .values({
                            messageId: mail.id,
                            subject: mail.subject,
                            payload: mail,
                            sender: mail?.from?.emailAddress?.address,
                            processed: true,
                            isSuccess: false,
                            errorMessage: e.message,
                            processingStage: "failed",
                        });

                    await this.safeFlagMail(mail.id);
                } catch (dbErr) {
                    console.error("[Router] ❌ Database logging failed during crash handler", dbErr);
                } finally {
                    // 🛡️ CRITICAL FIX: The finally block guarantees the queue will NEVER clog!
                    await this.emailSystem.markAsRead(mail.id).catch(() => { });
                }
            }
        }
        return processedAnyMail;
    }
}