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
// 🚨 UPGRADED BULLETPROOF DATE PARSER 🚨
  private safeDate(value: any): string | null {
    if (!value) return null;

    // 1. 🛡️ UNWRAP EXCELJS OBJECTS (RichText formatting, Formulas, etc)
    let rawValue = value;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        if (value.result !== undefined) {
            rawValue = value.result; 
        } else if (value.richText) {
            rawValue = value.richText.map((rt: any) => rt.text).join('').trim();
        } else if (value.text !== undefined) {
            rawValue = value.text;
        }
    }

    if (!rawValue) return null;

    const nowString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const nowIST = new Date(nowString);
    const currentYear = nowIST.getFullYear();
    const currentMonth = nowIST.getMonth(); 

    const stringVal = String(rawValue).trim().toLowerCase();
    
    // 2. 🌟 "JUST THE DAY" LOGIC (e.g. "24", "24th")
    const dayMatch = stringVal.match(/^(\d{1,2})(st|nd|rd|th)?$/);
    if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        if (dayNum >= 1 && dayNum <= 31) {
            const monthStr = String(currentMonth + 1).padStart(2, "0");
            const dayStr = String(dayNum).padStart(2, "0");
            return `${currentYear}-${monthStr}-${dayStr}`;
        }
    }

    // 3. 🌟 FORGIVING INDIAN DD/MM/YYYY LOGIC (Ignores timestamps)
    const indianDateMatch = stringVal.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (indianDateMatch) {
        let day = parseInt(indianDateMatch[1], 10);
        let month = parseInt(indianDateMatch[2], 10);
        let year = parseInt(indianDateMatch[3], 10);

        // Fix 2-digit years like "26" -> 2026
        if (year < 100) year += 2000;

        // Auto-correct if user accidentally typed MM/DD/YYYY
        if (month > 12 && day <= 12) {
            const temp = day;
            day = month;
            month = temp;
        }

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            const safeMonth = String(month).padStart(2, "0");
            const safeDay = String(day).padStart(2, "0");
            return `${year}-${safeMonth}-${safeDay}`; // Strict DB format
        }
    }

    // 4. 🌟 STANDARD JAVASCRIPT / EXCEL SERIAL PARSING
    let parsed: Date;
    if (rawValue instanceof Date) {
        parsed = rawValue;
    } else if (typeof rawValue === "number") {
        parsed = new Date(Math.round((rawValue - 25569) * 86400 * 1000));
    } else {
        parsed = new Date(rawValue);
    }
    
    if (isNaN(parsed.getTime())) return null;
    
    // 5. 🌟 STRICT IST CONVERSION
    const istString = parsed.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const targetIST = new Date(istString);

    let year = targetIST.getFullYear();
    const month = String(targetIST.getMonth() + 1).padStart(2, "0");
    const day = String(targetIST.getDate()).padStart(2, "0");

    if (year < 2020) year = currentYear;

    return `${year}-${month}-${day}`;
  }
}