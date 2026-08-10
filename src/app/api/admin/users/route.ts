import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { isPlatformAdmin, httpUnauthorized, httpForbidden } from "@/lib/auth/authorization";

/** GET /api/admin/users?q=search */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const db = getSupabaseAdmin();

  let query = db
    .from("user_profiles")
    .select("user_id, email, display_name, platform_role, created_at, last_seen_at")
    .order("email");

  if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);

  const { data: profiles, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles?.length) return NextResponse.json([]);

  const userIds = profiles.map((p) => p.user_id);
  const { data: memberships } = await db
    .from("client_members")
    .select("user_id, client_id, role")
    .in("user_id", userIds);

  const clientIds = [...new Set((memberships ?? []).map((m) => m.client_id))];
  const { data: clients } = clientIds.length > 0
    ? await db.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const membershipsByUser = new Map<string, { clientId: string; clientName: string; role: string }[]>();
  for (const m of memberships ?? []) {
    if (!membershipsByUser.has(m.user_id)) membershipsByUser.set(m.user_id, []);
    membershipsByUser.get(m.user_id)!.push({
      clientId:   m.client_id,
      clientName: clientMap.get(m.client_id) ?? m.client_id,
      role:       m.role,
    });
  }

  return NextResponse.json(
    profiles.map((p) => ({ ...p, memberships: membershipsByUser.get(p.user_id) ?? [] }))
  );
}

/** PATCH /api/admin/users — change platform_role */
export async function PATCH(request: NextRequest) {
  const actor = await getUser();
  if (!actor) return httpUnauthorized();
  if (!(await isPlatformAdmin(actor.id))) return httpForbidden();

  const { userId, platformRole } = await request.json();
  if (!userId || !["user", "admin"].includes(platformRole)) {
    return NextResponse.json({ error: "userId and platformRole (user|admin) required" }, { status: 400 });
  }
  if (userId === actor.id && platformRole !== "admin") {
    return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("user_profiles")
    .update({ platform_role: platformRole, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
