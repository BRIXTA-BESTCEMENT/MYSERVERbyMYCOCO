import { ExcelPayloadBuilder } from "./excelPayloadBuilder";
import { db } from "../../db/db";
import { emailReports, verifiedDealers } from "../../db/schema";
import { EmailSystem } from "../../services/emailSystem";

enum WorkerState {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  SLEEPING = "SLEEPING",
  STOPPED = "STOPPED",
}

export class EmailSystemWorker {
  private excelBuilder = new ExcelPayloadBuilder();
  private emailSystem = new EmailSystem();
  private processedFolderId = process.env.PROCESSED_FOLDER_ID!;
  
  private state: WorkerState = WorkerState.IDLE;
  private shouldStop = false;
  private sleepTimer: NodeJS.Timeout | null = null;

  
  private dealerMapCache: Map<string, number> | null = null;
  private lastMapUpdate = 0;
  private readonly MAP_TTL_MS = 5 * 60 * 1000; 

  /* =========================================================
     HELPER: NORMALIZE NAME
  ========================================================= */
  private normalizeName(name: string): string {
    if (!name) return "";
    return name
      .toUpperCase()
      .replace(/^M\/S\.?\s*/, "") // Remove "M/S" at start
      .replace(/[^A-Z0-9]/g, ""); // Remove non-alphanumeric
  }

  /* =========================================================
     HELPER: GET DEALER MAP (Cached)
  ========================================================= */
  // [FIX] Return type is explicitly Promise<Map<string, number>>
  private async getDealerMap(): Promise<Map<string, number>> {
    const now = Date.now();

    // Return cache if valid
    if (this.dealerMapCache && (now - this.lastMapUpdate < this.MAP_TTL_MS)) {
      return this.dealerMapCache;
    }

    console.log("[EmailWorker] 🔄 Refreshing Dealer Map Cache...");
    const dealers = await db
      .select({
        id: verifiedDealers.id,
        partyName: verifiedDealers.dealerPartyName,
        dealerCode: verifiedDealers.dealerCode,
      })
      .from(verifiedDealers);

    // [FIX] Initialization is explicitly <string, number>
    const map = new Map<string, number>();

    for (const d of dealers) {
      // d.id is a number, so this works now
      if (d.partyName) map.set(this.normalizeName(d.partyName), d.id);
      if (d.dealerCode) map.set(this.normalizeName(d.dealerCode), d.id);
    }

    this.dealerMapCache = map;
    this.lastMapUpdate = now;
    console.log(`[EmailWorker] ✅ Cache updated with ${map.size} keys.`);
    
    return map;
  }

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
    console.log("SOLISEE KELA..AROMBHO HOI GOL XET.. (Ingestion Mode)");
    this.shouldStop = false;
    this.state = WorkerState.RUNNING;

    // Pre-warm cache on start
    await this.getDealerMap();

    while (!this.shouldStop) {
      try {
        const didWork = await this.processInboxQueue();

        if (didWork) {
          continue; // Drain queue immediately
        }
        
        this.state = WorkerState.SLEEPING;
        console.log("INBOX KHAALI surorbachaa....");
        await this.sleep(15000); 
        this.state = WorkerState.RUNNING;

      } catch (e: any) {
        console.error("sudi gol.. ERROR TU dekhaabo etiya...", e);
        this.state = WorkerState.SLEEPING;
        await this.sleep(30000); // Backoff on crash
        this.state = WorkerState.RUNNING;
      }
    }

    this.state = WorkerState.STOPPED;
    console.log("SOB BONDHO...nosole kela..");
  }

  async stop() {
    console.log("[EmailWorker] Stop requested...");
    this.shouldStop = true;
    this.wakeUp();
  }

  public triggerWake() {
    if (this.state === WorkerState.SLEEPING) {
      console.log("[EmailWorker] External wake trigger received.");
      this.wakeUp();
    }
  }

  /* =========================================================
     MAIN WORKER: PURE INGESTION
  ========================================================= */
  async processInboxQueue(): Promise<boolean> {
    console.log("[EmailWorker] Checking inbox...");
    let processedAnyMail = false;
    
    const mails = await this.emailSystem.getUnreadWithAttachments();
    const list = Array.isArray(mails?.value) ? mails.value : [];

    if (!list.length) return false;

    // 1. Get Cached Map
    const dealerMap = await this.getDealerMap();

    for (const mail of list) {
      try {
        if (!mail?.id) continue;
        const attachments = await this.emailSystem.getAttachments(mail.id);
        const files = Array.isArray(attachments?.value) ? attachments.value : [];

        if (!files.length) {
          await this.emailSystem.markAsRead(mail.id);
          continue;
        }

        for (const file of files) {
          if (
            !file?.name ||
            !file.name.match(/\.(xlsx|xls|csv)$/i) ||
            !file.contentBytes
          )
            continue;

          const buffer = Buffer.from(file.contentBytes, "base64");
          if (!buffer.length) continue;

          // 2. Build Canonical Payload
          const rawPayload = await this.excelBuilder.buildFromBuffer(buffer, {
            messageId: mail.id,
            fileName: file.name,
            subject: mail.subject,
            sender: mail.from?.emailAddress?.address ?? null,
          });

          // 3. Scan for Enrichment (Identity Only)
          const dealerSet = new Set<string>();
          let detectedInstitution: string | null = null;
          const subjectUpper = mail.subject?.toUpperCase() ?? "";

          // Safe Priority Detection
          if (subjectUpper.includes("JSB")) {
            detectedInstitution = "JSB";
          } else if (subjectUpper.includes("JUD")) {
            detectedInstitution = "JUD";
          }

          // Content Scan
          for (const sheet of rawPayload.workbook.sheets) {
            if (!sheet.rows) continue;

            for (const row of sheet.rows) {
              const values = row.values as any[];
              if (!Array.isArray(values)) continue;

              for (const cell of values) {
                if (!cell) continue;

                const text = String(cell).trim();
                const normalized = this.normalizeName(text);

                if (dealerMap.has(normalized)) {
                  dealerSet.add(text);
                }

                // Fallback Institution detection if subject failed
                if (!detectedInstitution) {
                  const upperText = text.toUpperCase();
                  if (upperText.includes("JSB")) detectedInstitution = "JSB";
                  else if (upperText.includes("JUD")) detectedInstitution = "JUD";
                }
              }
            }
          }

          const dealerNames = Array.from(dealerSet);
          // Clean report name (removes extension)
          const reportName = file.name.replace(/\.[^/.]+$/, "");

          // 4. Insert Pure Ingestion Record
          await db.insert(emailReports).values({
            messageId: mail.id,
            subject: mail.subject,
            sender: mail.from?.emailAddress?.address ?? null,
            fileName: file.name,
            institution: detectedInstitution,
            reportName,
            dealerNames,
            payload: rawPayload, // Full JSONB
            processed: true,
          });

          console.log(
            `[EmailWorker] Ingested ${reportName}. Dealers: ${dealerNames.length}, Inst: ${detectedInstitution}`
          );
        }

        // 5. Cleanup
        await this.emailSystem.markAsRead(mail.id);
        if (this.processedFolderId) {
          await this.emailSystem.moveMail(mail.id, this.processedFolderId);
        }
        processedAnyMail = true;
      } catch (e: any) {
        console.error(`[EmailWorker] Mail ${mail?.id} crashed.`, e.message);
      }
    }
    return processedAnyMail;
  }
}