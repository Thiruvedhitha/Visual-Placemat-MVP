import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getUserClientRole } from "@/lib/db/clients";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

interface RouteParams {
  params: { clientId: string };
}

/**
 * POST /api/clients/[clientId]/catalogs
 * Instantiate a template (or create blank) catalog inside a client folder.
 * Body: { templateId?: string, name: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const role = await getUserClientRole(clientId, user.id);
  if (!role || role === "viewer") {
    return NextResponse.json({ error: "Editor or Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { templateId, name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Catalog name is required" }, { status: 400 });
    }

    const db = getSupabaseAdmin();

    // Create the new catalog inside this client folder
    const { data: catalog, error: catError } = await db
      .from("capability_catalogs")
      .insert({
        name: name.trim(),
        client_id: clientId,
        user_id: user.id,
        status: "active",
      })
      .select("id")
      .single();

    if (catError || !catalog) {
      throw new Error("Failed to create catalog: " + catError?.message);
    }

    // If a templateId is provided, copy its capabilities into the new catalog
    if (templateId) {
      const { data: templateCaps, error: tplError } = await db
        .from("capabilities")
        .select("parent_id, level, name, description, note, sort_order, source")
        .eq("catalog_id", templateId)
        .order("level", { ascending: true })
        .order("sort_order", { ascending: true });

      if (tplError) throw new Error("Failed to read template: " + tplError.message);

      if (templateCaps && templateCaps.length > 0) {
        // Insert level by level to resolve parent_id references
        // First, get original IDs for parent mapping
        const { data: templateCapsWithIds } = await db
          .from("capabilities")
          .select("id, parent_id, level, name, description, note, sort_order, source")
          .eq("catalog_id", templateId)
          .order("level", { ascending: true })
          .order("sort_order", { ascending: true });

        const oldToNew = new Map<string, string>();

        for (const level of [0, 1, 2, 3]) {
          const levelCaps = (templateCapsWithIds ?? []).filter((c) => c.level === level);
          if (levelCaps.length === 0) continue;

          const insertData = levelCaps.map((c) => ({
            catalog_id: catalog.id,
            parent_id: c.parent_id ? (oldToNew.get(c.parent_id) ?? null) : null,
            level: c.level,
            name: c.name,
            description: c.description,
            note: c.note || null,
            sort_order: c.sort_order,
            source: "template",
          }));

          const { data: inserted, error: insError } = await db
            .from("capabilities")
            .insert(insertData)
            .select("id");

          if (insError) throw new Error(`Failed to copy L${level}: ${insError.message}`);

          if (inserted) {
            inserted.forEach((row, i) => {
              oldToNew.set(levelCaps[i].id, row.id);
            });
          }
        }
      }
    }

    return NextResponse.json({ catalogId: catalog.id, name: name.trim() }, { status: 201 });
  } catch (err) {
    console.error("POST /api/clients/[clientId]/catalogs error:", err);
    return NextResponse.json({ error: "Failed to instantiate catalog" }, { status: 500 });
  }
}

/**
 * PATCH /api/clients/[clientId]/catalogs
 * Move an existing catalog into this client folder.
 * Body: { catalogId: string }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const role = await getUserClientRole(clientId, user.id);
  if (!role || role === "viewer") {
    return NextResponse.json({ error: "Editor or Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { catalogId } = body;

    if (!catalogId) {
      return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { error } = await db
      .from("capability_catalogs")
      .update({ client_id: clientId, updated_at: new Date().toISOString() })
      .eq("id", catalogId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/clients/[clientId]/catalogs error:", err);
    return NextResponse.json({ error: "Failed to move catalog" }, { status: 500 });
  }
}
