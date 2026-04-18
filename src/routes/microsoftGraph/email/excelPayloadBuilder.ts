import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
//MPOSTLY EXCEL JS documentation

export interface RawWorkbookPayload {
  payloadId: string;
  payloadName: string;
  schemaVersion: number;
  source: {
    messageId: string;
    fileName: string;
    subject?: string;
    sender?: string | null;
    receivedAt: string;
  };
  workbook: {
    sheetCount: number;
    sheets: any[];
  };
}

export class ExcelPayloadBuilder {
  async buildFromBuffer(
    buffer: Uint8Array,
    sourceMeta: {
      messageId: string;
      fileName: string;
      subject?: string;
      sender?: string | null;
    }
  ): Promise<RawWorkbookPayload> {

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheets = workbook.worksheets.map(ws => {
      const rows: { rowIndex: number; values: any[] }[] = [];

      // Safe iteration: guarantees row objects exist, handles empty rows
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        // row.values is 1-based array (index 0 unused by ExcelJS)
        // We clone it to a standard array to remove ExcelJS internal references
        const values = Array.isArray(row.values) ? [...row.values] : [];

        rows.push({
          rowIndex: rowNumber,
          values
        });
      });

      return {
        name: ws.name,
        state: ws.state,
        rowCount: ws.rowCount,
        columnCount: ws.columnCount,
        rows
      };
    });

    return {
      payloadId: randomUUID(),
      payloadName: `${sourceMeta.fileName}_${Date.now()}`,
      schemaVersion: 1,
      source: {
        messageId: sourceMeta.messageId,
        fileName: sourceMeta.fileName,
        subject: sourceMeta.subject,
        sender: sourceMeta.sender ?? null,
        receivedAt: new Date().toISOString()
      },
      workbook: {
        sheetCount: sheets.length,
        sheets
      }
    };
  }
}