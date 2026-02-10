import XLSX from "xlsx";
import { db } from "../../db/db";
import {
  emailReports,
  dailyTasks,
  collectionReports,
  projectionReports,
  projectionVsActualReports,
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { EmailSystem } from "../../services/emailSystem";
import { randomUUID } from "crypto";

type SheetCandidate = {
  name: string;
  rows: (string | number | null)[][];
};

export class EmailSystemWorker {
  private emailSystem = new EmailSystem();

  /* =========================================================
     HELPER: DETECT DERIVED / TOTAL ROWS
  ========================================================= */
  private isDerivedRow(...values: (string | null | undefined)[]): boolean {
    const text = values
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    if (!text) return true;

    return (
      text.includes("TOTAL") ||
      text.includes("GRAND") ||
      text.includes("SUBTOTAL") ||
      text.includes("SUMMARY")
    );
  }

  /* =========================================================
     MAIN WORKER
  ========================================================= */

  async processInboxQueue() {
    console.log("[EmailWorker] Checking inbox...");

    // 1. Fetch unread mails with attachments
    const mails = await this.emailSystem.getUnreadWithAttachments();
    const list = mails.value ?? [];

    console.log(`[EmailWorker] Found ${list.length} mails`);

    for (const mail of list) {
      try {
        console.log(`[EmailWorker] Processing: ${mail.subject}`);

        /* -----------------------------------------
           Check for Duplicates (Idempotency)
        ----------------------------------------- */
        const existing = await db
          .select()
          .from(emailReports)
          .where(eq(emailReports.messageId, mail.id))
          .limit(1);

        if (existing.length) {
          console.log(`[EmailWorker] Skipping duplicate: ${mail.id}`);
          await this.emailSystem.markAsRead(mail.id);
          continue;
        }

        /* -----------------------------------------
           Get Attachments
        ----------------------------------------- */
        const attachments = await this.emailSystem.getAttachments(mail.id);
        const subject = mail.subject?.toUpperCase() ?? "";

        // Detect Institution Context ONCE
        const institutionContext = subject.includes("JSB")
          ? "JSB"
          : subject.includes("JUD")
            ? "JUD"
            : null;

        for (const file of attachments.value ?? []) {
          // Filter for Excel/CSV only
          if (!file.name?.match(/\.(xlsx|xls|csv)$/i)) continue;

          console.log(`[EmailWorker] Parsing ${file.name}`);

          const buffer = Buffer.from(file.contentBytes, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });

          /* -----------------------------------------
             SMART SHEET SELECTOR (FINAL FORM)
             Strategy: Collect ALL valid sheets → Use LAST one.
          ----------------------------------------- */
          const validSheets: SheetCandidate[] = [];

          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];

            // Native extraction
            const candidateRows = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              raw: false,
              defval: null,
            }) as (string | number | null)[][];

            if (!candidateRows.length) continue;

            // Heuristic: Does this sheet look like what we want?
            let looksLikeTarget = false;

            // Flatten first 10 rows for fast signature checking
            const signature = candidateRows
              .slice(0, 10)
              .map((r) => r.map((c) => String(c ?? "").toUpperCase()).join(" "))
              .join(" ");

            if (subject.includes("COLLECTION")) {
              // FOR COLLECTIONS: VOUCHER, DATE, PARTY
              looksLikeTarget =
                signature.includes("VOUCHER") &&
                signature.includes("DATE") &&
                signature.includes("PARTY");

            } else if (subject.includes("PJP")) {
              // FOR PJP: USER ID
              looksLikeTarget = signature.includes("USER ID");

            } else if (subject.includes("PROJECTION VS ACTUAL")) {
              // FOR PROJ VS ACTUAL: ZONE, ACTUAL, PROJECTION
              looksLikeTarget =
                signature.includes("ZONE") &&
                signature.includes("ACTUAL") &&
                signature.includes("PROJECTION");

            } else if (subject.includes("PROJECTION")) {
              // FOR PROJECTION PLAN: ZONE, DEALER, AMOUNT
              looksLikeTarget =
                signature.includes("ZONE") &&
                signature.includes("DEALER") &&
                signature.includes("AMOUNT");

            } else {
              // STANDARD REPORT
              looksLikeTarget = candidateRows.length > 0;
            }

            if (looksLikeTarget) {
              console.log(`[EmailWorker] Valid sheet candidate found: ${name}`);
              validSheets.push({ name, rows: candidateRows });
            }
          }

          if (!validSheets.length) {
            console.error(
              `[EmailWorker] No valid data sheet found in ${file.name}. Aborting.`
            );
            continue;
          }

          /* -----------------------------------------
             SELECT AUTHORITY: LAST VALID SHEET
          ----------------------------------------- */
          const { name: chosenName, rows } =
            validSheets[validSheets.length - 1];
          console.log(
            `[EmailWorker] Using LAST sheet as source of truth → ${chosenName}`
          );

          /* -----------------------------------------
             ROUTE LOGIC (ORDER MATTERS!)
          ----------------------------------------- */
          if (subject.includes("PJP")) {
            console.log("[EmailWorker] PJP Detected → Using Direct IDs");
            await this.processPjpRows(rows);

          } else if (subject.includes("COLLECTION")) {
            console.log("[EmailWorker] Collection Report Detected");
            await this.processCollectionRows(
              rows,
              institutionContext,
              {
                messageId: mail.id,
                fileName: file.name,
              }
            );

          } else if (subject.includes("PROJECTION VS ACTUAL")) {
            // 🚨 MUST CHECK THIS BEFORE 'PROJECTION'
            console.log("[EmailWorker] Projection vs Actual Report Detected");
            await this.processProjectionVsActualRows(
              rows,
              {
                messageId: mail.id,
                fileName: file.name,
              },
              institutionContext
            );

          } else if (subject.includes("PROJECTION")) {
            console.log("[EmailWorker] Projection Plan Detected");
            await this.processProjectionRows(
              rows,
              {
                messageId: mail.id,
                fileName: file.name,
              },
              institutionContext
            );

          } else {
            console.log("[EmailWorker] Standard Report → Archiving raw data");
            await db.insert(emailReports).values({
              messageId: mail.id,
              subject: mail.subject,
              sender: mail.from?.emailAddress?.address ?? null,
              fileName: file.name,
              payload: rows,
              processed: true,
            });
          }
        }

        // 3. Mark as read
        await this.emailSystem.markAsRead(mail.id);
      } catch (e) {
        console.error(`[EmailWorker] FAILED on mail ${mail.id}:`, e);
      }
    }
  }

  /* =========================================================
     HELPER: EXTRACT REPORT DATE (Scan Sheet Content)
  ========================================================= */
  private extractReportDate(rows: (string | number | null)[][]): string {
    // scan first 5 rows for a date-like cell
    for (let r = 0; r < Math.min(5, rows.length); r++) {
      for (const cell of rows[r]) {
        const text = String(cell ?? "").trim();

        // YYYY-MM-DD
        const iso = text.match(/\d{4}-\d{2}-\d{2}/);
        if (iso) return iso[0];

        // DD/MM/YYYY or DD-MM-YYYY
        const dmy = text.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
        if (dmy) {
          const [_, dd, mm, yyyy] = dmy;
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    // fallback ONLY if file truly has no date
    return new Date().toISOString().split("T")[0];
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

  /* =========================================================
     HELPER: COLLECTIONS (APPEND ONLY)
  ========================================================= */

  private async processCollectionRows(
    rows: (string | number | null)[][],
    institution: string | null,
    meta: { messageId: string; fileName?: string }
  ) {
    if (rows.length < 2) return;

    /* ----------------------------------------------------
       STEP 0: INSTITUTION AUTO-DETECT (TRIPLE CHECK)
    ---------------------------------------------------- */
    let detectedInst = institution;

    if (!detectedInst) {
      const fileName = (meta.fileName || "").toUpperCase();
      const titleRow = rows[0]?.join(" ").toUpperCase() || "";

      // Check Filename first (High confidence)
      if (fileName.includes("JSB")) detectedInst = "JSB";
      else if (fileName.includes("JUD")) detectedInst = "JUD";

      // Check Title Row inside Excel (Highest confidence)
      else if (titleRow.includes("JSB")) detectedInst = "JSB";
      else if (titleRow.includes("JUD")) detectedInst = "JUD";
    }

    const safeInstitution = detectedInst ?? null;

    // Find Header
    const headerIndex = rows.findIndex((r) => {
      const line = r
        .map((c) => String(c ?? "").toUpperCase().trim())
        .join(" ");
      return (
        line.includes("VOUCHER") &&
        line.includes("DATE") &&
        line.includes("PARTY")
      );
    });

    if (headerIndex === -1) {
      console.error("[COLLECTION] Header not found. Aborting.");
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
      if (i === undefined) return null;
      const v = row[i];
      return v != null ? String(v).trim() : null;
    };

    const parseAmount = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));

    // SAFE DATE PARSING (DD/MM/YYYY or DD-MM-YYYY)
    const parseDate = (raw: any): string => {
      try {
        // Excel serial
        if (typeof raw === "number") {
          const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
          return d.toISOString().split("T")[0];
        }

        const str = String(raw ?? "").trim();

        // DD/MM/YYYY or DD-MM-YYYY
        const dmy = str.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
        if (dmy) {
          const [_, dd, mm, yyyy] = dmy;
          return `${yyyy}-${mm}-${dd}`;
        }

        // ISO or safe fallback
        const d = new Date(str);
        return d.toISOString().split("T")[0];

      } catch {
        return new Date().toISOString().split("T")[0];
      }
    };

    // Build (No Delete Logic - Just Append)
    const records: any[] = [];
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const voucherNo = get(row, "VOUCHER NO");
      if (!voucherNo) continue;

      records.push({
        id: randomUUID(),
        institution: safeInstitution,
        voucherNo,
        voucherDate: parseDate(get(row, "DATE")),
        partyName: get(row, "PARTY NAME"),
        zone: get(row, "ZONE"),
        district: get(row, "DISTRICT"),
        salesPromoterName: get(row, "SALES PROMOTER"),
        bankAccount: get(row, "BANK ACCOUNT"),
        amount: parseAmount(get(row, "AMOUNT")),
        remarks: get(row, "REMARKS"),
        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      });
    }

    if (records.length) {
      await db.insert(collectionReports).values(records);
      console.log(`[COLLECTION] Appended ${records.length} rows for ${safeInstitution}`);
    }
  }

  /* =========================================================
     HELPER: PROJECTIONS (PLANNING) - APPEND ONLY
  ========================================================= */

  private async processProjectionRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string },
    institution: string | null
  ) {
    if (rows.length < 2) return;

    /* ------------------------------------------------------
       1. EXTRACT REPORT DATE (From Sheet Content)
    ------------------------------------------------------ */
    const reportDate = this.extractReportDate(rows);

    /* ------------------------------------------------------
       2. FIND HEADER START
    ------------------------------------------------------ */
    const headerIndex = rows.findIndex(r =>
      r.some(c => String(c ?? "").toUpperCase().includes("ZONE"))
    );

    if (headerIndex === -1) {
      console.error("[PROJECTION] ZONE header not found. Aborting.");
      return;
    }

    /* ------------------------------------------------------
       3. MERGE TWO HEADER ROWS & MAP COLUMNS
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

    // Explicit Column Resolution (No Fuzzy Guessing)
    const findCol = (keyword: string) =>
      Object.entries(idx).find(([h]) => h.includes(keyword))?.[1];

    const zoneCol = findCol("ZONE");

    // Prioritize specific column names to avoid "DEALER" ambiguity
    const orderDealerCol = findCol("ORDER PROJECTION") ?? findCol("ORDER DEALER");
    const orderQtyCol = findCol("QNTY") ?? findCol("MT");

    const collDealerCol = findCol("COLLECTION PROJECTION") ?? findCol("COLLECTION DEALER");
    const collAmtCol = findCol("AMOUNT");

    if (zoneCol === undefined) {
      console.error("[PROJECTION] ZONE column missing.");
      return;
    }

    const num = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));

    /* ------------------------------------------------------
       4. BUILD RECORDS (APPEND ONLY)
    ------------------------------------------------------ */
    const records: any[] = [];

    for (let i = headerIndex + 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const zone = String(row[zoneCol] ?? "").trim();
      if (!zone) continue;

      const orderDealer = orderDealerCol !== undefined ? String(row[orderDealerCol] ?? "").trim() : "";
      const collDealer = collDealerCol !== undefined ? String(row[collDealerCol] ?? "").trim() : "";

      // 🛑 HARD FILTER: SKIP TOTALS / SUMMARIES / BLANKS
      if (this.isDerivedRow(zone, orderDealer, collDealer)) continue;
      if (!orderDealer && !collDealer) continue;

      records.push({
        id: randomUUID(),
        institution: institution ?? null,
        reportDate,
        zone,
        orderDealerName: orderDealer || null,
        orderQtyMt: orderQtyCol !== undefined ? num(row[orderQtyCol]) : 0,
        collectionDealerName: collDealer || null,
        collectionAmount: collAmtCol !== undefined ? num(row[collAmtCol]) : 0,
        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      });
    }

    if (records.length) {
      await db.insert(projectionReports).values(records);
      console.log(`[PROJECTION] Appended ${records.length} rows`);
    }
  }

  /* =========================================================
     HELPER: PROJECTION VS ACTUAL (UPSERT STRATEGY)
  ========================================================= */
  private async processProjectionVsActualRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string },
    institution: string | null
  ) {
    if (rows.length < 2) return;

    /* ------------------------------------------------------
       1. EXTRACT REPORT DATE
    ------------------------------------------------------ */
    const reportDate = this.extractReportDate(rows);

    /* ------------------------------------------------------
       2. FIND HEADER START
    ------------------------------------------------------ */
    const headerIndex = rows.findIndex(r =>
      r.some(c => String(c ?? "").toUpperCase().includes("ZONE"))
    );

    if (headerIndex === -1) {
      console.error("[PROJ-VS-ACTUAL] ZONE header not found. Aborting.");
      return;
    }

    /* ------------------------------------------------------
       3. MERGE TWO HEADER ROWS & MAP COLUMNS
    ------------------------------------------------------ */
    const top = rows[headerIndex] ?? [];
    const bottom = rows[headerIndex + 1] ?? [];

    const headers = top.map((_, i) => {
      const t = String(top[i] ?? "").trim().toUpperCase();
      const b = String(bottom[i] ?? "").trim().toUpperCase();
      return (t + " " + b)
        .replace(/[^A-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    });

    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    const findCol = (keyword: string) =>
      Object.entries(idx).find(([h]) => h.includes(keyword))?.[1];

    const zoneCol = findCol("ZONE");

    const orderProjCol =
      findCol("ORDER PROJECTION") ?? findCol("YESTERDAY ORDER");
    const actualOrderCol = findCol("ACTUAL ORDER");
    const doDoneCol = findCol("DO DONE");

    const collProjCol =
      findCol("COLLECTION PROJECTION") ?? findCol("YESTERDAY COLLECTION");
    const actualCollCol = findCol("ACTUAL COLLECTION");

    // ⚠️ This report DOES NOT have a dedicated DEALER column
    const dealerCol = findCol("DEALER");

    if (zoneCol === undefined) {
      console.error("[PROJ-VS-ACTUAL] ZONE column missing.");
      return;
    }

    const num = (v: any) =>
      Number(String(v ?? "0").replace(/,/g, ""));

    /* ------------------------------------------------------
       4. BUILD RECORDS (ZONE INHERITANCE FIX)
    ------------------------------------------------------ */
    const uniqueRecords = new Map<string, any>();
    let currentZone = "";

    for (let i = headerIndex + 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      /* ---- ZONE: inherit from above ---- */
      const rawZone = String(row[zoneCol] ?? "").trim();
      if (rawZone) currentZone = rawZone;
      if (!currentZone) continue;

      const zone = currentZone;

      /* ---- DEALER: inferred from order projection column ---- */
      let dealer = "";

      if (dealerCol !== undefined) {
        dealer = String(row[dealerCol] ?? "").trim();
      } else if (orderProjCol !== undefined) {
        dealer = String(row[orderProjCol - 1] ?? "").trim();
      }

      if (!dealer) continue;

      // 🛑 Skip ONLY true totals
      const textCheck = `${zone} ${dealer}`.toUpperCase();
      if (
        textCheck.includes("TOTAL") ||
        textCheck.includes("GRAND") ||
        textCheck.includes("SUBTOTAL") ||
        textCheck.includes("SUMMARY")
      ) {
        continue;
      }

      const orderProj =
        orderProjCol !== undefined ? num(row[orderProjCol]) : 0;
      const actualOrder =
        actualOrderCol !== undefined ? num(row[actualOrderCol]) : 0;
      const doDone =
        doDoneCol !== undefined ? num(row[doDoneCol]) : 0;
      const collProj =
        collProjCol !== undefined ? num(row[collProjCol]) : 0;
      const actualColl =
        actualCollCol !== undefined ? num(row[actualCollCol]) : 0;

      // Skip empty spacer rows
      if (
        orderProj === 0 &&
        actualOrder === 0 &&
        doDone === 0 &&
        collProj === 0 &&
        actualColl === 0
      ) {
        continue;
      }

      const record = {
        id: randomUUID(),
        reportDate,
        institution: institution ?? null,
        zone,
        dealerName: dealer,
        orderProjectionMt: orderProj,
        actualOrderReceivedMt: actualOrder,
        doDoneMt: doDone,
        projectionVsActualOrderMt: orderProj - actualOrder,
        actualOrderVsDoMt: actualOrder - doDone,
        collectionProjection: collProj,
        actualCollection: actualColl,
        shortFall: collProj - actualColl,
        percent: collProj
          ? Number(((actualColl / collProj) * 100).toFixed(2))
          : 0,
        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      };

      uniqueRecords.set(`${zone}|${dealer}`, record);
    }

    const finalRecords = Array.from(uniqueRecords.values());

    if (!finalRecords.length) {
      console.log("[PROJ-VS-ACTUAL] No valid rows found");
      return;
    }

    await db
      .insert(projectionVsActualReports)
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

    console.log(
      `[PROJ-VS-ACTUAL] Upserted ${finalRecords.length} rows (History Preserved)`
    );
  }

}