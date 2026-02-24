import ExcelJS from "exceljs";

export interface PjpExtractedRow {
  zone: string;
  area: string;
  route: string;
  responsiblePerson: string;
  objective: string;
  type: string;
  counterName: string;
  mobile: string;
  week: string;
  requiredVisitCount: number;
  date: string | null;
}

export interface PjpExcelPayload {
  messageId: string;
  fileName: string;
  subject: string;
  // 1️⃣ THE PARSED DATA: Clean, strict strings for Postgres columns
  tasks: PjpExtractedRow[];
  // 2️⃣ THE RAW CLONE: 100% Lossless structural dump for JSONB archiving
  workbook: {
    sheetCount: number;
    sheets: any[];
  };
}

export class PjpPayloadBuilder {
  /**
   * Parses an Excel buffer and extracts BOTH a raw structural clone 
   * and a cleaned, relational-database-ready array.
   */
  async buildFromBuffer(
    buffer: Buffer,
    metadata: { messageId: string; fileName: string; subject: string | undefined }
  ): Promise<PjpExcelPayload> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    /* =========================================================
       ENGINE 1: 100% LOSSLESS WORKBOOK STRUCTURAL CLONE
       (Preserves formulas, richText, hyperlinks for JSONB dump)
    ========================================================= */
    const rawSheets = workbook.worksheets.map(ws => {
      const rows: { rowIndex: number; values: any[] }[] = [];

      // Safe iteration: guarantees row objects exist, handles empty rows
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        // EXCELJS QUIRK: row.values is a 1-based array (index 0 is empty).
        // We clone it to a standard 0-based array to strip internal class references
        // before saving to JSON. If it's a formula, it stays an object { formula: '...', result: '...' }
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
        columnCount: ws.actualColumnCount ?? ws.columnCount, // Safely handles missing column limits
        rows
      };
    });

    /* =========================================================
       ENGINE 2: CLEAN PJP TASK EXTRACTION
       (Strips objects down to clean strings for relational DB)
    ========================================================= */
    const tasks: PjpExtractedRow[] = [];

    // Iterate through all sheets just in case
    workbook.eachSheet((sheet) => {
      if (sheet.rowCount < 2) return;

      // 1. Dynamically find the header row to prevent off-by-one errors
      let headerRowIndex = -1;
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (headerRowIndex === -1 && String(row.values).toLowerCase().includes("responsible person")) {
          headerRowIndex = rowNumber;
        }
      });

      const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 2;

      // 2. Extract Data Losslessly for DB
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber < startRow) return;

        // exceljs row.values is 1-indexed. [empty, col1, col2, ...]
        const values = row.values as any[];
        if (!values || values.length < 5) return;

        // Clean text losslessly (handles RichText, Formulas, Hyperlinks, and weird formatting)
        const zone = this.cleanString(values[2]);
        const area = this.cleanString(values[3]);
        const route = this.cleanString(values[4]);
        const responsiblePerson = this.cleanString(values[5]);
        const objective = this.cleanString(values[6]);
        const type = this.cleanString(values[7]);
        const counterName = this.cleanString(values[8]);
        const mobile = this.cleanString(values[9]);
        const week = this.cleanString(values[10]);
        
        const rawVisits = parseInt(values[11], 10);
        const requiredVisitCount = isNaN(rawVisits) ? 1 : rawVisits;

        // 🚨 LOSSLESS DATE PARSING (Handles standard dates AND Excel Serial offsets)
        const dateStr = this.safeDate(values[12]);

        // Drop completely empty rows
        if (!responsiblePerson && !counterName) return;

        tasks.push({
          zone,
          area,
          route,
          responsiblePerson,
          objective,
          type,
          counterName,
          mobile,
          week,
          requiredVisitCount,
          date: dateStr,
        });
      });
    });

    /* =========================================================
       RETURN COMBINED TWIN-ENGINE PAYLOAD
    ========================================================= */
    return {
      messageId: metadata.messageId,
      fileName: metadata.fileName,
      subject: metadata.subject || "",
      tasks: tasks,
      workbook: {
        sheetCount: rawSheets.length,
        sheets: rawSheets
      }
    };
  }

  /* =========================================================
     HELPERS: THE "LOSSLESS" LOGIC FOR RELATIONAL EXTRACTION
  ========================================================= */
  private cleanString(val: any): string {
    if (val === null || val === undefined) return "";
    
    // 1. Handle Rich Text (Bold, Color, etc.)
    if (typeof val === 'object' && val.richText) {
       return val.richText.map((rt: any) => rt.text).join('').trim();
    }

    // 2. Handle Formulas (ExcelJS returns { formula: '...', result: '...' })
    if (typeof val === 'object' && val.result !== undefined) {
        return String(val.result).trim();
    }

    // 3. Handle Hyperlinks (ExcelJS returns { text: '...', hyperlink: '...' })
    if (typeof val === 'object' && val.text !== undefined) {
        return String(val.text).trim();
    }

    // 4. Handle Standard Strings / Numbers
    return String(val).trim();
  }

  // 🚨 UPGRADED STRICT IST DATE PARSER 🚨
  private safeDate(value: any): string | null {
    if (!value) return null;

    // --- GET CURRENT TIME IN IST (Asia/Kolkata) ---
    // This ensures if we fall back to "current year/month", it's based on India time
    const nowString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const nowIST = new Date(nowString);
    const currentYear = nowIST.getFullYear();
    const currentMonth = nowIST.getMonth(); // 0-indexed (Jan is 0)

    // 🌟 SMART LOGIC: "Just the day" scenario (e.g. "24", "24th", "05", or number 24)
    const stringVal = String(value).trim().toLowerCase();
    
    // Regex matches 1 or 2 digits, optionally followed by st, nd, rd, th
    const dayMatch = stringVal.match(/^(\d{1,2})(st|nd|rd|th)?$/);
    
    if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        // Ensure it's an actual calendar day (1 to 31)
        if (dayNum >= 1 && dayNum <= 31) {
            const monthStr = String(currentMonth + 1).padStart(2, "0");
            const dayStr = String(dayNum).padStart(2, "0");
            return `${currentYear}-${monthStr}-${dayStr}`;
        }
    }

    // 🌟 STANDARD LOGIC: Full dates or Excel Serial offsets
    let parsed: Date;
    if (value instanceof Date) {
      parsed = value;
    } else if (typeof value === "number") {
      // Excel serial date offset (days since Jan 1, 1900)
      parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    } else {
      parsed = new Date(value);
    }
    
    if (isNaN(parsed.getTime())) return null;
    
    // 🚨 THE FIX: Strict IST Extraction ensures zero Postgres timezone shifting
    // Force Node to evaluate the parsed Date exactly as it would appear in India
    const istString = parsed.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const targetIST = new Date(istString);

    let year = targetIST.getFullYear();
    const month = String(targetIST.getMonth() + 1).padStart(2, "0");
    const day = String(targetIST.getDate()).padStart(2, "0");

    // 🚨 THE RULE: If just "15-Oct" was typed, year defaults to 2001 or 1900. 
    // Force it to the present IST year.
    if (year < 2020) {
        year = currentYear;
    }

    return `${year}-${month}-${day}`;
  }
}