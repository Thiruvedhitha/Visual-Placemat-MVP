import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export const runtime = "nodejs";

// PATCH /api/transcripts/[id]/proposals
// Body: { selections: Array<{ id: string; selected: boolean; payloadEdits?: object }> }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: tx } = await supabase
    .from("meeting_transcripts")
    .select("user_id")
    .eq("id", params.id)
    .single();

  if (!tx || tx.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const selections: { id: string; selected: boolean; payloadEdits?: Record<string, unknown> }[] =
    body.selections ?? [];

  for (const sel of selections) {
    const update: Record<string, unknown> = {
      selected: sel.selected,
      status: sel.selected ? "accepted" : "declined",
    };

    if (sel.payloadEdits) {
      // Merge edits into existing payload using Supabase jsonb concatenation
      const { data: existing } = await supabase
        .from("transcript_proposals")
        .select("payload")
        .eq("id", sel.id)
        .single();
      if (existing) {
        update.payload = { ...existing.payload, ...sel.payloadEdits };
      }
    }

    await supabase
      .from("transcript_proposals")
      .update(update)
      .eq("id", sel.id)
      .eq("transcript_id", params.id);
  }

  return NextResponse.json({ ok: true });
}
