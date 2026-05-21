import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

/**
 * GET /api/catalogs/versions?catalogId=xxx
 *
 * Returns all visual_maps versions for a catalog, newest first.
 */
export async function GET(request: NextRequest) {
  const catalogId = request.nextUrl.searchParams.get("catalogId");

  if (!catalogId) {
    return NextResponse.json({ error: "Missing catalogId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("visual_maps")
    .select("id, version_number, name, is_active, created_at")
    .eq("catalog_id", catalogId)
    .order("version_number", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ versions: data ?? [] });
}
