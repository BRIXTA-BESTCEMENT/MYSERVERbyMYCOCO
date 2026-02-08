import XLSX from "xlsx";
import { db } from "../../db/db";
import {
  emailReports,
  dailyTasks,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { EmailSystem } from "../../services/emailSystem";
import { randomUUID } from "crypto"; // <--- ADDED: Native Node UUID generator

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
        
        for (const file of attachments.value ?? []) {
          // Filter for Excel/CSV only
          if (!file.name?.match(/\.(xlsx|xls|csv)$/i)) continue;

          console.log(`[EmailWorker] Parsing ${file.name}`);

          const buffer = Buffer.from(file.contentBytes, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          
          // Grab first sheet
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          if (!sheet || !sheet["!ref"]) {
            console.log(`[EmailWorker] Empty sheet in ${file.name}`);
            continue;
          }

          // Extract pure data
          const rows = this.extractRawRows(sheet);

          /* -----------------------------------------
             ROUTE LOGIC: PJP vs REPORT
          ----------------------------------------- */
          const subject = mail.subject?.toUpperCase() ?? "";

          if (subject.includes("PJP")) {
            console.log("[EmailWorker] PJP Detected → Using Direct IDs");
            await this.processPjpRows(rows);
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
     HELPER: RAW GRID EXTRACTION
  ========================================================= */

  private extractRawRows(sheet: XLSX.WorkSheet) {
    const range = XLSX.utils.decode_range(sheet["!ref"]!);
    const rows: (string | number | null)[][] = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: (string | number | null)[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        row.push(cell ? cell.v : null);
      }
      rows.push(row);
    }
    return rows;
  }

  /* =========================================================
     HELPER: PJP → DAILY TASKS (ID BASED)
  ========================================================= */

  private async processPjpRows(rows: (string | number | null)[][]) {
    if (rows.length < 2) return;

    // 1. Normalize Headers
    const headers = rows[0].map((h) => String(h).trim().toUpperCase());
    
    // 2. Map Headers
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));

    // Validating required ID column
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

    // Start at index 1 (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length) continue;

      const userIdRaw = row[idx["USER ID"]];
      const userId = Number(userIdRaw);

      if (!userIdRaw || Number.isNaN(userId)) {
        console.warn(`[PJP] Row ${i}: Invalid/Missing USER ID (${userIdRaw}). Skipping.`);
        continue;
      }

      // Date Parsing
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
        id: randomUUID(), // <--- FIXED: Explicitly generating UUID here
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
}