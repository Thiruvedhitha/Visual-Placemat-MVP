import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import type { DiagramCommand } from "@/lib/commands/index";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Load transcript + selected changes
  const [{ data: transcript }, { data: changes }] = await Promise.all([
    supabase
      .from("meeting_transcripts")
      .select("id, catalog_id, title, understanding")
      .eq("id", id)
      .single(),
    supabase
      .from("proposed_changes")
      .select("*")
      .eq("transcript_id", id)
      .eq("selected", true)
      .order("sort_order"),
  ]);

  if (!transcript) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  if (!changes || changes.length === 0) {
    return NextResponse.json({ error: "No changes selected" }, { status: 400 });
  }

  // Extract DiagramCommands from the accepted rows
  const commands: DiagramCommand[] = changes
    .map((c) => c.command as DiagramCommand)
    .filter(Boolean);

  // Build the todos summary for the commit entry
  const todos: { text: string; quote: string }[] = changes.map((c) => ({
    text: c.todo_text as string,
    quote: c.source_quote as string ?? "",
  }));

  // Mark proposed_changes as applied
  await Promise.all(
    changes.map((c) =>
      supabase
        .from("proposed_changes")
        .update({ status: "applied" })
        .eq("id", c.id)
    )
  );

  // Mark transcript as completed
  await supabase
    .from("meeting_transcripts")
    .update({
      status: "completed",
      progress: 100,
      current_step: "Done",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Write a commit entry to chat_history so it appears in Version History panel.
  // Write directly to Supabase instead of an internal fetch (relative URLs don't work server-side).
  const adds     = commands.filter((c) => c.type === "ADD_NODE").length;
  const deletes  = commands.filter((c) => c.type === "DELETE_NODE").length;
  const renames  = commands.filter((c) => c.type === "RENAME_NODE" || c.type === "REPARENT_NODE").length;
  const styles   = commands.filter((c) =>
    c.type === "SET_STYLE" || c.type === "RESET_STYLE" ||
    c.type === "SET_TEXT_COLOR" || c.type === "SET_NOTE" ||
    c.type === "SET_DESCRIPTION" || c.type === "SET_LEGEND"
  ).length;

  if (transcript.catalog_id) {
    try {
      const newCommit = {
        prompt: `Transcript: ${transcript.title ?? "Untitled meeting"}`,
        summary: transcript.understanding ?? `Applied ${commands.length} change${commands.length !== 1 ? "s" : ""} from meeting transcript`,
        adds,
        deletes,
        renames,
        styles,
        ts: new Date().toISOString(),
      };
      const { data: catalogRow } = await supabase
        .from("capability_catalogs")
        .select("chat_history")
        .eq("id", transcript.catalog_id)
        .single();
      const history = (catalogRow?.chat_history ?? { map: [], commits: [] }) as {
        map: unknown[];
        commits: unknown[];
        sessions?: unknown[];
      };
      const commits = Array.isArray(history.commits) ? history.commits : [];
      commits.push(newCommit);
      history.commits = commits.slice(-50); // keep last 50, same as /api/chat
      await supabase
        .from("capability_catalogs")
        .update({ chat_history: history })
        .eq("id", transcript.catalog_id);
    } catch {
      // Non-fatal — commands still apply even if the commit write fails
    }
  }

  return NextResponse.json({ commands, todos });
}