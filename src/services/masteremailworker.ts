import { EmailSystem } from "./emailSystem";
import { PjpProcessor } from "../routes/microsoftEmail/pjpProcessor";
// import { SalesProcessor } from "./salesProcessor"; <-- You will add this later when ready!

enum WorkerState {
    IDLE = "IDLE",
    RUNNING = "RUNNING",
    SLEEPING = "SLEEPING",
    STOPPED = "STOPPED",
}

export class MasterEmailWorker {
    private emailSystem = new EmailSystem();
    private pjpProcessor = new PjpProcessor();
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
        console.log("SOLISEE KELA..AROMBHO HOI GOL XET.. (Master Router Mode)");
        this.shouldStop = false;
        this.state = WorkerState.RUNNING;

        while (!this.shouldStop) {
            try {
                const didWork = await this.processInbox();

                if (didWork) continue;

                this.state = WorkerState.SLEEPING;
                console.log("INBOX KHAALI surorbachaa....");
                await this.sleep(10000);
                this.state = WorkerState.RUNNING;

            } catch (e: any) {
                console.error("sudi gol.. ERROR TU dekhaabo etiya...", e);
                this.state = WorkerState.SLEEPING;
                await this.sleep(30000);
                this.state = WorkerState.RUNNING;
            }
        }

        this.state = WorkerState.STOPPED;
        console.log("SOB BONDHO...nosole kela..");
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

                const subject = (mail.subject || "").toUpperCase();
                const attachments = await this.emailSystem.getAttachments(mail.id);
                const files = Array.isArray(attachments?.value) ? attachments.value : [];

                if (!files.length) {
                    await this.emailSystem.markAsRead(mail.id);
                    continue;
                }

                // 🚦 THE ROUTER: Send to the correct department based on Subject
                if (subject.includes("PJP")) {
                    console.log(`[Router] ➡️ Routing Mail ${mail.id} to PJP Processor...`);
                    await this.pjpProcessor.processFiles(mail.id, subject, files);
                } 
                // else if (subject.includes("SALES")) {
                //     console.log(`[Router] ➡️ Routing Mail to Sales Processor...`);
                //     await this.salesProcessor.processFiles(mail.id, subject, files);
                // }
                else {
                    console.log(`[Router] ⚠️ Ignored unknown mail format: ${subject}`);
                    // Skip cleanup so ignored emails stay in the inbox for human review
                    continue; 
                }

                // 🧹 CLEANUP: Only runs if the processor above successfully finishes
                await this.emailSystem.markAsRead(mail.id);
                if (this.processedFolderId) {
                    await this.emailSystem.moveMail(mail.id, this.processedFolderId);
                }
                processedAnyMail = true;
            } catch (e: any) {
                console.error(`[Router] ❌ Mail ${mail?.id} crashed.`, e.message);
            }
        }
        return processedAnyMail;
    }
}