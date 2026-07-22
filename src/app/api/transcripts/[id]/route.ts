import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: transcript, error } = await supabase
    .from("meeting_transcripts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let changes: unknown[] = [];
  if (["ready_for_review", "applying", "completed"].includes(transcript.status)) {
    const { data } = await supabase
      .from("proposed_changes")
      .select("*")
      .eq("transcript_id", id)
      .order("sort_order", { ascending: true });
    changes = data ?? [];
  }

  return NextResponse.json({ transcript, changes });
}
