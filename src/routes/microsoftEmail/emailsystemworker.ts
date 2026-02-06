import XLSX from "xlsx";
import { db } from "../../db/db";
import { emailReports } from "../../db/schema";
import { eq } from "drizzle-orm";
import { EmailSystem } from "../../services/emailSystem";

export class EmailSystemWorker {
  private emailSystem = new EmailSystem();

  async processInboxQueue() {

    console.log("[EmailWorker] Checking inbox...");
    const mails = await this.emailSystem.getUnreadWithAttachments();

    const list = mails.value ?? [];
    console.log(`[EmailWorker] Found ${list.length} mails`);

    for (const mail of mails.value ?? []) {
      try {

        console.log(`[EmailWorker] Processing: ${mail.subject}`);
        const existing = await db
          .select()
          .from(emailReports)
          .where(eq(emailReports.messageId, mail.id))
          .limit(1);

        if (existing.length) {
          await this.emailSystem.markAsRead(mail.id);
          continue;
        }

        const attachments =
          await this.emailSystem.getAttachments(mail.id);

        for (const file of attachments.value ?? []) {
          if (!file.name?.match(/\.(xlsx|xls|csv)$/i)) continue;

          console.log(`[EmailWorker] Parsing ${file.name}`);

          const buffer = Buffer.from(file.contentBytes, "base64");

          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheet =
            workbook.Sheets[workbook.SheetNames[0]];

          const json = XLSX.utils.sheet_to_json(sheet, {
            defval: null,
          });

          await db.insert(emailReports).values({
            messageId: mail.id,
            subject: mail.subject,
            sender: mail.from?.emailAddress?.address ?? null,
            fileName: file.name,
            payload: json,
            processed: true,
          });

          console.log(`[EmailWorker] Stored ${file.name}`);
        }

        await this.emailSystem.markAsRead(mail.id);
      } catch (e) {
        console.error("[EmailWorker] FAILED:", mail.id, e);
      }
    }
  }
}
