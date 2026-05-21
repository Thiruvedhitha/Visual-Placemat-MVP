import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

/**
 * POST /api/catalogs/restore
 *
 * Restores a specific visual_maps version:
 * 1. Fetches the snapshot from visual_maps.layout_data
 * 2. Deletes current capabilities for the catalog
 * 3. Re-inserts capabilities from the snapshot (level-by-level for parent_id resolution)
 * 4. Updates node_styles on capability_catalogs
 * 5. Sets the target version as active, deactivates all others
 *
 * Returns { capabilities, nodeStyles, catalogId, versionNumber }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { catalogId, versionId } = body;

    if (!catalogId || !versionId) {
      return NextResponse.json(
        { error: "Missing catalogId or versionId" },
        { status: 400 }
      );
    }

    // Fetch the target visual_maps row
    const { data: mapRow, error: mapError } = await supabaseAdmin
      .from("visual_maps")
      .select("id, version_number, layout_data")
      .eq("id", versionId)
      .eq("catalog_id", catalogId)
      .single();

    if (mapError || !mapRow) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const layoutData = mapRow.layout_data as {
      capabilities: Array<{
        id: string;
        parent_id: string | null;
        name: string;
        level: number;
        description: string | null;
        note: string | null;
        sort_order: number;
        source: string;
      }>;
      nodeStyles?: Record<string, unknown>;
    };

    if (!layoutData?.capabilities || !Array.isArray(layoutData.capabilities)) {
      return NextResponse.json(
        { error: "Snapshot has no capabilities data" },
        { status: 422 }
      );
    }

    const snapshotCaps = layoutData.capabilities;
    const snapshotStyles = layoutData.nodeStyles ?? {};

    // Delete current capabilities for this catalog
    const { error: delError } = await supabaseAdmin
      .from("capabilities")
      .delete()
      .eq("catalog_id", catalogId);

    if (delError) {
      throw new Error("Failed to clear capabilities: " + delError.message);
    }

    // Re-insert capabilities level-by-level; remap snapshot IDs → new DB UUIDs
    const oldToNew = new Map<string, string>();

    for (const level of [0, 1, 2, 3]) {
      const levelCaps = snapshotCaps.filter((c) => c.level === level);
      if (levelCaps.length === 0) continue;

      const insertData = levelCaps.map((c) => ({
        catalog_id: catalogId,
        parent_id: c.parent_id ? (oldToNew.get(c.parent_id) ?? null) : null,
        level,
        name: c.name,
        description: c.description,
        note: c.note || null,
        sort_order: c.sort_order,
        source: c.source || "xlsx_import",
      }));

      const { data: inserted, error: insError } = await supabaseAdmin
        .from("capabilities")
        .insert(insertData)
        .select("id");

      if (insError) {
        throw new Error(`Failed to restore L${level} capabilities: ${insError.message}`);
      }

      if (inserted) {
        inserted.forEach((row, i) => {
          oldToNew.set(levelCaps[i].id, row.id);
        });
      }
    }

    // Remap snapshot nodeStyles to new IDs
    const remappedStyles: Record<string, unknown> = {};
    for (const [oldId, style] of Object.entries(snapshotStyles)) {
      const newId = oldToNew.get(oldId) ?? oldId;
      remappedStyles[newId] = style;
    }

    // Update node_styles on the catalog
    const { error: styleError } = await supabaseAdmin
      .from("capability_catalogs")
      .update({ node_styles: remappedStyles })
      .eq("id", catalogId);

    if (styleError) {
      console.error("Failed to update node_styles on restore:", styleError.message);
    }

    // Activate this version, deactivate all others
    await supabaseAdmin
      .from("visual_maps")
      .update({ is_active: false })
      .eq("catalog_id", catalogId);

    await supabaseAdmin
      .from("visual_maps")
      .update({ is_active: true })
      .eq("id", versionId);

    // Build the restored capabilities array with new DB IDs for the client
    const restoredCapabilities = snapshotCaps.map((c) => ({
      id: oldToNew.get(c.id) ?? c.id,
      parent_id: c.parent_id ? (oldToNew.get(c.parent_id) ?? null) : null,
      catalog_id: catalogId,
      name: c.name,
      level: c.level,
      description: c.description,
      note: c.note || null,
      sort_order: c.sort_order,
      source: c.source || "xlsx_import",
    }));

    return NextResponse.json({
      success: true,
      catalogId,
      versionId,
      versionNumber: mapRow.version_number,
      capabilities: restoredCapabilities,
      nodeStyles: remappedStyles,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Restore error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
