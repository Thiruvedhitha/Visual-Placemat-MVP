import * as XLSX from "xlsx";
import type { ParsedCapabilityRow } from "@/types/capability";

type RawCell = string | number | boolean | null | undefined;
const DEFAULT_L0_NAME = "Blank";

function cellText(value: RawCell): string | null {
  const text = value?.toString().trim() ?? "";
  return text || null;
}

function parseLevel(value: RawCell): 0 | 1 | 2 | 3 | null {
  const text = value?.toString().trim().toUpperCase() ?? "";
  const match = text.match(/^L?([0-3])$/) ?? text.match(/^LEVEL\s*([0-3])$/);
  return match ? (Number(match[1]) as 0 | 1 | 2 | 3) : null;
}

function findNameColumn(header: string[], usedIndexes: Set<number>): number {
  const preferred = [/^capability\s*name$/i, /^process\s*name$/i, /^capability$/i, /^name$/i, /^title$/i];
  for (const pattern of preferred) {
    const index = header.findIndex((h, i) => !usedIndexes.has(i) && pattern.test(String(h).trim()));
    if (index >= 0) return index;
  }
  return header.findIndex((h, i) => {
    const text = String(h).trim();
    return !usedIndexes.has(i) && !/^(serial\s*no\.?|process\s*no\.?)$/i.test(text);
  });
}

function findDescriptionColumn(header: string[]): number {
  return header.findIndex((h) => /desc|definition/i.test(String(h)));
}

/**
 * Parses an Excel/CSV buffer and extracts the capability hierarchy.
 *
 * Expects a sheet named "Capability Catalog" (or uses the first sheet)
 * with either columns:
 * L0 Capability Name | L1 Capability Name | L2 Capability Name | L3 Capability Name | Capability Description
 * or: Level | Capability Name | Capability Description
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
    desc: findDescriptionColumn(header),
    level: header.findIndex((h) => /^level$/i.test(String(h).trim())),
  };

  const hasLevelColumns = colIndexes.l0 >= 0 || colIndexes.l1 >= 0 || colIndexes.l2 >= 0 || colIndexes.l3 >= 0;

  if (!hasLevelColumns && colIndexes.level === -1) {
    throw new Error("Could not find hierarchy columns. Expected L0/L1/L2/L3 columns or a 'Level' column.");
  }

  // Parse data rows (skip header)
  const rows: ParsedCapabilityRow[] = [];
  const currentNames: (string | null)[] = new Array(4).fill(null);

  if (!hasLevelColumns) {
    const usedIndexes = new Set([colIndexes.level, colIndexes.desc].filter((i) => i >= 0));
    const nameIndex = findNameColumn(header, usedIndexes);
    let rootLevel: 0 | 1 | 2 | 3 | null = null;
    let insertedDefaultL0 = false;
    const hasL0 = rawRows
      .slice(1)
      .some((row) => parseLevel((row as RawCell[])[colIndexes.level]) === 0);
    if (nameIndex === -1) {
      throw new Error("Could not find a capability name column. Expected 'Capability Name' or 'Name'.");
    }

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i] as RawCell[];
      if (!row || row.length === 0) continue;

      const level = parseLevel(row[colIndexes.level]);
      const name = cellText(row[nameIndex]);
      const description = colIndexes.desc >= 0 ? cellText(row[colIndexes.desc]) : null;

      if (level === null && !name) continue;
      if (level === null) throw new Error(`Invalid level in row ${i + 1}. Expected L0, L1, L2, or L3.`);
      if (!name) throw new Error(`Missing capability name in row ${i + 1}.`);

      if (!hasL0 && !insertedDefaultL0 && level > 0) {
        currentNames[0] = DEFAULT_L0_NAME;
        rows.push({ l0: DEFAULT_L0_NAME, l1: null, l2: null, l3: null, description: null });
        rootLevel = 0;
        insertedDefaultL0 = true;
      }

      if (rootLevel === null) rootLevel = level;
      if (level < rootLevel) rootLevel = level;
      if (level > rootLevel && !currentNames[level - 1]) {
        throw new Error(`Missing parent before row ${i + 1}. L${level} rows must appear after their L${level - 1} parent.`);
      }

      currentNames[level] = name;
      for (let j = level + 1; j < currentNames.length; j++) currentNames[j] = null;

      rows.push({
        l0: level === 0 ? name : null,
        l1: level === 1 ? name : null,
        l2: level === 2 ? name : null,
        l3: level === 3 ? name : null,
        description,
      });
    }

    return rows;
  }

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as RawCell[];
    if (!row || row.length === 0) continue;

    const l0 = colIndexes.l0 >= 0 ? cellText(row[colIndexes.l0]) : null;
    const l1 = colIndexes.l1 >= 0 ? cellText(row[colIndexes.l1]) : null;
    const l2 = colIndexes.l2 >= 0 ? cellText(row[colIndexes.l2]) : null;
    const l3 = colIndexes.l3 >= 0 ? cellText(row[colIndexes.l3]) : null;
    const description = colIndexes.desc >= 0 ? cellText(row[colIndexes.desc]) : null;

    // Skip completely empty rows
    if (!l0 && !l1 && !l2 && !l3) continue;

    rows.push({ l0, l1, l2, l3, description });
  }

  return rows;
}
