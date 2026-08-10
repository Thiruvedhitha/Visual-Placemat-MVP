import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { isPlatformAdmin, httpUnauthorized, httpForbidden } from "@/lib/auth/authorization";

/** GET /api/admin/folders?status=active|archived&q=search */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const q      = searchParams.get("q")      || "";

  const db = getSupabaseAdmin();
  let query = db
    .from("clients")
    .select("id, name, industry, status, created_at, archived_at")
    .eq("status", status)
    .order("name");

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: folders, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch per-folder counts
  const folderIds = (folders ?? []).map((f) => f.id);
  if (folderIds.length === 0) return NextResponse.json([]);

  const [diagramsRes, membersRes] = await Promise.all([
    db.from("capability_catalogs").select("client_id").in("client_id", folderIds).eq("status", "active"),
    db.from("client_members").select("client_id, role").in("client_id", folderIds),
  ]);

  const diagramCount = new Map<string, number>();
  for (const row of diagramsRes.data ?? []) {
    diagramCount.set(row.client_id, (diagramCount.get(row.client_id) ?? 0) + 1);
  }
  const memberCount = new Map<string, number>();
  for (const row of membersRes.data ?? []) {
    memberCount.set(row.client_id, (memberCount.get(row.client_id) ?? 0) + 1);
  }

  return NextResponse.json(
    (folders ?? []).map((f) => ({
      ...f,
      diagramCount: diagramCount.get(f.id) ?? 0,
      memberCount:  memberCount.get(f.id)  ?? 0,
    }))
  );
}
