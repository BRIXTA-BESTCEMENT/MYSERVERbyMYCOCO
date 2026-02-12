// src/routes/microsoftEmail/emailRoute.ts
import { Express, Request, Response } from "express";
import { EmailSystem } from "../../services/emailSystem";
import { z } from "zod";

const sendMailSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  content: z.string(),
});

export default function setupMicrosoftEmailRoutes(app: Express) {
  const emailSystem = new EmailSystem();

  // -------------------------
  // GET Inbox
  // -------------------------
  app.get("/api/email/inbox", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit || 5);

      const mails = await emailSystem.getInbox(limit);

      return res.json({
        success: true,
        data: mails,
      });
    } catch (err) {
      console.error("[email-inbox] error", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch inbox",
      });
    }
  });

  // -------------------------
  // SEND Mail
  // -------------------------
  app.post("/api/email/send", async (req: Request, res: Response) => {
    try {
      const parsed = sendMailSchema.parse(req.body);

      await emailSystem.sendMail(
        parsed.to,
        parsed.subject,
        parsed.content
      );

      return res.json({
        success: true,
      });
    } catch (err) {
      console.error("[email-send] error", err);

      return res.status(400).json({
        success: false,
        error: "Invalid send mail payload",
      });
    }
  });
}
