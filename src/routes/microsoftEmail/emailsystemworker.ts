import XLSX from "xlsx";
import { db } from "../../db/db";
import {
  emailReports,
  dailyTasks,
  collectionReports,
  projectionReports,
  projectionVsActualReports,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { EmailSystem } from "../../services/emailSystem";
import { randomUUID } from "crypto";

type SheetCandidate = {
  name: string;
  rows: (string | number | null)[][];
};

export class EmailSystemWorker {
  private emailSystem = new EmailSystem();

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

          } else if (
            subject.includes("COLLECTION") &&
            subject.includes("JUD")
          ) {
            console.log("[EmailWorker] Collection (JUD) Detected");
            await this.processCollectionRows(rows, "JUD", {
              messageId: mail.id,
              fileName: file.name,
            });

          } else if (
            subject.includes("COLLECTION") &&
            subject.includes("JSB")
          ) {
            console.log("[EmailWorker] Collection (JSB) Detected");
            await this.processCollectionRows(rows, "JSB", {
              messageId: mail.id,
              fileName: file.name,
            });

          } else if (subject.includes("PROJECTION VS ACTUAL")) {
            // 🚨 MUST CHECK THIS BEFORE 'PROJECTION'
            console.log("[EmailWorker] Projection vs Actual Report Detected");
            await this.processProjectionVsActualRows(rows, {
              messageId: mail.id,
              fileName: file.name,
            });

          } else if (subject.includes("PROJECTION")) {
            console.log("[EmailWorker] Projection Plan Detected");
            await this.processProjectionRows(rows, {
              messageId: mail.id,
              fileName: file.name,
            });

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
     HELPER: PJP → DAILY TASKS (ID BASED)
  ========================================================= */

  private async processPjpRows(rows: (string | number | null)[][]) {
    if (rows.length < 2) return;

    // 1. Normalize Headers
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
        console.warn(
          `[PJP] Row ${i}: Invalid/Missing USER ID (${userIdRaw}). Skipping.`
        );
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
    } else {
      console.log("[PJP] No valid tasks found to insert.");
    }
  }

  /* =========================================================
     HELPER: COLLECTIONS
  ========================================================= */

  private async processCollectionRows(
    rows: (string | number | null)[][],
    institution: "JUD" | "JSB",
    meta: { messageId: string; fileName?: string }
  ) {
    if (rows.length < 2) return;

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

    const parseDate = (raw: any): string => {
      try {
        let d = new Date();
        if (typeof raw === "number") {
          d = new Date(Math.round((raw - 25569) * 86400 * 1000));
        } else if (raw) {
          d = new Date(String(raw));
        }
        return d.toISOString().split("T")[0];
      } catch {
        return new Date().toISOString().split("T")[0];
      }
    };

    // Get Date
    let reportDate: string | null = null;
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const rawDate = get(rows[i], "DATE");
      if (rawDate) {
        reportDate = parseDate(rawDate);
        break;
      }
    }

    if (!reportDate) {
      console.log("[COLLECTION] No report date found. Aborting.");
      return;
    }

    // Nuke Old
    await db
      .delete(collectionReports)
      .where(
        and(
          eq(collectionReports.institution, institution),
          eq(collectionReports.voucherDate, reportDate)
        )
      );
    console.log(`[COLLECTION-${institution}] Cleared old data for ${reportDate}`);

    // Build
    const records: any[] = [];
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const voucherNo = get(row, "VOUCHER NO");
      if (!voucherNo) continue;

      records.push({
        id: randomUUID(),
        institution,
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
      console.log(`[COLLECTION-${institution}] Inserted ${records.length} rows`);
    }
  }

  /* =========================================================
     HELPER: PROJECTIONS (PLANNING) - FIXED FOR 2-ROW HEADER
  ========================================================= */

  private async processProjectionRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string }
  ) {
    if (rows.length < 2) return;

    // 1. Find the START of the header (Look for ZONE)
    const headerIndex = rows.findIndex(r =>
      r.some(c => String(c ?? "").toUpperCase().includes("ZONE"))
    );

    if (headerIndex === -1) {
      console.error("[PROJECTION] ZONE header not found. Aborting.");
      return;
    }

    // 2. Merge Row N and N+1 to create Effective Headers
    // Example: "ORDER" (top) + "DEALER" (bottom) -> "ORDER DEALER"
    const top = rows[headerIndex] ?? [];
    const bottom = rows[headerIndex + 1] ?? [];

    const headers = top.map((_, i) => {
      const t = String(top[i] ?? "").trim().toUpperCase();
      const b = String(bottom[i] ?? "").trim().toUpperCase();
      return (t + " " + b).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    });

    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    const get = (row: any[], ...keys: string[]) => {
      // Find the first column header that contains the key
      for (const key of keys) {
        const colHeader = Object.keys(idx).find(h => h.includes(key));
        if (colHeader) {
          return String(row[idx[colHeader]] ?? "").trim();
        }
      }
      return null;
    };

    const parseNum = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));
    const today = new Date().toISOString().split("T")[0];

    // 3. Clear Snapshot
    await db
      .delete(projectionReports)
      .where(eq(projectionReports.reportDate, today));

    console.log(`[PROJECTION] Cleared existing data for ${today}`);

    // 4. Extract
    const records: any[] = [];
    // Start scanning 2 rows after header start
    for (let i = headerIndex + 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const zone = get(row, "ZONE");
      if (!zone) continue;

      records.push({
        id: randomUUID(),
        institution: "JSB",
        reportDate: today,
        zone,

        // Fuzzy match handles "ORDER PROJECTION DEALER" or just "DEALER"
        orderDealerName: get(row, "ORDER DEALER", "DEALER"),
        orderQtyMt: parseNum(get(row, "QNTY", "MT")),

        collectionDealerName: get(row, "COLLECTION DEALER", "DEALER"),
        collectionAmount: parseNum(get(row, "AMOUNT")),

        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      });
    }

    if (records.length) {
      await db.insert(projectionReports).values(records);
      console.log(`[PROJECTION] Inserted ${records.length} rows`);
    }
  }

  /* =========================================================
     HELPER: PROJECTION VS ACTUAL - FIXED
     (Includes Deduplication to Fix Unique Constraint)
  ========================================================= */

  private async processProjectionVsActualRows(
    rows: (string | number | null)[][],
    meta: { messageId: string; fileName?: string }
  ) {
    if (rows.length < 2) return;

    // 1. Find the START of the header (Look for ZONE)
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => String(c ?? "").toUpperCase().includes("ZONE"))
    );

    if (headerIndex === -1) {
      console.error("[PROJ-VS-ACTUAL] ZONE header not found. Aborting.");
      return;
    }

    // 2. Merge Row N and N+1
    const top = rows[headerIndex] ?? [];
    const bottom = rows[headerIndex + 1] ?? [];

    const headers = top.map((_, i) => {
      const t = String(top[i] ?? "").trim().toUpperCase();
      const b = String(bottom[i] ?? "").trim().toUpperCase();
      return (t + " " + b).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    });

    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    const get = (row: any[], ...keys: string[]) => {
      for (const key of keys) {
        const colHeader = Object.keys(idx).find((h) => h.includes(key));
        if (colHeader) return String(row[idx[colHeader]] ?? "").trim();
      }
      return null;
    };

    const num = (v: any) => Number(String(v ?? "0").replace(/,/g, ""));
    const reportDate = new Date().toISOString().split("T")[0];

    // 3. Clear Snapshot
    await db
      .delete(projectionVsActualReports)
      .where(eq(projectionVsActualReports.reportDate, reportDate));

    console.log(`[PROJ-VS-ACTUAL] Cleared snapshot for ${reportDate}`);

    // 4. Extract with Deduplication Map
    const uniqueRecords = new Map<string, any>();

    for (let i = headerIndex + 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const zone = get(row, "ZONE");
      if (!zone) continue;

      // Relaxed Dealer Check: If missing, it's a Zone Total
      let dealer = get(row, "DEALER");
      if (!dealer) {
        dealer = `TOTAL - ${zone}`;
      }

      const orderProj = num(get(row, "ORDER PROJECTION", "YESTERDAY ORDER"));
      const actualOrder = num(get(row, "ACTUAL ORDER"));
      const doDone = num(get(row, "DO DONE"));
      const collProj = num(get(row, "COLLECTION PROJECTION", "YESTERDAY COLLECTION"));
      const actualColl = num(get(row, "ACTUAL COLLECTION"));

      // Filter completely empty "spacer" rows that happen to have a Zone
      if (
        orderProj === 0 && actualOrder === 0 && doDone === 0 &&
        collProj === 0 && actualColl === 0
      ) {
        continue; 
      }

      const record = {
        id: randomUUID(),
        reportDate,
        institution: "JSB",
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
        percent: collProj ? Number(((actualColl / collProj) * 100).toFixed(2)) : 0,
        sourceMessageId: meta.messageId,
        sourceFileName: meta.fileName,
      };

      // Composite Key for Deduplication: ZONE + DEALER
      // If the Excel has "Total" row and then another "Empty" row for same zone,
      // they both map to "TOTAL - {Zone}". We keep the last one (or first one).
      // Since this is a snapshot, overwriting is generally safer than inserting duplicates.
      const key = `${zone}|${dealer}`;
      
      if (uniqueRecords.has(key)) {
         // console.warn(`[PROJ-VS-ACTUAL] Deduping ${key} - Keeping latest.`);
      }
      uniqueRecords.set(key, record);
    }

    const finalRecords = Array.from(uniqueRecords.values());

    if (finalRecords.length) {
      await db.insert(projectionVsActualReports).values(finalRecords);
      console.log(`[PROJ-VS-ACTUAL] Inserted ${finalRecords.length} rows`);
    } else {
      console.log("[PROJ-VS-ACTUAL] No valid rows found");
    }
  }
}