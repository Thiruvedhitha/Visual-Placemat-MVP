import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

type SelectionUpdate = { id: string; selected: boolean };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { selections?: SelectionUpdate[] } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body?.selections)) {
    return NextResponse.json({ error: "selections array is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify transcript exists
  const { data: transcript, error: checkErr } = await supabase
    .from("meeting_transcripts")
    .select("id")
    .eq("id", id)
    .single();

  if (checkErr || !transcript) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  // Batch update selections
  const updates = body.selections.map((sel) =>
    supabase
      .from("proposed_changes")
      .update({
        selected: sel.selected,
        status: sel.selected ? "accepted" : "declined",
      })
      .eq("id", sel.id)
      .eq("transcript_id", id)
  );

  await Promise.all(updates);

  return NextResponse.json({ ok: true });
}
