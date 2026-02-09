import XLSX from "xlsx";
import { db } from "../../db/db";
import {
  emailReports,
  dailyTasks,
  collectionReports,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { EmailSystem } from "../../services/emailSystem";
import { randomUUID } from "crypto";

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
             SMART SHEET SELECTOR (The Fix)
             Don't assume Sheet 0. Scan for the Real Table.
          ----------------------------------------- */
          let rows: (string | number | null)[][] | null = null;

          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            
            // Native extraction: handles merged cells, nulls, formatting
            const candidateRows = XLSX.utils.sheet_to_json(sheet, {
              header: 1,      
              raw: false,     
              defval: null,   
            }) as (string | number | null)[][];

            // Heuristic: Does this sheet look like what we want?
            let looksLikeTarget = false;

            if (subject.includes("COLLECTION")) {
              // FOR COLLECTIONS: Ignore Pivot Tables (Sheet 0). Look for Real Headers.
              looksLikeTarget = candidateRows.some(r => {
                const line = r.map(c => String(c ?? "").toUpperCase()).join(" ");
                return (
                  line.includes("VOUCHER") && 
                  line.includes("DATE") && 
                  line.includes("PARTY")
                );
              });
            } else if (subject.includes("PJP")) {
              // FOR PJP: Look for User ID
              looksLikeTarget = candidateRows.some(r => {
                const line = r.map(c => String(c ?? "").toUpperCase()).join(" ");
                return line.includes("USER ID");
              });
            } else {
              // STANDARD REPORT: Default to first non-empty sheet
              looksLikeTarget = candidateRows.length > 0;
            }

            if (looksLikeTarget) {
              console.log(`[EmailWorker] Using sheet: ${name}`);
              rows = candidateRows;
              break; // Stop looking, we found the data
            }
          }

          if (!rows) {
            console.error(`[EmailWorker] No valid data sheet found in ${file.name}. Aborting.`);
            continue;
          }

          /* -----------------------------------------
             ROUTE LOGIC
          ----------------------------------------- */
          if (subject.includes("PJP")) {
            console.log("[EmailWorker] PJP Detected → Using Direct IDs");
            await this.processPjpRows(rows);

          } else if (subject.includes("COLLECTION") && subject.includes("JUD")) {
            console.log("[EmailWorker] Collection (JUD) Detected");
            await this.processCollectionRows(rows, "JUD", {
              messageId: mail.id,
              fileName: file.name,
            });

          } else if (subject.includes("COLLECTION") && subject.includes("JSB")) {
            console.log("[EmailWorker] Collection (JSB) Detected");
            await this.processCollectionRows(rows, "JSB", {
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
        console.warn(`[PJP] Row ${i}: Invalid/Missing USER ID (${userIdRaw}). Skipping.`);
        continue;
      }

      const dateRaw = row[idx["DATE"]];
      let taskDateStr: string;

      try {
        let dateObj = new Date();
        if (typeof dateRaw === 'number') {
          dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
        } else if (dateRaw) {
          dateObj = new Date(String(dateRaw));
        }
        taskDateStr = dateObj.toISOString().split('T')[0];
      } catch (err) {
        taskDateStr = new Date().toISOString().split('T')[0];
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
     HELPER: COLLECTIONS (DELETE + INSERT)
  ========================================================= */

  private async processCollectionRows(
    rows: (string | number | null)[][],
    institution: "JUD" | "JSB",
    meta: { messageId: string; fileName?: string }
  ) {
    if (rows.length < 2) return;

    /* -----------------------------------------
       DEBUG: SEE WHAT EXCEL GAVE US
    ----------------------------------------- */
    console.log("[COLLECTION] Raw Data Preview:", rows.slice(0, 6));

    /* -----------------------------------------
       1. Find REAL header row (Multi-Keyword Scan)
       Checks if row contains VOUCHER, DATE, and PARTY
    ----------------------------------------- */
    const headerIndex = rows.findIndex(r => {
      // Flatten row to a single string for fuzzy matching
      const line = r
        .map(c => String(c ?? "").toUpperCase().trim())
        .join(" ");

      return (
        line.includes("VOUCHER") &&
        line.includes("DATE") &&
        line.includes("PARTY")
      );
    });

    if (headerIndex === -1) {
      console.error("[COLLECTION] Header not found (checked for VOUCHER+DATE+PARTY). Aborting.");
      return;
    }

    /* -----------------------------------------
       2. Normalize headers (Aggressive Cleaning)
    ----------------------------------------- */
    const headers = rows[headerIndex].map(h =>
      String(h)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "") // Kill dots, slashes, noise
        .replace(/\s+/g, " ")       // Normalize spaces
        .trim()
    );

    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    /* -----------------------------------------
       3. Helpers
    ----------------------------------------- */
    const get = (row: any[], col: string): string | null => {
      const i = idx[col];
      if (i === undefined) return null;
      const v = row[i];
      return v != null ? String(v).trim() : null;
    };

    const parseAmount = (v: any): number => {
      if (!v) return 0;
      return Number(String(v).replace(/,/g, ""));
    };

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

    /* -----------------------------------------
       4. Get report date FIRST & DELETE OLD
    ----------------------------------------- */
    let reportDate: string | null = null;

    // Take first valid date from sheet
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

    // NUKE PREVIOUS DATA FOR THIS DAY + INSTITUTION
    await db
      .delete(collectionReports)
      .where(
        and(
          eq(collectionReports.institution, institution),
          eq(collectionReports.voucherDate, reportDate)
        )
      );

    console.log(
      `[COLLECTION-${institution}] Cleared old data for ${reportDate}`
    );

    /* -----------------------------------------
       5. Build records
    ----------------------------------------- */
    const records: any[] = [];

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const voucherNo = get(row, "VOUCHER NO");
      if (!voucherNo) continue;

      records.push({
        id: randomUUID(),

        institution, // JUD or JSB

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

    /* -----------------------------------------
       6. Insert
    ----------------------------------------- */
    if (records.length) {
      await db.insert(collectionReports).values(records);
      console.log(`[COLLECTION-${institution}] Inserted ${records.length} rows`);
    } else {
      console.log(`[COLLECTION-${institution}] No valid rows`);
    }
  }
}