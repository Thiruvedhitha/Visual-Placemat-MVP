import type { Capability } from "@/types/capability";

/**
 * Converts flat parsed rows (from XLSX preview) into a Capability[] tree
 * with temporary client-side UUIDs and resolved parent_id references.
 *
 * Mirrors the server-side insertCapabilitiesForCatalog logic but runs
 * entirely in the browser — no DB calls.
 */

let counter = 0;
function tempId(): string {
  return `tmp_${Date.now()}_${++counter}`;
}

interface RawRow {
  [key: string]: string;
}

function parseLevel(value: string | undefined): 0 | 1 | 2 | 3 | null {
  const text = (value ?? "").trim().toUpperCase();
  const match = text.match(/^L?([0-3])$/) ?? text.match(/^LEVEL\s*([0-3])$/);
  return match ? (Number(match[1]) as 0 | 1 | 2 | 3) : null;
}

/**
 * Identify L-level column headers from the parsed headers.
 * Returns sorted array of header names matching L0, L1, L2, L3.
 */
function findLCols(headers: string[]): string[] {
  return headers.filter((h) => /^l\d+/i.test(h.trim().replace(/\s.*/, "")));
}

function findLevelCol(headers: string[]): string | null {
  return headers.find((h) => /^level$/i.test(h.trim())) ?? null;
}

function findNameCol(headers: string[], reserved: Set<string>): string | null {
  const preferred = [/^capability\s*name$/i, /^process\s*name$/i, /^capability$/i, /^name$/i, /^title$/i];
  for (const pattern of preferred) {
    const match = headers.find((h) => !reserved.has(h) && pattern.test(h.trim()));
    if (match) return match;
  }
  return headers.find((h) => !reserved.has(h) && !/^(serial\s*no\.?|process\s*no\.?)$/i.test(h.trim())) ?? null;
}

/**
 * Find the description column header (if any).
 */
function findDescCol(headers: string[]): string | null {
  return headers.find((h) => /desc|definition/i.test(h)) ?? null;
}

export function convertRowsToCapabilities(
  headers: string[],
  rows: RawRow[],
  catalogId: string | null
): Capability[] {
  const lCols = findLCols(headers);
  const descCol = findDescCol(headers);
  const levelCol = findLevelCol(headers);

  if (lCols.length === 0 && !levelCol) return [];

  // Track current parent at each level
  const currentNames: (string | null)[] = new Array(4).fill(null);
  const pathToId = new Map<string, string>();

  const capabilities: Capability[] = [];
  let sortOrder = 0;
  const now = new Date().toISOString();

  if (lCols.length === 0 && levelCol) {
    const reserved = new Set([levelCol, ...(descCol ? [descCol] : [])]);
    const nameCol = findNameCol(headers, reserved);
    if (!nameCol) return [];

    for (const [rowIndex, row] of rows.entries()) {
      const lvl = parseLevel(row[levelCol]);
      const value = (row[nameCol] ?? "").trim();
      if (lvl === null && !value) continue;
      if (lvl === null) throw new Error(`Invalid level in row ${rowIndex + 2}. Expected L0, L1, L2, or L3.`);
      if (!value) throw new Error(`Missing capability name in row ${rowIndex + 2}.`);
      if (lvl > 0 && !currentNames[lvl - 1]) {
        throw new Error(`Missing parent before row ${rowIndex + 2}. L${lvl} rows must appear after their L${lvl - 1} parent.`);
      }

      currentNames[lvl] = value;
      for (let j = lvl + 1; j < 4; j++) currentNames[j] = null;

      const pathParts = currentNames.slice(0, lvl + 1).filter(Boolean);
      const selfKey = `${lvl}:${pathParts.join("/")}`;

      if (pathToId.has(selfKey)) continue;

      let parentId: string | null = null;
      if (lvl > 0) {
        const parentParts = currentNames.slice(0, lvl).filter(Boolean);
        const parentKey = `${lvl - 1}:${parentParts.join("/")}`;
        parentId = pathToId.get(parentKey) ?? null;
      }

      const id = tempId();
      pathToId.set(selfKey, id);

      capabilities.push({
        id,
        catalog_id: catalogId ?? "unsaved",
        parent_id: parentId,
        level: lvl,
        name: value,
        description: descCol ? (row[descCol] ?? "").trim() || null : null,
        note: null,
        sort_order: sortOrder++,
        source: "xlsx_import",
        is_deleted: false,
        created_at: now,
        updated_at: now,
      });
    }

    return capabilities;
  }

  for (const row of rows) {
    // For each row, process each L-column that has a non-empty value
    for (let lvl = 0; lvl < lCols.length; lvl++) {
      const colName = lCols[lvl];
      const value = (row[colName] ?? "").trim();
      if (!value) continue;

      // Update tracking: set this level's name, clear deeper levels
      currentNames[lvl] = value;
      for (let j = lvl + 1; j < 4; j++) currentNames[j] = null;

      // Build full ancestor path key (matches server-side logic)
      const pathParts = currentNames.slice(0, lvl + 1).filter(Boolean);
      const selfKey = `${lvl}:${pathParts.join("/")}`;

      // Already added this exact capability? Skip (dedup within same upload)
      if (pathToId.has(selfKey)) continue;

      // Resolve parent
      let parentId: string | null = null;
      if (lvl > 0) {
        const parentParts = currentNames.slice(0, lvl).filter(Boolean);
        const parentKey = `${lvl - 1}:${parentParts.join("/")}`;
        parentId = pathToId.get(parentKey) ?? null;
      }

      const id = tempId();
      pathToId.set(selfKey, id);

      // Description: only attach to the deepest level in this row
      const isDeepest = lCols.slice(lvl + 1).every(
        (c) => !(row[c] ?? "").trim()
      );
      const description = isDeepest && descCol ? (row[descCol] ?? "").trim() || null : null;

      capabilities.push({
        id,
        catalog_id: catalogId ?? "unsaved",
        parent_id: parentId,
        level: lvl as 0 | 1 | 2 | 3,
        name: value,
        description,
        note: null,
        sort_order: sortOrder++,
        source: "xlsx_import",
        is_deleted: false,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return capabilities;
}
