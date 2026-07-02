import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireServerEnv } from "@/lib/db/postgres/client";

/**
 * POST /api/catalogs/save
 *
 * Bulk-saves a catalog from Zustand state to Supabase.
 * Handles both first-time save (catalogId=null) and updates.
 */
export async function POST(request: NextRequest) {
  try {
    requireServerEnv();
    const body = await request.json();
    const { catalogId, catalogName, capabilities, nodeStyles } = body;

    if (!catalogName || !Array.isArray(capabilities) || capabilities.length === 0) {
      return NextResponse.json(
        { error: "Missing catalogName or capabilities" },
        { status: 400 }
      );
    }

    let finalCatalogId: string;

    if (catalogId) {
      // ── Update existing catalog ──
      finalCatalogId = catalogId;

      // Delete old capabilities
      const { error: delError } = await supabaseAdmin
        .from("capabilities")
        .delete()
        .eq("catalog_id", finalCatalogId);

      if (delError) throw new Error("Failed to clear old capabilities: " + delError.message);
    } else {
      // ── First-time save: create catalog record ──
      const { data: catalog, error: catError } = await supabaseAdmin
        .from("capability_catalogs")
        .insert({
          name: catalogName,
          industry: body.industry || null,
          client_name: body.clientName || null,
          user_id: null,
        })
        .select("id")
        .single();

      if (catError || !catalog) {
        throw new Error("Failed to create catalog: " + catError?.message);
      }
      finalCatalogId = catalog.id;
    }

    // ── Insert capabilities level-by-level for parent_id resolution ──
    // Map temp client IDs → real DB UUIDs
    const tempToReal = new Map<string, string>();

    for (const level of [0, 1, 2, 3]) {
      const levelCaps = capabilities.filter(
        (c: { level: number }) => c.level === level
      );
      if (levelCaps.length === 0) continue;

      const insertData = levelCaps.map(
        (c: {
          id: string;
          parent_id: string | null;
          name: string;
          description: string | null;
          note: string | null;
          sort_order: number;
          source: string;
        }) => ({
          catalog_id: finalCatalogId,
          parent_id: c.parent_id ? (tempToReal.get(c.parent_id) ?? null) : null,
          level,
          name: c.name,
          description: c.description,
          note: c.note || null,
          sort_order: c.sort_order,
          source: c.source || "xlsx_import",
        })
      );

      const { data, error } = await supabaseAdmin
        .from("capabilities")
        .insert(insertData)
        .select("id");

      if (error) {
        throw new Error(`Failed to insert L${level} capabilities: ${error.message}`);
      }

      if (data) {
        data.forEach((row, i) => {
          tempToReal.set(levelCaps[i].id, row.id);
        });
      }
    }

    // Remap nodeStyles keys from client IDs to real DB UUIDs
    let remappedStyles: Record<string, unknown> = {};
    if (nodeStyles && typeof nodeStyles === "object") {
      for (const [oldId, style] of Object.entries(nodeStyles)) {
        const realId = tempToReal.get(oldId) ?? oldId;
        remappedStyles[realId] = style;
      }
      const { error: styleError } = await supabaseAdmin
        .from("capability_catalogs")
        .update({ node_styles: remappedStyles })
        .eq("id", finalCatalogId);
      if (styleError) console.error("Failed to update node_styles:", styleError.message);
    }

    // ── Version history: insert a new visual_maps snapshot on every Apply ──
    // Build snapshot with real DB IDs (parent_id resolved)
    const capabilitySnapshot = capabilities.map(
      (c: {
        id: string;
        parent_id: string | null;
        name: string;
        description: string | null;
        note: string | null;
        level: number;
        sort_order: number;
        source: string;
      }) => ({
        id: tempToReal.get(c.id) ?? c.id,
        parent_id: c.parent_id ? (tempToReal.get(c.parent_id) ?? c.parent_id) : null,
        name: c.name,
        level: c.level,
        description: c.description,
        note: c.note || null,
        sort_order: c.sort_order,
        source: c.source || "xlsx_import",
      })
    );

    // Deactivate old versions
    await supabaseAdmin
      .from("visual_maps")
      .update({ is_active: false })
      .eq("catalog_id", finalCatalogId);

    // Determine next version number
    const { data: lastMap } = await supabaseAdmin
      .from("visual_maps")
      .select("version_number")
      .eq("catalog_id", finalCatalogId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (lastMap?.version_number ?? 0) + 1;

    // Insert new snapshot — version number increments on each Apply
    const { data: newMap, error: mapError } = await supabaseAdmin
      .from("visual_maps")
      .insert({
        catalog_id: finalCatalogId,
        name: catalogName,
        version_number: nextVersion,
        is_active: true,
        layout_data: {
          capabilities: capabilitySnapshot,
          nodeStyles: remappedStyles,
        },
      })
      .select("id, version_number")
      .single();

    if (mapError) {
      console.error("Failed to insert visual_maps snapshot:", mapError.message);
    }

    return NextResponse.json({
      success: true,
      catalogId: finalCatalogId,
      versionId: newMap?.id ?? null,
      versionNumber: newMap?.version_number ?? nextVersion,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
