import * as XLSX from "xlsx";

type Cell = string | number | boolean | null | undefined;

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, "-").trim();
  const base = cleaned.slice(0, 31);
  return base || "Sheet1";
}

export function downloadWorkbookAsXlsx(rows: Cell[][], fileName: string, sheetName = "Export"): void {
  const normalized = rows.map((row) =>
    row.map((cell) => {
      if (cell == null || cell === "") return "";
      if (typeof cell === "number" && !Number.isFinite(cell)) return "";
      return cell;
    }),
  );
  const ws = XLSX.utils.aoa_to_sheet(normalized);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheetName));
  const name = fileName.toLowerCase().endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(wb, name);
}
