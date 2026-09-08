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
      .select("id, name, industry, created_at, node_styles, chat_history, client_id")
      .eq("id", catalogId)
      .single();

    if (catError || !catalog) {
      return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    }

    // Fetch capabilities
    const { data: capabilities, error: capError } = await supabaseAdmin
      .from("capabilities")
      .select("id, parent_id, level, name, description, note, sort_order, source, fill_category_id, border_category_id, text_category_id")
      .eq("catalog_id", catalogId)
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true });

    if (capError) {
      throw new Error("Failed to load capabilities: " + capError.message);
    }

    const { data: styleCategories, error: categoryError } = await supabaseAdmin
      .from("capability_style_categories")
      .select("id, catalog_id, slot, entry_key, label, color, source, source_id, created_by, created_at, updated_at")
      .eq("catalog_id", catalogId)
      .order("created_at", { ascending: true });

    if (categoryError) {
      throw new Error("Failed to load style categories: " + categoryError.message);
    }

    // Resolve the current user's role for the catalog's client
    let userRole: "admin" | "editor" | "viewer" | null = null;
    try {
      const user = await getUser();
      if (user && catalog.client_id) {
        userRole = await getUserClientRole(catalog.client_id, user.id);
      } else if (user && !catalog.client_id) {
        // Personal diagram (no client): authenticated user gets full edit access
        userRole = "admin";
      }
    } catch {
      // Non-fatal: fall back to null (viewer behaviour)
    }

    // Strip client_id from the public response
    const { client_id: _clientId, ...catalogPublic } = catalog;

    return NextResponse.json({
      catalog: catalogPublic,
      capabilities: capabilities || [],
      styleCategories: styleCategories || [],
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
 * Body: { isBuiltin: boolean } or { name?: string, description?: string, industry?: string, clientId?: string | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    if (typeof body.isBuiltin === "boolean") {
      const clientName = body.isBuiltin === true ? "__builtin__" : null;

      const { error } = await supabaseAdmin
        .from("capability_catalogs")
        .update({ client_name: clientName })
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ ok: true });
    }

    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: catalog } = await supabaseAdmin
      .from("capability_catalogs")
      .select("id, user_id, client_id")
      .eq("id", id)
      .single();

    if (!catalog) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });

    const isOwner = catalog.user_id === user.id;
    const sourceRole = catalog.client_id ? await getUserClientRole(catalog.client_id, user.id) : null;
    const canEditCurrent = isOwner || sourceRole === "admin" || sourceRole === "editor";

    if (!canEditCurrent) {
      return NextResponse.json({ error: "Editor or Admin access required" }, { status: 403 });
    }

    const updates: Record<string, string | null> = {};
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Diagram name is required" }, { status: 400 });
      updates.name = name;
    }
    if (typeof body.description === "string") updates.description = body.description.trim() || null;
    if (typeof body.industry === "string") updates.industry = body.industry.trim() || null;

    if (Object.prototype.hasOwnProperty.call(body, "clientId")) {
      const targetClientId = typeof body.clientId === "string" && body.clientId.trim() ? body.clientId.trim() : null;

      if (targetClientId) {
        const targetRole = await getUserClientRole(targetClientId, user.id);
        if (!targetRole || targetRole === "viewer") {
          return NextResponse.json({ error: "Editor or Admin access required for target folder" }, { status: 403 });
        }
      } else if (!isOwner && sourceRole !== "admin") {
        return NextResponse.json({ error: "Only the diagram owner or folder admin can remove it from a folder" }, { status: 403 });
      }

      updates.client_id = targetClientId;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("capability_catalogs")
      .update(updates)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
