import { supabaseAdmin } from "./client";
import type { ParsedCapabilityRow } from "@/types/capability";

/**
 * Checks if a catalog with the same name already exists.
 * Returns the existing catalog ID, or null if none found.
 */
export async function checkExistingCatalog(catalogName: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("capability_catalogs")
    .select("id")
    .eq("name", catalogName)
    .limit(1)
    .single();

  return data?.id ?? null;
}

/**
 * Creates a new catalog record and returns its ID.
 * This is a single fast INSERT — used to get the catalogId quickly.
 */
export async function createCatalog(catalogName: string, industry?: string): Promise<string> {
  const { data: catalog, error } = await supabaseAdmin
    .from("capability_catalogs")
    .insert({ name: catalogName, industry: industry || null })
    .select("id")
    .single();

  if (error || !catalog) throw new Error("Failed to create catalog: " + error?.message);
  return catalog.id;
}

/**
 * Inserts all capabilities for an existing catalog.
 * Inserts level-by-level (L0→L3) so parent_id can be resolved from previous levels.
 */
export async function insertCapabilitiesForCatalog(
  catalogId: string,
  rows: ParsedCapabilityRow[]
) {
  // Build flat records
  let currentL0Name: string | null = null;
  let currentL1Name: string | null = null;
  let currentL2Name: string | null = null;

  type CapRecord = { name: string; description: string | null; level: number; parentKey: string | null; sort_order: number };
  const records: CapRecord[] = [];
  let sortOrder = 0;

  for (const row of rows) {
    if (row.l0) {
      currentL0Name = row.l0;
      currentL1Name = null;
      currentL2Name = null;
      records.push({ name: row.l0, description: row.description, level: 0, parentKey: null, sort_order: sortOrder++ });
    }
    if (row.l1) {
      currentL1Name = row.l1;
      currentL2Name = null;
      records.push({ name: row.l1, description: row.description, level: 1, parentKey: `0:${currentL0Name}`, sort_order: sortOrder++ });
    }
    if (row.l2) {
      currentL2Name = row.l2;
      records.push({ name: row.l2, description: row.description, level: 2, parentKey: `1:${currentL1Name}`, sort_order: sortOrder++ });
    }
    if (row.l3) {
      records.push({ name: row.l3, description: row.description, level: 3, parentKey: `2:${currentL2Name}`, sort_order: sortOrder++ });
    }
  }

  // Insert level by level so parent_id is resolved from already-inserted rows
  const nameToId = new Map<string, string>(); // "level:name" → uuid

  for (const level of [0, 1, 2, 3]) {
    const levelRecords = records.filter((r) => r.level === level);
    if (levelRecords.length === 0) continue;

    const insertData = levelRecords.map((r) => ({
      catalog_id: catalogId,
      parent_id: r.parentKey ? (nameToId.get(r.parentKey) || null) : null,
      level: r.level,
      name: r.name,
      description: r.description,
      sort_order: r.sort_order,
      source: "xlsx_import",
    }));

    const { data, error } = await supabaseAdmin
      .from("capabilities")
      .insert(insertData)
      .select("id, name, level");

    if (error) throw new Error("Failed to insert L" + level + " capabilities: " + error.message);

    if (data) {
      data.forEach((row) => nameToId.set(`${row.level}:${row.name}`, row.id));
    }
  }
}

/**
 * Legacy wrapper — creates catalog + inserts capabilities in one call.
 */
export async function insertCatalogFromRows(
  catalogName: string,
  rows: ParsedCapabilityRow[],
  industry?: string
) {
  const catalogId = await createCatalog(catalogName, industry);
  await insertCapabilitiesForCatalog(catalogId, rows);
  return catalogId;
}

/** Fetch all capabilities for a catalog, ordered by sort_order */
export async function getCatalogCapabilities(catalogId: string) {
  const { data, error } = await supabaseAdmin
    .from("capabilities")
    .select("*")
    .eq("catalog_id", catalogId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error("Failed to fetch capabilities: " + error.message);
  return data;
}

/** Fetch all catalogs */
export async function getCatalogs() {
  const { data, error } = await supabaseAdmin
    .from("capability_catalogs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to fetch catalogs: " + error.message);
  return data;
}
