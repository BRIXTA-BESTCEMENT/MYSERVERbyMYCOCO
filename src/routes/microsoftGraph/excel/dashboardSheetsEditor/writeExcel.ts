// src/routes/microsoftGraph/excel/dashboardSheetsEditor/writeExcel.ts

import { Express, Request, Response } from "express";
import { verifyDashboardJWT } from "../../../../middleware/verifyDashboardJWT";
import { ExcelService } from "../../../../services/excel/excelService";
import { EmailSystem } from "../../../../services/email/emailSystem";

export default function setupWriteExcelRoute(app: Express) {
  app.post("/api/excel/write", verifyDashboardJWT,
    async (req: Request, res: Response) => {
      try {
        const { fileId, sheetName, range, values } = req.body;

        if (!fileId || !sheetName || !range || !values) {
          return res.status(400).json({ error: "Missing body params" });
        }

        const emailSystem = new EmailSystem();
        const accessToken = await (emailSystem as any).getAccessToken();

        const excelService = new ExcelService(accessToken);

        await excelService.writeRange(
          fileId,
          sheetName,
          range,
          values
        );

        return res.json({ success: true });
      } catch (err: any) {
        console.error("WRITE EXCEL ERROR:", err.message);
        return res.status(500).json({ error: "Failed to write excel" });
      }
    }
  );
}