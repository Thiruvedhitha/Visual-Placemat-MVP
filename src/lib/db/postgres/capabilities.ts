import { supabaseAdmin } from "./client";
import type { ParsedCapabilityRow } from "@/types/capability";

/**
 * Content-based dedup: finds an existing catalog with identical capability data.
 * Compares row count + L0 capability names against all existing catalogs.
 */
export async function findDuplicateCatalog(rows: ParsedCapabilityRow[]): Promise<string | null> {
  const parsedCount = rows.length;
  const parsedL0s = rows
    .filter((r) => r.l0)
    .map((r) => r.l0!.trim())
    .sort()
    .join("|");

  // 1. Get all catalogs with their capability counts
  const { data: catalogs } = await supabaseAdmin
    .from("capability_catalogs")
    .select("id")
    .eq("status", "active");

  if (!catalogs || catalogs.length === 0) return null;

  // 2. For each catalog, check capability count
  for (const cat of catalogs) {
    const { count } = await supabaseAdmin
      .from("capabilities")
      .select("id", { count: "exact", head: true })
      .eq("catalog_id", cat.id);

    if (count !== parsedCount) continue;

    // 3. Count matches — compare L0 names
    const { data: l0Caps } = await supabaseAdmin
      .from("capabilities")
      .select("name")
      .eq("catalog_id", cat.id)
      .eq("level", 0)
      .order("name", { ascending: true });

    const existingL0s = (l0Caps || []).map((c) => c.name.trim()).join("|");
    if (existingL0s === parsedL0s) return cat.id;
  }

  return null;
}

/**
 * Creates a new catalog record and returns its ID.
 * This is a single fast INSERT — used to get the catalogId quickly.
 */
export async function createCatalog(
  catalogName: string,
  opts?: { industry?: string; clientName?: string; userId?: string }
): Promise<string> {
  const { data: catalog, error } = await supabaseAdmin
    .from("capability_catalogs")
    .insert({
      name: catalogName,
      industry: opts?.industry || null,
      client_name: opts?.clientName || null,
      user_id: opts?.userId || null,
    })
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
  // Build flat records with full-path keys to handle duplicate names at the same level
  let currentL0Name: string | null = null;
  let currentL1Name: string | null = null;
  let currentL2Name: string | null = null;

  type CapRecord = { name: string; description: string | null; level: number; parentKey: string | null; selfKey: string; sort_order: number };
  const records: CapRecord[] = [];
  let sortOrder = 0;

  for (const row of rows) {
    if (row.l0) {
      currentL0Name = row.l0;
      currentL1Name = null;
      currentL2Name = null;
      records.push({ name: row.l0, description: row.description, level: 0, parentKey: null, selfKey: `0:${row.l0}`, sort_order: sortOrder++ });
    }
    if (row.l1) {
      currentL1Name = row.l1;
      currentL2Name = null;
      const parentKey = `0:${currentL0Name}`;
      const selfKey = `1:${currentL0Name}/${row.l1}`;
      records.push({ name: row.l1, description: row.description, level: 1, parentKey, selfKey, sort_order: sortOrder++ });
    }
    if (row.l2) {
      currentL2Name = row.l2;
      const parentKey = `1:${currentL0Name}/${currentL1Name}`;
      const selfKey = `2:${currentL0Name}/${currentL1Name}/${row.l2}`;
      records.push({ name: row.l2, description: row.description, level: 2, parentKey, selfKey, sort_order: sortOrder++ });
    }
    if (row.l3) {
      const parentKey = `2:${currentL0Name}/${currentL1Name}/${currentL2Name}`;
      const selfKey = `3:${currentL0Name}/${currentL1Name}/${currentL2Name}/${row.l3}`;
      records.push({ name: row.l3, description: row.description, level: 3, parentKey, selfKey, sort_order: sortOrder++ });
    }
  }

  // Insert level by level so parent_id is resolved from already-inserted rows
  const pathToId = new Map<string, string>(); // full path key → uuid

  for (const level of [0, 1, 2, 3]) {
    const levelRecords = records.filter((r) => r.level === level);
    if (levelRecords.length === 0) continue;

    const insertData = levelRecords.map((r) => ({
      catalog_id: catalogId,
      parent_id: r.parentKey ? (pathToId.get(r.parentKey) || null) : null,
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
      data.forEach((row, i) => pathToId.set(levelRecords[i].selfKey, row.id));
    }
  }
}

/**
 * Legacy wrapper — creates catalog + inserts capabilities in one call.
 */
export async function insertCatalogFromRows(
  catalogName: string,
  rows: ParsedCapabilityRow[],
  opts?: { industry?: string; clientName?: string; userId?: string }
) {
  const catalogId = await createCatalog(catalogName, opts);
  await insertCapabilitiesForCatalog(catalogId, rows);
  return catalogId;
}

/** Fetch all capabilities for a catalog, ordered by sort_order (excludes soft-deleted) */
export async function getCatalogCapabilities(catalogId: string) {
  const { data, error } = await supabaseAdmin
    .from("capabilities")
    .select("*")
    .eq("catalog_id", catalogId)
    .neq("is_deleted", true)
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
