import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { isPlatformAdmin, httpUnauthorized, httpForbidden } from "@/lib/auth/authorization";

/** GET /api/admin/audit?limit=50&offset=0&userId=xxx&clientId=xxx&catalogId=xxx */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { searchParams } = new URL(request.url);
  const limit     = Math.min(parseInt(searchParams.get("limit")  ?? "50"), 200);
  const offset    = parseInt(searchParams.get("offset") ?? "0");
  const actorId   = searchParams.get("userId")    ?? null;
  const clientId  = searchParams.get("clientId")  ?? null;
  const catalogId = searchParams.get("catalogId") ?? null;

  const db = getSupabaseAdmin();
  let query = db
    .from("access_audit_log")
    .select("id, actor_id, action, target_user_id, client_id, catalog_id, previous_value, new_value, reason, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorId)   query = query.eq("actor_id",   actorId);
  if (clientId)  query = query.eq("client_id",  clientId);
  if (catalogId) query = query.eq("catalog_id", catalogId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich actor emails
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))];
  const { data: profiles } = actorIds.length > 0
    ? await db.from("user_profiles").select("user_id, email").in("user_id", actorIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.email]));

  return NextResponse.json(
    (data ?? []).map((row) => ({ ...row, actorEmail: profileMap.get(row.actor_id) ?? row.actor_id }))
  );
}
