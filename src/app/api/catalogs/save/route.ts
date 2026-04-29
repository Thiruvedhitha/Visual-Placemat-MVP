import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

/**
 * POST /api/catalogs/save
 *
 * Bulk-saves a catalog from Zustand state to Supabase.
 * Handles both first-time save (catalogId=null) and updates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { catalogId, catalogName, capabilities } = body;

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
          sort_order: number;
          source: string;
        }) => ({
          catalog_id: finalCatalogId,
          parent_id: c.parent_id ? (tempToReal.get(c.parent_id) ?? null) : null,
          level,
          name: c.name,
          description: c.description,
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

    return NextResponse.json({
      success: true,
      catalogId: finalCatalogId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
