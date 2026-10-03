import type { SourceSheet } from "./business-import";
const dateText = (value: Date) =>
  Number.isFinite(value.getTime())
    ? value.toISOString().slice(0, 10)
    : "[Invalid cached date/formula]";
export async function readExcelFiles(files: File[]): Promise<SourceSheet[]> {
  const excel = await import("exceljs");
  const Workbook = (excel.default ?? excel).Workbook;
  const sheets: SourceSheet[] = [];
  for (const [fi, file] of files.entries()) {
    if (file.size > 5_000_000) throw new Error("Maksimal 5 MB per file Excel.");
    const book = new Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    for (const [si, sheet] of book.worksheets.entries()) {
      const rowCount = sheet.rowCount;
      const columnCount = sheet.columnCount;
      if (rowCount > 5000 || columnCount > 100)
        throw new Error("Sheet melebihi 5000 baris / 100 kolom.");
      const rows: string[][] = [];
      for (let n = 1; n <= rowCount; n++) {
        const row: string[] = [];
        for (let c = 1; c <= columnCount; c++) {
          const cell = sheet.getRow(n).getCell(c);
          const v = cell.value;
          let text = "";
          if (v instanceof Date) text = dateText(v);
          else if (v && typeof v === "object") {
            if ("formula" in v || "sharedFormula" in v) {
              const result = "result" in v ? v.result : undefined;
              text =
                result instanceof Date
                  ? dateText(result)
                  : result && typeof result === "object" && "error" in result
                    ? String(result.error)
                    : result === undefined
                      ? ""
                      : String(result);
            } else if ("richText" in v)
              text = v.richText.map((t) => t.text).join("");
            else if ("hyperlink" in v)
              text = String(v.text || "") + " " + v.hyperlink;
            else if ("error" in v) text = String(v.error);
          } else if (v !== null && v !== undefined) text = String(v);
          row.push(text);
        }
        while (row.length && row[row.length - 1] === "") row.pop();
        rows.push(row);
      }
      while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
      sheets.push({
        id: `excel-${fi}-${si}`,
        file: file.name,
        title: sheet.name,
        rows,
      });
    }
  }
  return sheets;
}
