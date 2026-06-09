import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

/**
 * PATCH /api/catalogs/versions/[id]
 * Body: { name: string }
 * Renames a single visual_maps row.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("visual_maps")
    .update({ name })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
