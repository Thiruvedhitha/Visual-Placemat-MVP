import * as XLSX from "xlsx";
import type { ParsedCapabilityRow } from "@/types/capability";

/**
 * Parses an Excel/CSV buffer and extracts the capability hierarchy.
 *
 * Expects a sheet named "Capability Catalog" (or uses the first sheet)
 * with columns: L0 Capability Name | L1 Capability Name | L2 Capability Name | L3 Capability Name | Capability Description
 */
export function parseCapabilityCatalog(buffer: ArrayBuffer): ParsedCapabilityRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });

  // Try to find the "Capability Catalog" sheet, fall back to first sheet
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes("capability catalog")) ??
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rawRows.length < 2) {
    throw new Error("Sheet has no data rows");
  }

  // Find column indices from header row
  const header = rawRows[0] as string[];
  const colIndexes = {
    l0: header.findIndex((h) => /l0/i.test(String(h))),
    l1: header.findIndex((h) => /l1/i.test(String(h))),
    l2: header.findIndex((h) => /l2/i.test(String(h))),
    l3: header.findIndex((h) => /l3/i.test(String(h))),
    desc: header.findIndex((h) => /desc/i.test(String(h))),
  };

  // Validate we found at least L0
  if (colIndexes.l0 === -1) {
    throw new Error("Could not find L0 column in the header row. Expected a column containing 'L0'.");
  }

  // Parse data rows (skip header)
  const rows: ParsedCapabilityRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as (string | null | undefined)[];
    if (!row || row.length === 0) continue;

    const l0 = colIndexes.l0 >= 0 ? (row[colIndexes.l0]?.toString().trim() || null) : null;
    const l1 = colIndexes.l1 >= 0 ? (row[colIndexes.l1]?.toString().trim() || null) : null;
    const l2 = colIndexes.l2 >= 0 ? (row[colIndexes.l2]?.toString().trim() || null) : null;
    const l3 = colIndexes.l3 >= 0 ? (row[colIndexes.l3]?.toString().trim() || null) : null;
    const description = colIndexes.desc >= 0 ? (row[colIndexes.desc]?.toString().trim() || null) : null;

    // Skip completely empty rows
    if (!l0 && !l1 && !l2 && !l3) continue;

    rows.push({ l0, l1, l2, l3, description });
  }

  return rows;
}
