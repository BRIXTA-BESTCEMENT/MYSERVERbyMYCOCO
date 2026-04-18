// src/services/excel/excelService.ts

import axios from "axios";

export class ExcelService {
  private baseUrl = "https://graph.microsoft.com/v1.0";

  constructor(private accessToken: string) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  // 📥 READ EXCEL RANGE
  async readRange(fileId: string, sheetName: string, range: string) {
    const url = `${this.baseUrl}/me/drive/items/${fileId}/workbook/worksheets('${sheetName}')/range(address='${range}')`;

    const res = await axios.get(url, { headers: this.headers });

    return res.data;
  }

  // 📤 WRITE EXCEL RANGE
  async writeRange(
    fileId: string,
    sheetName: string,
    range: string,
    values: any[][]
  ) {
    const url = `${this.baseUrl}/me/drive/items/${fileId}/workbook/worksheets('${sheetName}')/range(address='${range}')`;

    const res = await axios.patch(
      url,
      { values },
      { headers: this.headers }
    );

    return res.data;
  }
}