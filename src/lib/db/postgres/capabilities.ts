import { supabaseAdmin } from "./client";
import type { ParsedCapabilityRow } from "@/types/capability";

/**
 * Creates a new catalog and inserts all capabilities from parsed Excel rows.
 * Uses batch insert for speed.
 */
export async function insertCatalogFromRows(
  catalogName: string,
  rows: ParsedCapabilityRow[]
) {
  // 1. Create catalog
  const { data: catalog, error: catError } = await supabaseAdmin
    .from("capability_catalogs")
    .insert({ name: catalogName })
    .select("id")
    .single();

  if (catError || !catalog) throw new Error("Failed to create catalog: " + catError?.message);

  const catalogId = catalog.id;

  // 2. Build capability records with temporary IDs for parent tracking
  //    Since parent_id needs real UUIDs, we insert level-by-level.

  // Track current parent names at each level
  let currentL0Name: string | null = null;
  let currentL1Name: string | null = null;
  let currentL2Name: string | null = null;

  // Collect records by level
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

  // 3. Insert level by level so we can resolve parent IDs
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
    }));

    const { data, error } = await supabaseAdmin
      .from("capabilities")
      .insert(insertData)
      .select("id, name, level");

    if (error) throw new Error("Failed to insert L" + level + " capabilities: " + error.message);

    // Map inserted IDs back
    if (data) {
      for (let i = 0; i < data.length; i++) {
        nameToId.set(`${data[i].level}:${data[i].name}`, data[i].id);
      }
    }
  }

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
