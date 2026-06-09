import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

/**
 * GET /api/catalogs/[id]
 *
 * Loads a catalog and its capabilities by catalog ID.
 * Used for the read-only shareable view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const catalogId = params.id;

    if (!catalogId) {
      return NextResponse.json({ error: "Missing catalog ID" }, { status: 400 });
    }

    // Fetch catalog metadata
    const { data: catalog, error: catError } = await supabaseAdmin
      .from("capability_catalogs")
      .select("id, name, industry, created_at, node_styles")
      .eq("id", catalogId)
      .single();

    if (catError || !catalog) {
      return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    }

    // Fetch capabilities
    const { data: capabilities, error: capError } = await supabaseAdmin
      .from("capabilities")
      .select("id, parent_id, level, name, description, note, sort_order, source")
      .eq("catalog_id", catalogId)
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true });

    if (capError) {
      throw new Error("Failed to load capabilities: " + capError.message);
    }

    return NextResponse.json({
      catalog,
      capabilities: capabilities || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Load catalog error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/catalogs/[id]
 * Body: { isBuiltin: boolean }
 * Promotes or demotes a catalog as a built-in system template.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const clientName = body.isBuiltin === true ? "__builtin__" : null;

    const { error } = await supabaseAdmin
      .from("capability_catalogs")
      .update({ client_name: clientName })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
