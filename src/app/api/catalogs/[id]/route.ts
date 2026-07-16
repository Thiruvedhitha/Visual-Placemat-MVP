import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";
import { getUser } from "@/lib/auth/getUser";
import { getUserClientRole } from "@/lib/db/clients";

/**
 * GET /api/catalogs/[id]
 *
 * Loads a catalog and its capabilities by catalog ID.
 * Returns userRole ("admin" | "editor" | "viewer" | null) for the current user
 * so the client can enforce read-only mode for viewers.
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

    // Fetch catalog metadata (include client_id for role lookup)
    const { data: catalog, error: catError } = await supabaseAdmin
      .from("capability_catalogs")
      .select("id, name, industry, created_at, node_styles, client_id")
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

    // Resolve the current user's role for the catalog's client
    let userRole: "admin" | "editor" | "viewer" | null = null;
    try {
      const user = await getUser();
      if (user && catalog.client_id) {
        userRole = await getUserClientRole(catalog.client_id, user.id);
      }
    } catch {
      // Non-fatal: fall back to null (viewer behaviour)
    }

    // Strip client_id from the public response
    const { client_id: _clientId, ...catalogPublic } = catalog;

    return NextResponse.json({
      catalog: catalogPublic,
      capabilities: capabilities || [],
      userRole,
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
