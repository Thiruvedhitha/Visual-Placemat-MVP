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

/**
 * Identify L-level column headers from the parsed headers.
 * Returns sorted array of header names matching L0, L1, L2, L3.
 */
function findLCols(headers: string[]): string[] {
  return headers.filter((h) => /^l\d+/i.test(h.trim().replace(/\s.*/, "")));
}

/**
 * Find the description column header (if any).
 */
function findDescCol(headers: string[]): string | null {
  return headers.find((h) => /desc/i.test(h)) ?? null;
}

export function convertRowsToCapabilities(
  headers: string[],
  rows: RawRow[],
  catalogId: string | null
): Capability[] {
  const lCols = findLCols(headers);
  const descCol = findDescCol(headers);

  if (lCols.length === 0) return [];

  // Track current parent at each level
  const currentNames: (string | null)[] = new Array(4).fill(null);
  const pathToId = new Map<string, string>();

  const capabilities: Capability[] = [];
  let sortOrder = 0;
  const now = new Date().toISOString();

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
