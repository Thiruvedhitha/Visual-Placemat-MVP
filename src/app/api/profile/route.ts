import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

/** GET /api/profile — returns the current user's profile including platform_role */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data } = await db
    .from("user_profiles")
    .select("user_id, display_name, email, platform_role")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    userId:        user.id,
    email:         data?.email        ?? user.email ?? "",
    displayName:   data?.display_name ?? user.email ?? "",
    platformRole:  data?.platform_role ?? "user",
  });
}

/** PATCH /api/profile — update display_name */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;
  if (!displayName) return NextResponse.json({ error: "displayName is required" }, { status: 400 });

  const db = getSupabaseAdmin();
  await db
    .from("user_profiles")
    .upsert({ user_id: user.id, display_name: displayName, email: user.email ?? "", updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
