import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { isPlatformAdmin, httpUnauthorized, httpForbidden } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/auth/audit";

/** GET /api/admin/diagrams?status=active|archived&q=search */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const q      = searchParams.get("q")      || "";

  const db = getSupabaseAdmin();
  let query = db
    .from("capability_catalogs")
    .select("id, name, status, client_id, user_id, updated_at, archived_at, archive_reason, industry")
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (q) query = query.ilike("name", `%${q}%`);
  const { data: catalogs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!catalogs?.length) return NextResponse.json([]);

  const clientIds = [...new Set(catalogs.filter((c) => c.client_id).map((c) => c.client_id as string))];
  const ownerIds  = [...new Set(catalogs.filter((c) => c.user_id).map((c) => c.user_id as string))];

  const [clientsRes, profilesRes] = await Promise.all([
    clientIds.length > 0 ? db.from("clients").select("id, name").in("id", clientIds) : { data: [] },
    ownerIds.length  > 0 ? db.from("user_profiles").select("user_id, email").in("user_id", ownerIds) : { data: [] },
  ]);

  const clientMap  = new Map((clientsRes.data  ?? []).map((c) => [c.id,       c.name]));
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id,  p.email]));

  return NextResponse.json(
    catalogs.map((c) => ({
      ...c,
      clientName: c.client_id ? (clientMap.get(c.client_id)  ?? c.client_id)  : null,
      ownerEmail: c.user_id   ? (profileMap.get(c.user_id)   ?? c.user_id)    : null,
    }))
  );
}

/** POST /api/admin/diagrams — bulk archive or restore */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { action, catalogIds, reason } = await request.json();
  if (!["archive", "restore"].includes(action) || !Array.isArray(catalogIds) || catalogIds.length === 0) {
    return NextResponse.json({ error: "action (archive|restore) and catalogIds[] required" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const isArchive = action === "archive";
  const { error } = await db
    .from("capability_catalogs")
    .update({
      status:         isArchive ? "archived" : "active",
      archived_at:    isArchive ? new Date().toISOString() : null,
      archived_by:    isArchive ? user.id : null,
      archive_reason: isArchive ? (reason ?? null) : null,
    })
    .in("id", catalogIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const catalogId of catalogIds) {
    await logAudit({ actorId: user.id, action: `admin.catalog.${action}`, catalogId, reason });
  }
  return NextResponse.json({ ok: true, count: catalogIds.length });
}
