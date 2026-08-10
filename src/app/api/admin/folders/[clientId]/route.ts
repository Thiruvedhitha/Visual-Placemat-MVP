import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { isPlatformAdmin, httpUnauthorized, httpForbidden } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/auth/audit";

type RouteParams = { params: { clientId: string } };

/** GET /api/admin/folders/[clientId] — folder detail with members and diagrams */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { clientId } = params;
  const db = getSupabaseAdmin();

  const [folderRes, membersRes, diagramsRes] = await Promise.all([
    db.from("clients").select("*").eq("id", clientId).single(),
    db.from("client_members").select("id, user_id, role, created_at").eq("client_id", clientId).order("created_at"),
    db.from("capability_catalogs").select("id, name, status, updated_at, archived_at").eq("client_id", clientId).order("updated_at", { ascending: false }),
  ]);

  if (!folderRes.data) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  const userIds = (membersRes.data ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length > 0
    ? await db.from("user_profiles").select("user_id, email, display_name").in("user_id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const members = (membersRes.data ?? []).map((m) => ({
    ...m,
    email:        profileMap.get(m.user_id)?.email        ?? m.user_id,
    display_name: profileMap.get(m.user_id)?.display_name ?? "",
  }));

  return NextResponse.json({ folder: folderRes.data, members, diagrams: diagramsRes.data ?? [] });
}

/** POST /api/admin/folders/[clientId] — add a member (admin action) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { clientId } = params;
  const body = await request.json();
  const { userId, role } = body;

  if (!userId || !["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "userId and valid role required" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("client_members")
    .upsert({ client_id: clientId, user_id: userId, role, invited_by: user.id }, { onConflict: "client_id,user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: "admin.member.granted", targetUserId: userId, clientId, newValue: { role } });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH /api/admin/folders/[clientId] — change member role or archive folder */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { clientId } = params;
  const body = await request.json();
  const db = getSupabaseAdmin();

  if ("userId" in body && "role" in body) {
    const { userId, role } = body;
    const { error } = await db.from("client_members").update({ role }).eq("client_id", clientId).eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({ actorId: user.id, action: "admin.member.role_changed", targetUserId: userId, clientId, newValue: { role } });
    return NextResponse.json({ ok: true });
  }

  if (body.status === "archived" || body.status === "active") {
    const isArchive = body.status === "archived";
    const { error } = await db.from("clients").update({
      status:      body.status,
      archived_at: isArchive ? new Date().toISOString() : null,
      archived_by: isArchive ? user.id : null,
    }).eq("id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({ actorId: user.id, action: `admin.folder.${body.status}`, clientId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No valid operation in body" }, { status: 400 });
}

/** DELETE /api/admin/folders/[clientId]?userId=xxx — remove member */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { clientId } = params;
  const targetUserId = new URL(request.url).searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { error } = await db.from("client_members").delete().eq("client_id", clientId).eq("user_id", targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: "admin.member.removed", targetUserId, clientId });
  return NextResponse.json({ ok: true });
}
