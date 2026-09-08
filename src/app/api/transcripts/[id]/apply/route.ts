import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { applyNew } from "@/lib/transcript/applyNew";
import { applyEdit } from "@/lib/transcript/applyEdit";

export const runtime = "nodejs";

// POST /api/transcripts/[id]/apply
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data: tx, error } = await supabase
    .from("meeting_transcripts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tx.status !== "ready_for_review") {
    return NextResponse.json(
      { error: `Cannot apply — transcript status is '${tx.status}', expected 'ready_for_review'` },
      { status: 409 }
    );
  }

  await supabase
    .from("meeting_transcripts")
    .update({ status: "applying", progress: 95, current_step: "Applying changes" })
    .eq("id", params.id);

  try {
    if (tx.mode === "new_diagram") {
      const result = await applyNew(params.id, user.id);
      return NextResponse.json({ ok: true, catalogId: result.catalogId, nodesCreated: result.nodesCreated });
    } else {
      if (!tx.catalog_id) {
        return NextResponse.json({ error: "catalog_id missing on transcript" }, { status: 400 });
      }
      const result = await applyEdit(params.id, tx.catalog_id);
      return NextResponse.json({ ok: true, ...result, catalogId: tx.catalog_id });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("meeting_transcripts")
      .update({ status: "failed", error_message: message })
      .eq("id", params.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
