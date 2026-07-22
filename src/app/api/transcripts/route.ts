import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { cleanTranscript, truncateIfNeeded, analyzeTranscript } from "@/lib/transcript/processTranscript";
import type { Capability } from "@/types/capability";
import type { NodeStylePatch } from "@/lib/commands/index";

type LegendEntry = { id: string; label: string; color: string };
type LegendConfig = { fill: LegendEntry[]; border: LegendEntry[]; textColor: LegendEntry[] };

export async function POST(req: Request) {
  let body: { catalogId?: string; text?: string; title?: string; legend?: LegendConfig | null } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.text || body.text.trim().length < 50) {
    return NextResponse.json({ error: "Transcript is too short (minimum 50 characters)" }, { status: 400 });
  }
  if (!body.catalogId) {
    return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1 ── Create the transcript row ──────────────────────────────────────────
  const { data: transcript, error: insertErr } = await supabase
    .from("meeting_transcripts")
    .insert({
      catalog_id: body.catalogId,
      title: body.title?.trim() || "Untitled meeting",
      raw_text: body.text,
      status: "cleaning",
      progress: 10,
      current_step: "Removing noise",
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  try {
    // 2 ── Clean ─────────────────────────────────────────────────────────────
    const cleaned = cleanTranscript(truncateIfNeeded(body.text));
    await supabase.from("meeting_transcripts").update({
      cleaned_text: cleaned,
      status: "extracting",
      progress: 40,
      current_step: "Extracting capability changes",
    }).eq("id", transcript.id);

    // 3 ── Load canvas context from DB ────────────────────────────────────────
    const [{ data: caps }, { data: catalog }] = await Promise.all([
      supabase
        .from("capabilities")
        .select("*")
        .eq("catalog_id", body.catalogId)
        .eq("is_deleted", false)
        .order("sort_order"),
      supabase
        .from("capability_catalogs")
        .select("node_styles, chat_history")
        .eq("id", body.catalogId)
        .single(),
    ]);

    const capabilities: Capability[] = caps ?? [];
    const nodeStyles: Record<string, NodeStylePatch> =
      catalog?.node_styles && typeof catalog.node_styles === "object"
        ? (catalog.node_styles as Record<string, NodeStylePatch>)
        : {};
    // Legend is sent from the client in the request body (it lives in Zustand, not in the DB)
    const legend: LegendConfig | null = body.legend ?? null;

    // 4 ── Single-pass LLM extraction ─────────────────────────────────────────
    const analysis = await analyzeTranscript({ cleaned, capabilities, nodeStyles, legend });

    await supabase.from("meeting_transcripts").update({
      status: "resolving",
      progress: 70,
      current_step: "Preparing review",
    }).eq("id", transcript.id);

    // 5 ── Persist proposed changes ────────────────────────────────────────────
    if (analysis.todos.length > 0) {
      const rows = analysis.todos.map((todo, i) => ({
        transcript_id: transcript.id,
        todo_text: todo.text,
        source_quote: todo.quote ?? "",
        confidence: todo.confidence ?? 0.5,
        command: todo.command,
        selected: (todo.confidence ?? 0.5) >= 0.7,  // auto-select high-confidence
        sort_order: i,
      }));
      const { error: rowsErr } = await supabase.from("proposed_changes").insert(rows);
      if (rowsErr) throw new Error(rowsErr.message);
    }

    // 6 ── Mark ready for review ───────────────────────────────────────────────
    await supabase.from("meeting_transcripts").update({
      understanding: analysis.understanding,
      status: "ready_for_review",
      progress: 90,
      current_step: "Ready for review",
    }).eq("id", transcript.id);

    return NextResponse.json({ transcriptId: transcript.id });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[/api/transcripts POST] Failed:", message);
    await supabase.from("meeting_transcripts").update({
      status: "failed",
      error_message: message,
      current_step: "Failed",
    }).eq("id", transcript.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
