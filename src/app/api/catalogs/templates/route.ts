import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

/**
 * GET /api/catalogs/templates
 *
 * Returns all built-in system templates (capability_catalogs where client_name = '__builtin__').
 * Each entry includes the catalog metadata + its full capabilities array.
 *
 * POST /api/catalogs/templates
 * Body: { catalogId: string }
 * Promotes an existing catalog to a built-in template by setting client_name = '__builtin__'.
 */

export async function GET() {
  try {
    // Fetch all built-in catalogs
    const { data: catalogs, error: catError } = await supabaseAdmin
      .from("capability_catalogs")
      .select("id, name, industry, created_at, node_styles")
      .eq("client_name", "__builtin__")
      .order("created_at", { ascending: true });

    if (catError) {
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }

    if (!catalogs || catalogs.length === 0) {
      return NextResponse.json({ templates: [] });
    }

    // Fetch capabilities for all built-in catalogs in one query
    const catalogIds = catalogs.map((c) => c.id);
    const { data: capabilities, error: capError } = await supabaseAdmin
      .from("capabilities")
      .select("id, catalog_id, parent_id, level, name, description, note, sort_order, source")
      .in("catalog_id", catalogIds)
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true });

    if (capError) {
      return NextResponse.json({ error: capError.message }, { status: 500 });
    }

    // Group capabilities by catalog_id
    const capsByCatalog = new Map<string, typeof capabilities>();
    for (const cap of capabilities ?? []) {
      if (!capsByCatalog.has(cap.catalog_id)) capsByCatalog.set(cap.catalog_id, []);
      capsByCatalog.get(cap.catalog_id)!.push(cap);
    }

    const templates = catalogs.map((catalog) => ({
      id: catalog.id,
      name: catalog.name,
      category: catalog.industry ?? "Other",
      nodeStyles: catalog.node_styles ?? {},
      nodeCount: (capsByCatalog.get(catalog.id) ?? []).length,
      capabilities: capsByCatalog.get(catalog.id) ?? [],
    }));

    return NextResponse.json({ templates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { catalogId } = body;

    if (!catalogId) {
      return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("capability_catalogs")
      .update({ client_name: "__builtin__" })
      .eq("id", catalogId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Catalog ${catalogId} promoted to built-in template.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
