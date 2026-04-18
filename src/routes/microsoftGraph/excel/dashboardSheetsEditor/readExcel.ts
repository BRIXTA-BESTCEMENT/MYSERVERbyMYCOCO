// src/routes/microsoftGraph/excel/dashboardSheetsEditor/readExcel.ts

import { Express, Request, Response } from "express";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { ExcelService } from "../../../../services/excel/excelService";
import { EmailSystem } from "../../../../services/email/emailSystem";

export default function setupReadExcelRoute(app: Express) {
  app.get("/api/excel/read", verifyDashboardJWT,
    async (req: Request, res: Response) => {
      try {
        const { fileId, sheetName, range } = req.query;

        if (!fileId || !sheetName || !range) {
          return res.status(400).json({ error: "Missing params" });
        }

        // 🔑 Get Graph token (reuse your existing system)
        const emailSystem = new EmailSystem();
        const accessToken = await (emailSystem as any).getAccessToken();

        const excelService = new ExcelService(accessToken);

        const data = await excelService.readRange(
          String(fileId),
          String(sheetName),
          String(range)
        );

        return res.json({ success: true, data });
      } catch (err: any) {
        console.error("READ EXCEL ERROR:", err.message);
        return res.status(500).json({ error: "Failed to read excel" });
      }
    }
  );
}