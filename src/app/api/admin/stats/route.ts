import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { isPlatformAdmin, httpUnauthorized, httpForbidden } from "@/lib/auth/authorization";

export async function GET() {
  const user = await getUser();
  if (!user) return httpUnauthorized();
  if (!(await isPlatformAdmin(user.id))) return httpForbidden();

  const db = getSupabaseAdmin();
  const [usersRes, foldersRes, activeDiagramsRes, archivedDiagramsRes, membersRes] = await Promise.all([
    db.from("user_profiles").select("*", { count: "exact", head: true }),
    db.from("clients").select("*", { count: "exact", head: true }),
    db.from("capability_catalogs").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("capability_catalogs").select("*", { count: "exact", head: true }).eq("status", "archived"),
    db.from("client_members").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    users:           usersRes.count   ?? 0,
    folders:         foldersRes.count ?? 0,
    activeDiagrams:  activeDiagramsRes.count   ?? 0,
    archivedDiagrams: archivedDiagramsRes.count ?? 0,
    memberships:     membersRes.count ?? 0,
  });
}
