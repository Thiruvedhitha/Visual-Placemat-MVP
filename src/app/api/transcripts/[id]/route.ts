import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export const runtime = "nodejs";

// GET /api/transcripts/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data: transcript, error } = await supabase
    .from("meeting_transcripts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let proposals = { nodes: [] as unknown[], commands: [] as unknown[], todos: [] as unknown[] };

  if (["ready_for_review", "applying", "completed"].includes(transcript.status)) {
    const { data } = await supabase
      .from("transcript_proposals")
      .select("*")
      .eq("transcript_id", params.id)
      .order("sort_order", { ascending: true });

    for (const row of data ?? []) {
      if (row.kind === "node") proposals.nodes.push(row);
      else if (row.kind === "command") proposals.commands.push(row);
      else proposals.todos.push(row);
    }
  }

  return NextResponse.json({ transcript, proposals });
}
