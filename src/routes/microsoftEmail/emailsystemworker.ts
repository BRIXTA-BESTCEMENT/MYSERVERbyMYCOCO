import XLSX from "xlsx";
import { db } from "../../db/db";
import {
  emailReports,
  dailyTasks,
  collectionReports,
  projectionReports,
  projectionVsActualReports,
  outstandingReports,
  verifiedDealers, // <--- Verified Dealers Table
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { EmailSystem } from "../../services/emailSystem";
import { randomUUID } from "crypto";

type SheetCandidate = {
  name: string;
  rows: (string | number | null)[][];
};

enum WorkerState {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  SLEEPING = "SLEEPING",
  STOPPED = "STOPPED",
}

export class EmailSystemWorker {
  private emailSystem = new EmailSystem();
  private processedFolderId = process.env.PROCESSED_FOLDER_ID!;
  private state: WorkerState = WorkerState.IDLE;
  private shouldStop = false;
  private sleepTimer: NodeJS.Timeout | null = null;


  private buildSignature(rows: (string | number | null)[][]) {
    const headerBlock = rows
      .slice(0, 15) // deeper scan
      .map(r =>
        r.map(c => String(c ?? "").trim().toUpperCase())
      );

    const flat = headerBlock.flat();

    return {
      flatText: flat.join(" "),
      uniqueTokens: new Set(flat),
      columnCount: Math.max(...rows.map(r => r.length)),
      rowCount: rows.length
    };
  }

  private detectFromStructure(sig: ReturnType<typeof this.buildSignature>) {
    const text = sig.flatText;

    if (text.includes("USER ID")) return "PJP";

    if (
      text.includes("VOUCHER") &&
      text.includes("PARTY") &&
      text.includes("DATE")
    ) return "COLLECTION";

    if (
      text.includes("ACTUAL ORDER") &&
      text.includes("DO DONE")
    ) return "PROJECTION_VS_ACTUAL";

    if (
      text.includes("ZONE") &&
      text.includes("DEALER") &&
      text.includes("AMOUNT")
    ) return "PROJECTION";
    if (
      text.includes("SECURITY") &&
      text.includes("PENDING")
    ) return "OUTSTANDING";


    return "UNKNOWN";
  }

  private detectFromSubject(subject?: string) {
    const s = subject?.toUpperCase() ?? "";

    if (s.includes("PJP")) return "PJP";
    if (s.includes("COLLECTION")) return "COLLECTION";
    if (s.includes("PROJECTION VS ACTUAL")) return "PROJECTION_VS_ACTUAL";
    if (s.includes("OUTSTANDING")) return "OUTSTANDING";
    if (s.includes("PROJECTION")) return "PROJECTION";

    return "UNKNOWN";
  }

  private reconcileType(
    structural: string,
    subjectHint: string
  ) {
    if (structural === "UNKNOWN" && subjectHint === "UNKNOWN")
      return "UNKNOWN";

    if (structural === subjectHint)
      return structural;

    if (structural !== "UNKNOWN" && subjectHint === "UNKNOWN")
      return structural;

    if (structural === "UNKNOWN" && subjectHint !== "UNKNOWN")
      return subjectHint;

    // Conflict case
    console.warn(
      `[EmailWorker] Subject says ${subjectHint}, structure says ${structural}. Using structure.`
    );

    return structural;
  }



  /* =========================================================
     HELPER: DETECT DERIVED / TOTAL ROWS
  ========================================================= */
  private isDerivedRow(...values: (string | null | undefined)[]): boolean {
    const text = values
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    if (!text) return false;

    return (
      text.includes("TOTAL") ||
      text.includes("GRAND") ||
      text.includes("SUBTOTAL") ||
      text.includes("SUMMARY")
    );
  }

  /* =========================================================
     HELPER: NORMALIZE NAME FOR MATCHING
     Removes "M/S", special chars, spaces for better hit rate
  ========================================================= */
  private normalizeName(name: string): string {
    if (!name) return "";
    return name
      .toUpperCase()
      .replace(/^M\/S\.?\s*/, "") // Remove "M/S" or "M/S." at start
      .replace(/[^A-Z0-9]/g, ""); // Remove all non-alphanumeric chars
  }

  /*====================================================

  sleep
  ====================================================*/

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


  async Start() {
    if (this.state == WorkerState.RUNNING) return;
    console.log("SOLISEE KELA..AROMBHO HOI GOL XET..");
    this.shouldStop = false;
    this.state = WorkerState.RUNNING;

    while (!this.shouldStop) {
      try {
        const didWork = await this.processInboxQueue();

        if (didWork) {
          // Immediately check again until inbox drained
          continue;
        }
        this.state = WorkerState.SLEEPING;
        console.log("INBOX KHAALI surorbachaa....");

        await this.sleep(15000); // configurable later

        this.state = WorkerState.RUNNING;



      } catch (e) {
        console.error("sudi gol.. ERROR TU dekhaabo etiya...", e);

        // Exponential backoff lite
        this.state = WorkerState.SLEEPING;
        await this.sleep(30000);
        this.state = WorkerState.RUNNING;
      }
    }

    this.state = WorkerState.STOPPED;
    console.log("SOB BONDHO...nosole kela..")

  }
  async stop() {
    console.log("[EmailWorker] Stop requested...");
    this.shouldStop = true;
    this.wakeUp(); // interrupt sleep immediately
  }

  public triggerWake() {
    if (this.state === WorkerState.SLEEPING) {
      console.log("[EmailWorker] External wake trigger received.");
      this.wakeUp();
    }
  }

  /* =========================================================
     MAIN WORKER
  ========================================================= */
  async processInboxQueue(): Promise<boolean> {
    console.log("[EmailWorker] Checking inbox...");

    let processedAnyMail = false;

    // Fetch unread emails
    const mails = await this.emailSystem.getUnreadWithAttachments();
    const list = Array.isArray(mails?.value) ? mails.value : [];

    if (!list.length) {
      console.log("[EmailWorker] Inbox empty...XETr moila..");
      return false;
    }

    console.log(`[EmailWorker] Found ${list.length} mails`);

    for (const mail of list) {
      try {
        if (!mail?.id) continue;

        console.log(
          `[EmailWorker] Processing: ${mail.subject ?? "(no subject)"}`
        );

        /* ------------------------------
           Get Attachments
        ------------------------------ */
        const attachments = await this.emailSystem.getAttachments(mail.id);
        const files = Array.isArray(attachments?.value)
          ? attachments.value
          : [];

        if (!files.length) {
          console.warn(
            `[EmailWorker] Mail ${mail.id} has no attachments.`
          );
          // Mark as read to avoid infinite loop
          await this.emailSystem.markAsRead(mail.id);
          continue;
        }

        const subjectHint = this.detectFromSubject(mail.subject);

        for (const file of files) {
          if (!file?.name) continue;
          if (!file.name.match(/\.(xlsx|xls|csv)$/i)) continue;
          if (!file.contentBytes) continue;

          console.log(`[EmailWorker] Parsing ${file.name}`);

          const buffer = Buffer.from(file.contentBytes, "base64");
          if (!buffer.length) continue;

          const workbook = XLSX.read(buffer, { type: "buffer" });
          if (!workbook.SheetNames?.length) continue;

          /* ------------------------------------------------------
             🚀 MULTI-SHEET SCAN STRATEGY
             Iterate ALL sheets. Process EVERYTHING that matches.
          ------------------------------------------------------ */
          let sheetsMatchedInFile = 0;

          for (const sheetName of workbook.SheetNames) {
            // SHEET-LEVEL ISOLATION: One bad sheet won't kill the file
            try {
              const sheet = workbook.Sheets[sheetName];

              // Skip obvious junk (empty references)
              if (sheet["!ref"] === "A1" && !sheet["A1"]) continue;

              const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                raw: false,
                defval: null,
              }) as (string | number | null)[][];

              if (rows.length < 2) continue;

              const sig = this.buildSignature(rows);
              const text = sig.flatText;

              // --- DETECTION LOGIC ---

              // 1. Ask Structure
              let detectedType = this.detectFromStructure(sig);

              // 2. PRIORITY OVERRIDE: The "Score 100" Logic
              // If this specific pattern exists, it IS Outstanding, regardless of what structure said.
              if (
                text.includes("DEALER") &&
                (text.includes("PENDING") || text.includes("OUTSTANDING")) &&
                (text.includes("< 10") || text.includes("DAYS") || text.includes("10-15") || text.includes("15-21"))
              ) {
                detectedType = "OUTSTANDING";
              }

              // 3. Fallback: Subject Hint
              if (detectedType === "UNKNOWN" && subjectHint !== "UNKNOWN") {
                detectedType = subjectHint;
              }

              // If still unknown, skip this sheet
              if (detectedType === "UNKNOWN") {
                // console.log(`[Sheet Skip] '${sheetName}' could not be identified.`);
                continue;
              }

              console.log(`[Sheet MATCH] '${sheetName}' -> Identified as ${detectedType}`);

              // --- PREPARE CONTEXT ---
              const institutionContext =
                mail.subject?.toUpperCase().includes("JSB")
                  ? "JSB"
                  : mail.subject?.toUpperCase().includes("JUD")
                    ? "JUD"
                    : null;

              const meta = { messageId: mail.id, fileName: file.name };

              // --- ROUTING ---
              switch (detectedType) {
                case "PJP":
                  await this.processPjpRows(rows);
                  break;

                case "COLLECTION":
                  await this.processCollectionRows(
                    rows,
                    institutionContext,
                    meta
                  );
                  break;

                case "PROJECTION":
                  await this.processProjectionRows(
                    rows,
                    meta,
                    institutionContext
                  );
                  break;

                case "PROJECTION_VS_ACTUAL":
                  await this.processProjectionVsActualRows(
                    rows,
                    meta,
                    institutionContext
                  );
                  break;
                case "OUTSTANDING":
                  await this.processOutstandingRows(
                    rows,
                    meta,
                    institutionContext
                  );
                  break;
              }

              sheetsMatchedInFile++;

            } catch (sheetError: any) {
              console.error(
                `[Sheet ERROR] Failed to process sheet '${sheetName}' in file '${file.name}'`,
                sheetError.message
              );
              // Swallow error so loop continues to next sheet
            }
          } // End Sheet Loop

          /* ------------------------------
             FALLBACK: NO VALID SHEETS FOUND
          ------------------------------ */
          if (sheetsMatchedInFile === 0) {
            console.warn(
              `[EmailWorker] No valid sheets found in ${file.name}. Archiving raw payload.`
            );

            await db.insert(emailReports).values({
              messageId: mail.id,
              subject: mail.subject,
              sender: mail.from?.emailAddress?.address ?? null,
              fileName: file.name,
              payload: workbook, // full workbook preserved
              processed: false,
            });
          }

        } // End File Loop

        // Always mark as read + move to processed
        await this.emailSystem.markAsRead(mail.id);
        if (this.processedFolderId) {
          await this.emailSystem.moveMail(
            mail.id,
            this.processedFolderId
          );
        }

        processedAnyMail = true;

      } catch (e: any) {
        console.error(
          `[EmailWorker] Mail ${mail?.id ?? "unknown"} crashed elegantly.`,
          {
            message: e?.message,
            stack: e?.stack?.split("\n")?.slice(0, 2),
            timestamp: new Date().toISOString(),
          }
        );
        continue;
      }
    }

    return processedAnyMail;
  }
  /* =========================================================
     HELPER: EXTRACT REPORT DATE (Scan Sheet Content)
  ========================================================= */
  private extractReportDate(rows: (string | number | null)[][]): string {
    // Scan deeper (first 20 rows) to catch metadata below logos/headers
    let finalDate = new Date().toISOString().split("T")[0]; // default
    let found = false;

    for (let r = 0; r < Math.min(20, rows.length); r++) {
      const row = rows[r];
      if (!row) continue;

      for (const cell of row) {
        if (cell === null || cell === undefined) continue;

        // --- 1. Handle Excel Serial Numbers (e.g., 45678) ---
        // Range Check: > 35000 (Year ~1995) to < 60000 (Year ~2064)
        if (typeof cell === "number" && cell > 35000 && cell < 60000) {
          try {
            const date = new Date(Math.round((cell - 25569) * 86400 * 1000));
            finalDate = date.toISOString().split("T")[0];
            found = true;
            break;
          } catch {
            // Ignore bad math, continue scanning
          }
        }

        // --- 2. Handle Strings ---
        const text = String(cell).trim().toUpperCase();
        if (text.length < 8) continue;

        // Match ISO: YYYY-MM-DD
        const isoMatch = text.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
        if (isoMatch) {
          const [_, yyyy, mm, dd] = isoMatch;
          finalDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
          found = true;
          break;
        }

        // Match DMY: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
        const dmyMatch = text.match(/\b(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})\b/);
        if (dmyMatch) {
          const [_, dd, mm, yyyy] = dmyMatch;
          finalDate = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // ⚠️ CRITICAL VERIFICATION LOG
    console.log(`[VERIFY] Extracted reportDate: ${finalDate}`);
    return finalDate;
  }

  /* =========================================================
     HELPER: PJP → DAILY TASKS (ID BASED)
  ========================================================= */

  private async processPjpRows(rows: (string | number | null)[][]) {
    if (rows.length < 2) return;

    // Normalize Headers
    const headers = rows[0].map((h) => String(h).trim().toUpperCase());
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    if (idx["USER ID"] === undefined) {
      console.error("[PJP] Missing 'USER ID' column. Aborting.");
      return;
    }

    const getVal = (row: any[], colName: string): string | null => {
      const i = idx[colName];
      if (i === undefined) return null;
      const val = row[i];
      return val !== null && val !== undefined ? String(val).trim() : null;
    };

    const tasks: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const userIdRaw = row[idx["USER ID"]];
      const userId = Number(userIdRaw);

      if (!userIdRaw || Number.isNaN(userId)) {
        continue;
      }

      const dateRaw = row[idx["DATE"]];
      let taskDateStr: string;

      try {
        let dateObj = new Date();
        if (typeof dateRaw === "number") {
          dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
        } else if (dateRaw) {
          dateObj = new Date(String(dateRaw));
        }
        taskDateStr = dateObj.toISOString().split("T")[0];
      } catch (err) {
        taskDateStr = new Date().toISOString().split("T")[0];
      }

      tasks.push({
        id: randomUUID(),
        userId,
        assignedByUserId: userId,
        taskDate: taskDateStr,
        visitType: getVal(row, "VISIT TYPE") ?? "Visit",
        relatedDealerId: getVal(row, "DEALER ID"),
        siteName: getVal(row, "SITE NAME"),
        description: getVal(row, "DESCRIPTION"),
        dealerName: getVal(row, "DEALER NAME"),
        dealerCategory: getVal(row, "CATEGORY"),
        pjpCycle: getVal(row, "CYCLE"),
        status: "Assigned",
      });
    }

    if (tasks.length > 0) {
      await db.insert(dailyTasks).values(tasks);
      console.log(`[PJP] Successfully created ${tasks.length} tasks.`);
    }
  }
  /*============================================================
      HELPER: Outstanding Report (With Duplication Fix & Upsert)
    ============================================================ */
  private async processOutstandingRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string },
    institution: string | null
  ) {
    if (!rows.length) return;

    /* --------------------------------------------------
       STEP 0: FETCH AND MAP VERIFIED DEALERS
    -------------------------------------------------- */
    console.log("[OUTSTANDING] 🔍 Fetching Verified Dealers for mapping...");

    const allVerifiedDealers = await db
      .select({
        id: verifiedDealers.id,
        partyName: verifiedDealers.dealerPartyName,
        dealerCode: verifiedDealers.dealerCode
      })
      .from(verifiedDealers);

    const dealerMap = new Map<string, number>();
    allVerifiedDealers.forEach((d) => {
      if (d.partyName) dealerMap.set(this.normalizeName(d.partyName), d.id);
      if (d.dealerCode) dealerMap.set(this.normalizeName(d.dealerCode), d.id);
    });

    console.log(`[OUTSTANDING] ✅ Loaded ${dealerMap.size} dealer keys.`);

    /* ----------------------------------------------------
       STEP 1: INSTITUTION AUTO-DETECT (Deep Scan)
    ---------------------------------------------------- */
    let detectedInst = institution;

    if (!detectedInst) {
      const fileName = (meta.fileName || "").toUpperCase();
      const cleanFileName = fileName.replace(/[\.\s]/g, "");

      const titleBlock = rows.slice(0, 50).map(r => r.join(" ").toUpperCase()).join(" ");
      const cleanTitleBlock = titleBlock.replace(/[\.]/g, "");

      if (cleanFileName.includes("JSB") || cleanTitleBlock.includes("JSB") || titleBlock.includes("J S B")) {
        detectedInst = "JSB";
      } else if (cleanFileName.includes("JUD") || cleanTitleBlock.includes("JUD") || titleBlock.includes("J U D")) {
        detectedInst = "JUD";
      }
    }

    const safeInstitution = detectedInst ?? null;
    const isAccountJsbJud = safeInstitution === "JSB";

    console.log(`[OUTSTANDING] 🏢 Detected: ${safeInstitution || "UNKNOWN"} (isAccountJsbJud: ${isAccountJsbJud})`);

    /* ------------------------------------------------------
       STEP 1.5: EXTRACT DATE (WITH LOGGING)
    ------------------------------------------------------ */
    const reportDate = this.extractReportDate(rows);
    console.log(`[VERIFY-OUT] 📅 Extracted reportDate: ${reportDate}`);

    /* --------------------------------------------------
       STEP 2: PREPARE PARSING
    -------------------------------------------------- */
    const normalizeRow = (r: any[]) =>
      r.map(c => String(c ?? "").toUpperCase().replace(/[^A-Z0-9<> -]/g, "").replace(/\s+/g, " ").trim());

    const headerIndexes = rows
      .map((r, i) => {
        const line = normalizeRow(r).join(" ");
        if (line.includes("DEALER") && (line.includes("PENDING") || line.includes("OUTSTANDING") || line.includes("TOTAL"))) return i;
        return -1;
      })
      .filter(i => i !== -1);

    if (!headerIndexes.length) {
      console.error("[OUTSTANDING] No header rows found.");
      return;
    }

    const num = (v: any) => {
      const n = Number(String(v ?? "0").replace(/,/g, "").trim());
      return isNaN(n) ? 0 : n;
    };

    const rawRecords: any[] = [];

    /* --------------------------------------------------
       STEP 3: BUILD RAW RECORDS
    -------------------------------------------------- */
    for (const headerIndex of headerIndexes) {
      const headers = normalizeRow(rows[headerIndex]);
      const idx: Record<string, number> = {};
      headers.forEach((h, i) => (idx[h] = i));

      const findCol = (k: string) => Object.entries(idx).find(([h]) => h.includes(k))?.[1];

      const dealerCol = findCol("DEALER");
      const depositCol = findCol("SECURITY") ?? findCol("DEPOSIT");
      const pendingCol = findCol("PENDING") ?? findCol("OUTSTANDING");

      const bucketMap = {
        lessThan10Days: findCol("< 10"),
        days10To15: findCol("10-15"),
        days15To21: findCol("15-21"),
        days21To30: findCol("21-30"),
        days30To45: findCol("30-45"),
        days45To60: findCol("45-60"),
        days60To75: findCol("60-75"),
        days75To90: findCol("75-90"),
        greaterThan90Days: findCol("> 90"),
      };

      for (let i = headerIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.length) continue;

        const dealerNameRaw = dealerCol !== undefined ? String(row[dealerCol] ?? "").trim() : "";

        // 🔥 LOGIC: Explicit Skips (Forensic Mode)
        if (!dealerNameRaw) {
          console.log("[OUT-SKIPPED] Empty dealer row");
          continue;
        }

        const upper = dealerNameRaw.toUpperCase();

        if (upper.includes("GRAND TOTAL")) {
          // 🔥 CHANGED: Continue instead of break to avoid silent truncation
          console.log("[OUT-DERIVED] Grand Total skipped.");
          continue;
        }

        if (upper.includes("TOTAL") || upper.includes("SUMMARY")) {
          console.log("[OUT-SKIPPED] Derived row:", dealerNameRaw);
          continue;
        }

        const normalizedName = this.normalizeName(dealerNameRaw);
        const resolvedDealerId = dealerMap.get(normalizedName) || null;

        // 🔥 CHANGED: Do NOT skip unmatched. Insert them.
        if (!resolvedDealerId) {
          console.log("[OUT-UNMATCHED] Dealer not in verified table. Still inserting:", {
            dealerNameRaw,
            normalizedName
          });
        }

        const bucketValues: any = {};
        for (const key of Object.keys(bucketMap)) {
          const colIndex = bucketMap[key as keyof typeof bucketMap];
          bucketValues[key] = colIndex !== undefined ? num(row[colIndex]) : 0;
        }

        const record = {
          id: randomUUID(),
          reportDate: reportDate,
          verifiedDealerId: resolvedDealerId,
          isAccountJsbJud: isAccountJsbJud,
          // ⚠️ Storing raw name temporarily for proper deduplication key generation
          tempDealerName: dealerNameRaw,

          securityDepositAmt: String(depositCol !== undefined ? num(row[depositCol]) : 0),
          pendingAmt: String(pendingCol !== undefined ? num(row[pendingCol]) : 0),
          lessThan10Days: String(bucketValues.lessThan10Days),
          days10To15: String(bucketValues.days10To15),
          days15To21: String(bucketValues.days15To21),
          days21To30: String(bucketValues.days21To30),
          days30To45: String(bucketValues.days30To45),
          days45To60: String(bucketValues.days45To60),
          days60To75: String(bucketValues.days60To75),
          days75To90: String(bucketValues.days75To90),
          greaterThan90Days: String(bucketValues.greaterThan90Days),
          isOverdue: bucketValues.greaterThan90Days > 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // 🔥 LOGIC: Selected Row Logging
        console.log("[OUT-SELECTED]", {
          reportDate,
          dealer: dealerNameRaw,
          verifiedDealerId: resolvedDealerId,
          pending: pendingCol !== undefined ? num(row[pendingCol]) : 0,
          security: depositCol !== undefined ? num(row[depositCol]) : 0
        });

        rawRecords.push(record);
      }
    }

    console.log(`[VERIFY-OUT] Raw rows built: ${rawRecords.length}`);

    if (!rawRecords.length) {
      console.log("[OUTSTANDING] No valid rows found.");
      return;
    }

    /* --------------------------------------------------
       STEP 4: DEDUPLICATE (Last-Write-Wins)
    -------------------------------------------------- */
    const uniqueMap = new Map<string, any>();
    for (const rec of rawRecords) {
      // 🔥 CHANGED: Unique Constraint Logic
      // If ID exists, use ID. If not, use Raw Name to avoid collapsing all unmatched into one.
      const key = rec.verifiedDealerId
        ? `${rec.reportDate}_${rec.verifiedDealerId}_${rec.isAccountJsbJud}`
        : `${rec.reportDate}_${rec.tempDealerName}_${rec.isAccountJsbJud}`;

      uniqueMap.set(key, rec);
    }

    const finalRecords = Array.from(uniqueMap.values());
    console.log(`[OUTSTANDING] Deduplicated: ${rawRecords.length} -> ${finalRecords.length} unique rows.`);

    /* --------------------------------------------------
       STEP 5: EXECUTE UPSERT (WITH DB COUNTS)
    -------------------------------------------------- */

    // 🔥 LOGIC: DB Count Before
    const dbCountBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(outstandingReports)
      .where(eq(outstandingReports.reportDate, reportDate));

    console.log(`[VERIFY-OUT] DB rows BEFORE upsert: ${dbCountBefore[0]?.count}`);


    await db.insert(outstandingReports)
      .values(finalRecords)
      .onConflictDoUpdate({
        target: [
          outstandingReports.reportDate,
          outstandingReports.verifiedDealerId,
          outstandingReports.isAccountJsbJud
        ],
        set: {
          securityDepositAmt: sql`excluded.security_deposit_amt`,
          pendingAmt: sql`excluded.pending_amt`,
          lessThan10Days: sql`excluded.less_than_10_days`,

          // 🛠️ QUOTED IDENTIFIERS: Fixes "trailing junk after numeric literal"
          days10To15: sql`excluded."10_to_15_days"`,
          days15To21: sql`excluded."15_to_21_days"`,
          days21To30: sql`excluded."21_to_30_days"`,
          days30To45: sql`excluded."30_to_45_days"`,
          days45To60: sql`excluded."45_to_60_days"`,
          days60To75: sql`excluded."60_to_75_days"`,
          days75To90: sql`excluded."75_to_90_days"`,

          greaterThan90Days: sql`excluded.greater_than_90_days`,
          isOverdue: sql`excluded.is_overdue`,
          updatedAt: new Date(),
        }
      });

    // 🔥 LOGIC: DB Count After
    const dbCountAfter = await db
      .select({ count: sql<number>`count(*)` })
      .from(outstandingReports)
      .where(eq(outstandingReports.reportDate, reportDate));

    console.log(`[VERIFY-OUT] DB rows AFTER upsert: ${dbCountAfter[0]?.count}`);

    console.log(`[OUTSTANDING] Upserted ${finalRecords.length} records.`);
  }
  /* =========================================================
     HELPER: COLLECTIONS (UPSERT STRATEGY)
     Ensures historical data is preserved without duplicates
  ========================================================= */
  private async processCollectionRows(
    rows: (string | number | null)[][],
    institution: string | null,
    meta: { messageId: string; fileName?: string }
  ) {
    if (rows.length < 2) return;

    /* --------------------------------------------------
       STEP 0: FETCH AND MAP VERIFIED DEALERS
    -------------------------------------------------- */
    console.log("[COLLECTION] 🔍 Fetching Verified Dealers for lookup...");

    const allVerifiedDealers = await db
      .select({
        id: verifiedDealers.id,
        partyName: verifiedDealers.dealerPartyName,
        dealerCode: verifiedDealers.dealerCode
      })
      .from(verifiedDealers);

    const dealerMap = new Map<string, number>();
    allVerifiedDealers.forEach((d) => {
      if (d.partyName) dealerMap.set(this.normalizeName(d.partyName), d.id);
      if (d.dealerCode) dealerMap.set(this.normalizeName(d.dealerCode), d.id);
    });
    console.log(`[COLLECTION] ✅ Loaded ${dealerMap.size} dealer keys.`);

    /* ----------------------------------------------------
       STEP 1: INSTITUTION AUTO-DETECT (Deep Scan)
    ---------------------------------------------------- */
    let detectedInst = institution;

    if (!detectedInst) {
      const fileName = (meta.fileName || "").toUpperCase();
      const titleBlock = rows.slice(0, 50).map(r => r.join(" ").toUpperCase()).join(" ");

      if (fileName.includes("JSB") || titleBlock.includes("JSB")) detectedInst = "JSB";
      else if (fileName.includes("JUD") || titleBlock.includes("JUD")) detectedInst = "JUD";
    }

    const safeInstitution = detectedInst ?? null;

    /* ------------------------------------------------------
       STEP 2: FIND HEADERS & CONFIGURE PARSERS
    ------------------------------------------------------ */
    const headerIndex = rows.findIndex((r) => {
      const line = r.map((c) => String(c ?? "").toUpperCase().trim()).join(" ");
      return line.includes("VOUCHER") && line.includes("DATE") && line.includes("PARTY");
    });

    if (headerIndex === -1) {
      console.error("[COLLECTION] Header row (VOUCHER/DATE/PARTY) not found.");
      return;
    }

    // Normalize Headers
    const headers = rows[headerIndex].map((h) =>
      String(h).trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    );
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    const get = (row: any[], col: string): string | null => {
      const i = idx[col];
      return i !== undefined && row[i] != null ? String(row[i]).trim() : null;
    };

    const parseAmount = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));

    // Row-level date parser (handles Excel Serial or Text Strings)
    const parseDate = (raw: any): string => {
      try {
        if (typeof raw === "number") {
          // Excel Serial Date
          const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
          return d.toISOString().split("T")[0];
        }
        const str = String(raw ?? "").trim();
        // DD/MM/YYYY or DD-MM-YYYY
        const dmy = str.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (dmy) {
          const [_, dd, mm, yyyy] = dmy;
          return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
        // Attempt standard parse
        return new Date(str).toISOString().split("T")[0];
      } catch {
        // Fallback to today if unparseable (prevents crash)
        return new Date().toISOString().split("T")[0];
      }
    };

    /* --------------------------------------------------
       STEP 3: BUILD RECORDS & DEDUPLICATE
    -------------------------------------------------- */
    const uniqueRecords = new Map<string, any>();

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const voucherNo = get(row, "VOUCHER NO");

      // Skip derived rows or empty voucher rows
      if (!voucherNo || this.isDerivedRow(voucherNo)) continue;

      const partyNameRaw = get(row, "PARTY NAME");

      // 🔥 LOGIC: Forensic Unmatched Logging
      const normalizedName = this.normalizeName(partyNameRaw || "");
      const resolvedDealerId = dealerMap.get(normalizedName) || null;

      if (!resolvedDealerId && partyNameRaw) {
        console.log("[COLLECTION-UNMATCHED]", {
          voucherNo,
          partyNameRaw,
          normalizedName
        });
      }

      const record = {
        id: randomUUID(),
        institution: safeInstitution,
        voucherNo,
        voucherDate: parseDate(get(row, "DATE")),
        partyName: partyNameRaw,
        verifiedDealerId: resolvedDealerId,
        zone: get(row, "ZONE"),
        district: get(row, "DISTRICT"),
        salesPromoterName: get(row, "SALES PROMOTER"),
        bankAccount: get(row, "BANK ACCOUNT"),
        amount: parseAmount(get(row, "AMOUNT")),
        remarks: get(row, "REMARKS"),
        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      };

      // 🔥 LOGIC: Selected Row Logging
      console.log("[COLLECTION-SELECTED]", {
        voucherNo,
        institution: safeInstitution,
        partyName: partyNameRaw,
        verifiedDealerId: resolvedDealerId,
        amount: record.amount,
        date: record.voucherDate
      });

      // Deduplicate in memory (Voucher + Inst) - Last row wins
      uniqueRecords.set(`${voucherNo}_${safeInstitution}`, record);
    }

    const finalRecords = Array.from(uniqueRecords.values());

    if (!finalRecords.length) {
      console.log("[COLLECTION] No valid rows found.");
      return;
    }

    /* --------------------------------------------------
       STEP 4: EXECUTE UPSERT (WITH VERIFICATION)
    -------------------------------------------------- */

    // 🔥 LOGIC: DB Count Before (Fixed Type Error by coalescing null to empty string)
    const dbCountBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectionReports)
      .where(eq(collectionReports.institution, safeInstitution ?? ""));

    console.log(`[VERIFY-COL] DB rows BEFORE upsert: ${dbCountBefore[0]?.count}`);

    await db.insert(collectionReports)
      .values(finalRecords)
      .onConflictDoUpdate({
        target: [
          collectionReports.voucherNo,
          collectionReports.institution
        ],
        set: {
          voucherDate: sql`excluded.voucher_date`,
          partyName: sql`excluded.party_name`,
          verifiedDealerId: sql`excluded.verified_dealer_id`,
          zone: sql`excluded.zone`,
          district: sql`excluded.district`,
          salesPromoterName: sql`excluded.sales_promoter_name`,
          bankAccount: sql`excluded.bank_account`,
          amount: sql`excluded.amount`,
          remarks: sql`excluded.remarks`,
          sourceMessageId: sql`excluded.source_message_id`,
          sourceFileName: sql`excluded.source_file_name`,
        }
      });

    // 🔥 LOGIC: DB Count After (Fixed Type Error)
    const dbCountAfter = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectionReports)
      .where(eq(collectionReports.institution, safeInstitution ?? ""));

    console.log(`[VERIFY-COL] DB rows AFTER upsert: ${dbCountAfter[0]?.count}`);

    console.log(`[COLLECTION] Upserted ${finalRecords.length} rows for ${safeInstitution}`);
  }
  /* =========================================================
          HELPER: PROJECTIONS (UPSERT STRATEGY)
          Updated: Lossless Ingestion (No Memory Dedup)
       ========================================================= */
  private async processProjectionRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string },
    institution: string | null
  ) {
    if (rows.length < 2) return;

    console.log("[PROJECTION] 🔍 Fetching Verified Dealers for lookup...");

    const allVerifiedDealers = await db
      .select({
        id: verifiedDealers.id,
        partyName: verifiedDealers.dealerPartyName,
        dealerCode: verifiedDealers.dealerCode
      })
      .from(verifiedDealers);

    const dealerMap = new Map<string, number>();
    allVerifiedDealers.forEach((d) => {
      if (d.partyName) dealerMap.set(this.normalizeName(d.partyName), d.id);
      if (d.dealerCode) dealerMap.set(this.normalizeName(d.dealerCode), d.id);
    });
    console.log(`[PROJECTION] ✅ Loaded ${dealerMap.size} dealer keys.`);

    /* ----------------------------------------------------
       INSTITUTION DETECT
    ---------------------------------------------------- */
    let detectedInst = institution;
    if (!detectedInst) {
      const fileName = (meta.fileName || "").toUpperCase();
      const cleanFileName = fileName.replace(/[\.\s]/g, "");
      const titleBlock = rows.slice(0, 50).map(r => r.join(" ").toUpperCase()).join(" ");
      const cleanTitleBlock = titleBlock.replace(/[\.]/g, "");

      if (cleanFileName.includes("JSB") || cleanTitleBlock.includes("JSB") || titleBlock.includes("J S B")) {
        detectedInst = "JSB";
      } else if (cleanFileName.includes("JUD") || cleanTitleBlock.includes("JUD") || titleBlock.includes("J U D")) {
        detectedInst = "JUD";
      }
    }
    const safeInstitution = detectedInst ?? null;
    console.log(`[PROJECTION] 🏢 Detected Institution: ${safeInstitution || "UNKNOWN"}`);

    const reportDate = this.extractReportDate(rows);

    /* ------------------------------------------------------
       HEADER & COLUMN MAPPING
    ------------------------------------------------------ */
    const headerIndex = rows.findIndex(r =>
      r.some(c => String(c ?? "").toUpperCase().includes("ZONE"))
    );

    if (headerIndex === -1) {
      console.error("[PROJECTION] ZONE header not found. Aborting.");
      return;
    }

    const top = rows[headerIndex] ?? [];
    const bottom = rows[headerIndex + 1] ?? [];
    const headers = top.map((_, i) => {
      const t = String(top[i] ?? "").trim().toUpperCase();
      const b = String(bottom[i] ?? "").trim().toUpperCase();
      return (t + " " + b).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    });

    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    const findCol = (keyword: string) => Object.entries(idx).find(([h]) => h.includes(keyword))?.[1];

    const zoneCol = findCol("ZONE");
    const orderDealerCol = findCol("ORDER PROJECTION") ?? findCol("ORDER DEALER");
    const orderQtyCol = findCol("QNTY") ?? findCol("MT");
    const collDealerCol = findCol("COLLECTION PROJECTION") ?? findCol("COLLECTION DEALER");
    const collAmtCol = findCol("AMOUNT");

    if (zoneCol === undefined) {
      console.error("[PROJECTION] ZONE column missing.");
      return;
    }

    const num = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));

    /* --------------------------------------------------
       BUILD + SUM RECORDS (Aggregating Duplicates)
    -------------------------------------------------- */
    const uniqueMap = new Map<string, any>();

    for (let i = headerIndex + 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const zone = String(row[zoneCol] ?? "").trim();
      const orderDealer = orderDealerCol !== undefined ? String(row[orderDealerCol] ?? "").trim() : "";
      const collDealer = collDealerCol !== undefined ? String(row[collDealerCol] ?? "").trim() : "";

      if (this.isDerivedRow(orderDealer, collDealer)) continue;

      // 🔥 FIX 1: FILTER GHOST ROWS
      // If no dealers are named AND the zone is empty/generic, skip it.
      // This prevents the "NAME__" collision crash.
      if (!orderDealer && !collDealer) continue;

      let resolvedDealerId: number | null = null;
      if (orderDealer) resolvedDealerId = dealerMap.get(this.normalizeName(orderDealer)) || null;
      if (!resolvedDealerId && collDealer)
        resolvedDealerId = dealerMap.get(this.normalizeName(collDealer)) || null;

      if (!resolvedDealerId && (orderDealer || collDealer)) {
        console.log("[PROJECTION-UNMATCHED]", { orderDealer, collDealer });
      }

      // Prepare Values
      const currentOrderQty = orderQtyCol !== undefined ? num(row[orderQtyCol]) : 0;
      const currentCollAmt = collAmtCol !== undefined ? num(row[collAmtCol]) : 0;

      // Identify Record (ID Priority)
      const dedupIdentifier = resolvedDealerId
        ? `ID_${resolvedDealerId}`
        : `NAME_${orderDealer}_${collDealer}`;

      const key = `${reportDate}_${safeInstitution}_${zone}_${dedupIdentifier}`;

      // 🔥 FIX 2: SUMMING LOGIC
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key);
        existing.orderQtyMt += currentOrderQty;
        existing.collectionAmount += currentCollAmt;

        console.log(`[PROJECTION-MERGE] Merged duplicate for ${dedupIdentifier}. New Total: ${existing.orderQtyMt}`);
      } else {
        const record = {
          id: randomUUID(),
          institution: safeInstitution,
          reportDate,
          verifiedDealerId: resolvedDealerId,
          zone,
          orderDealerName: orderDealer,
          orderQtyMt: currentOrderQty,
          collectionDealerName: collDealer,
          collectionAmount: currentCollAmt,
          sourceMessageId: meta.messageId,
          sourceFileName: meta.fileName,
        };
        uniqueMap.set(key, record);
      }
    }

    const finalRecords = Array.from(uniqueMap.values());

    console.log(`[VERIFY] Sheet prepared ${finalRecords.length} AGGREGATED rows for ${reportDate}`);

    if (!finalRecords.length) {
      console.log("[PROJECTION] No valid rows found");
      return;
    }

    /* --------------------------------------------------
       EXECUTE UPSERT
    -------------------------------------------------- */
    const dbCountBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectionReports)
      .where(eq(projectionReports.reportDate, reportDate));

    console.log(`[VERIFY-PROJECTION] BEFORE: ${dbCountBefore[0]?.count}`);

    await db.insert(projectionReports)
      .values(finalRecords)
      .onConflictDoUpdate({
        target: [
          projectionReports.reportDate,
          projectionReports.orderDealerName,
          projectionReports.collectionDealerName,
          projectionReports.institution,
          projectionReports.zone, // ⚠️ Ensure your DB Index actually has 'zone' in it!
        ],
        set: {
          verifiedDealerId: sql`excluded.verified_dealer_id`,
          orderQtyMt: sql`excluded.order_qty_mt`,
          collectionAmount: sql`excluded.collection_amount`,
          zone: sql`excluded.zone`,
          sourceMessageId: sql`excluded.source_message_id`,
          sourceFileName: sql`excluded.source_file_name`,
        },
      });

    const dbCountAfter = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectionReports)
      .where(eq(projectionReports.reportDate, reportDate));

    console.log(`[VERIFY-PROJECTION] AFTER: ${dbCountAfter[0]?.count}`);
    console.log(`[PROJECTION] Upserted ${finalRecords.length} rows for ${reportDate}`);
  }
  /* =========================================================
       HELPER: PROJECTION VS ACTUAL (UPSERT STRATEGY)
       Supports deep historical scanning and record merging
    ========================================================= */
  /* =========================================================
         HELPER: PROJECTION VS ACTUAL (UPSERT STRATEGY)
         Updated: Lossless Ingestion (No Filters, No Memory Dedup)
      ========================================================= */
  private async processProjectionVsActualRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string },
    institution: string | null
  ) {
    if (rows.length < 2) return;

    /* --------------------------------------------------
       STEP 0: FETCH AND MAP VERIFIED DEALERS
    -------------------------------------------------- */
    console.log("[PROJ-VS-ACTUAL] 🔍 Fetching Verified Dealers for lookup...");

    const allVerifiedDealers = await db
      .select({
        id: verifiedDealers.id,
        partyName: verifiedDealers.dealerPartyName,
        dealerCode: verifiedDealers.dealerCode
      })
      .from(verifiedDealers);

    const dealerMap = new Map<string, number>();
    allVerifiedDealers.forEach((d) => {
      if (d.partyName) dealerMap.set(this.normalizeName(d.partyName), d.id);
      if (d.dealerCode) dealerMap.set(this.normalizeName(d.dealerCode), d.id);
    });

    console.log(`[PROJ-VS-ACTUAL] ✅ Loaded ${dealerMap.size} dealer keys.`);

    /* ----------------------------------------------------
       STEP 1: INSTITUTION AUTO-DETECT (Deep Scan)
    ---------------------------------------------------- */
    let detectedInst = institution;

    if (!detectedInst) {
      const fileName = (meta.fileName || "").toUpperCase();
      const cleanFileName = fileName.replace(/[\.\s]/g, "");

      // Scan first 50 rows for branding
      const titleBlock = rows.slice(0, 50).map(r => r.join(" ").toUpperCase()).join(" ");
      const cleanTitleBlock = titleBlock.replace(/[\.]/g, "");

      if (cleanFileName.includes("JSB") || cleanTitleBlock.includes("JSB") || titleBlock.includes("J S B")) {
        detectedInst = "JSB";
      } else if (cleanFileName.includes("JUD") || cleanTitleBlock.includes("JUD") || titleBlock.includes("J U D")) {
        detectedInst = "JUD";
      }
    }

    const safeInstitution = detectedInst ?? null;
    console.log(`[PROJ-VS-ACTUAL] 🏢 Detected Institution: ${safeInstitution || "UNKNOWN"}`);

    /* ------------------------------------------------------
       2. EXTRACT REPORT DATE
    ------------------------------------------------------ */
    const reportDate = this.extractReportDate(rows);

    /* ------------------------------------------------------
       3. FIND HEADER START
    ------------------------------------------------------ */
    const headerIndex = rows.findIndex(r =>
      r.some(c => String(c ?? "").toUpperCase().includes("ZONE"))
    );

    if (headerIndex === -1) {
      console.error("[PROJ-VS-ACTUAL] ZONE header not found. Skipping sheet.");
      return;
    }

    /* ------------------------------------------------------
       4. MERGE HEADER ROWS & MAP COLUMNS
    ------------------------------------------------------ */
    const top = rows[headerIndex] ?? [];
    const bottom = rows[headerIndex + 1] ?? [];

    const headers = top.map((_, i) => {
      const t = String(top[i] ?? "").trim().toUpperCase();
      const b = String(bottom[i] ?? "").trim().toUpperCase();
      return (t + " " + b).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    });

    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    const findCol = (keyword: string) => Object.entries(idx).find(([h]) => h.includes(keyword))?.[1];

    const zoneCol = findCol("ZONE");
    const orderProjCol = findCol("ORDER PROJECTION") ?? findCol("YESTERDAY ORDER");
    const actualOrderCol = findCol("ACTUAL ORDER");
    const doDoneCol = findCol("DO DONE");
    const collProjCol = findCol("COLLECTION PROJECTION") ?? findCol("YESTERDAY COLLECTION");
    const actualCollCol = findCol("ACTUAL COLLECTION");
    const dealerCol = findCol("DEALER");

    if (zoneCol === undefined) {
      console.error("[PROJ-VS-ACTUAL] ZONE column missing.");
      return;
    }

    const num = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));

    /* ------------------------------------------------------
       5. BUILD RECORDS (NO MEMORY DEDUP)
    ------------------------------------------------------ */
    const finalRecords: any[] = [];
    let currentZone = "";

    for (let i = headerIndex + 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const rawZone = String(row[zoneCol] ?? "").trim();
      if (rawZone) currentZone = rawZone;

      // 🔥 LOGIC: Removed aggressive zone filter. Use current or raw or empty.
      const zoneToUse = currentZone || rawZone || "";

      let dealer = "";
      if (dealerCol !== undefined) {
        dealer = String(row[dealerCol] ?? "").trim();
      } else if (orderProjCol !== undefined) {
        // Fallback: assume dealer is to the left of Order Projection if no explicit column
        dealer = String(row[orderProjCol - 1] ?? "").trim();
      }

      // 🔥 LOGIC: Only filter derived rows. Allow empty dealer names.
      if (this.isDerivedRow(dealer)) continue;

      const resolvedDealerId = dealerMap.get(this.normalizeName(dealer)) || null;

      // 🔥 LOGIC: Log Unmatched but do NOT skip
      if (!resolvedDealerId && dealer) {
        console.log("[PROJ-VS-ACTUAL-UNMATCHED]", dealer);
      }

      const orderProj = orderProjCol !== undefined ? num(row[orderProjCol]) : 0;
      const actualOrder = actualOrderCol !== undefined ? num(row[actualOrderCol]) : 0;
      const doDone = doDoneCol !== undefined ? num(row[doDoneCol]) : 0;
      const collProj = collProjCol !== undefined ? num(row[collProjCol]) : 0;
      const actualColl = actualCollCol !== undefined ? num(row[actualCollCol]) : 0;

      // 🔥 LOGIC: Removed "All Zero" Filter. Keep everything.

      const record = {
        id: randomUUID(),
        reportDate,
        institution: safeInstitution,
        zone: zoneToUse,
        dealerName: dealer,
        verifiedDealerId: resolvedDealerId,
        orderProjectionMt: orderProj,
        actualOrderReceivedMt: actualOrder,
        doDoneMt: doDone,
        projectionVsActualOrderMt: orderProj - actualOrder,
        actualOrderVsDoMt: actualOrder - doDone,
        collectionProjection: collProj,
        actualCollection: actualColl,
        shortFall: collProj - actualColl,
        percent: collProj ? Number(((actualColl / collProj) * 100).toFixed(2)) : 0,
        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      };

      // 🔥 LOGIC: Push directly. No map override.
      finalRecords.push(record);
    }

    if (!finalRecords.length) {
      console.log("[PROJ-VS-ACTUAL] No valid rows found in sheet.");
      return;
    }

    /* --------------------------------------------------
       STEP 6: EXECUTE UPSERT (WITH VERIFICATION)
    -------------------------------------------------- */

    // 🔎 [VERIFY STEP 1] Log Existing DB Count Before Upsert
    const dbCountBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectionVsActualReports)
      .where(eq(projectionVsActualReports.reportDate, reportDate));

    console.log(`[VERIFY-PVA] BEFORE: ${dbCountBefore[0]?.count}`);

    await db.insert(projectionVsActualReports)
      .values(finalRecords)
      .onConflictDoUpdate({
        target: [
          projectionVsActualReports.reportDate,
          projectionVsActualReports.dealerName,
          projectionVsActualReports.institution,
        ],
        set: {
          orderProjectionMt: sql`excluded.order_projection_mt`,
          actualOrderReceivedMt: sql`excluded.actual_order_received_mt`,
          doDoneMt: sql`excluded.do_done_mt`,
          projectionVsActualOrderMt: sql`excluded.projection_vs_actual_order_mt`,
          actualOrderVsDoMt: sql`excluded.actual_order_vs_do_mt`,
          collectionProjection: sql`excluded.collection_projection`,
          actualCollection: sql`excluded.actual_collection`,
          shortFall: sql`excluded.short_fall`,
          percent: sql`excluded.percent`,
          sourceMessageId: sql`excluded.source_message_id`,
          sourceFileName: sql`excluded.source_file_name`,
        },
      });

    // 🔎 [VERIFY STEP 2] Log DB Count After Upsert
    const dbCountAfter = await db
      .select({ count: sql<number>`count(*)` })
      .from(projectionVsActualReports)
      .where(eq(projectionVsActualReports.reportDate, reportDate));

    console.log(`[VERIFY-PVA] AFTER: ${dbCountAfter[0]?.count}`);

    console.log(`[PROJ-VS-ACTUAL] Upserted ${finalRecords.length} rows for ${reportDate}`);
  }
}