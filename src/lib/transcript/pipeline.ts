import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { cleanTranscript } from "./clean";
import { pass1Filter } from "./pass1-filter";
import { pass2Extract } from "./pass2-extract";
import { pass3Todos } from "./pass3-todos";
import { resolveCapabilityName } from "./resolve";
import type { NodeProposalPayload, CommandProposalPayload, TodoProposalPayload } from "@/types/transcript";

type EmitFn = (event: { progress: number; step: string }) => void;

async function setStatus(
  transcriptId: string,
  progress: number,
  step: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  await getSupabaseAdmin()
    .from("meeting_transcripts")
    .update({ progress, current_step: step, status, ...extra })
    .eq("id", transcriptId);
}

async function setFailed(transcriptId: string, message: string) {
  await getSupabaseAdmin()
    .from("meeting_transcripts")
    .update({ status: "failed", error_message: message })
    .eq("id", transcriptId);
}

export async function runPipeline(transcriptId: string, emit: EmitFn): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Load transcript row
  const { data: tx, error: txErr } = await supabase
    .from("meeting_transcripts")
    .select("*")
    .eq("id", transcriptId)
    .single();

  if (txErr || !tx) throw new Error("Transcript not found");

  try {
    // ── Stage 1: Clean (15%) ─────────────────────────────────────────────────
    await setStatus(transcriptId, 10, "Parsing & cleaning transcript", "cleaning");
    emit({ progress: 10, step: "Parsing & cleaning transcript" });

    const { cleaned } = cleanTranscript(tx.raw_text);
    await supabase.from("meeting_transcripts").update({ cleaned_text: cleaned }).eq("id", transcriptId);

    // ── Stage 2: Pass 1 – Relevance filter (30%) ─────────────────────────────
    await setStatus(transcriptId, 20, "Filtering noise", "filtering");
    emit({ progress: 20, step: "Filtering noise" });

    const filtered = await pass1Filter(cleaned, tx.context_prompt ?? undefined);
    await setStatus(transcriptId, 30, "Noise filtered", "filtering");
    emit({ progress: 30, step: "Noise filtered" });

    // ── Stage 3: Pass 2 – Structural extraction (55%) ────────────────────────
    await setStatus(transcriptId, 35, "Extracting capabilities & commands", "extracting");
    emit({ progress: 35, step: "Extracting capabilities & commands" });

    let capabilities: import("@/types/capability").Capability[] = [];
    let nodeStyles: Record<string, import("@/lib/commands").NodeStylePatch> = {};
    let legend: { fill: { id: string; label: string; color: string }[]; border: { id: string; label: string; color: string }[] } | undefined;

    if (tx.mode === "edit_diagram" && tx.catalog_id) {
      const { data: caps } = await supabase
        .from("capabilities")
        .select("*")
        .eq("catalog_id", tx.catalog_id)
        .eq("is_deleted", false);
      capabilities = caps ?? [];

      const { data: catalog } = await supabase
        .from("capability_catalogs")
        .select("node_styles, chat_history")
        .eq("id", tx.catalog_id)
        .single();
      nodeStyles = catalog?.node_styles ?? {};
      legend = catalog?.chat_history?.legend;
    } else if (tx.mode === "new_diagram" && tx.template_id) {
      // Load template so pass2 uses edit-style commands against it
      const { data: caps } = await supabase
        .from("capabilities")
        .select("*")
        .eq("catalog_id", tx.template_id)
        .eq("is_deleted", false);
      capabilities = caps ?? [];
    }

    // Use edit-mode extraction when a template is selected for a new diagram
    const extractMode = (tx.mode === "new_diagram" && tx.template_id && capabilities.length > 0)
      ? "edit_diagram"
      : tx.mode;

    const pass2Result = await pass2Extract(filtered, extractMode, { capabilities, nodeStyles, legend, contextPrompt: tx.context_prompt ?? undefined });
    await setStatus(transcriptId, 55, "Extraction complete", "extracting");
    emit({ progress: 55, step: "Extraction complete" });

    // ── Stage 4: Pass 3 – TODOs + summary (80%) ──────────────────────────────
    await setStatus(transcriptId, 60, "Extracting action items & summary", "extracting");
    emit({ progress: 60, step: "Extracting action items & summary" });

    const isNewMode = tx.mode === "new_diagram";
    const isTemplateMode = isNewMode && !!tx.template_id && capabilities.length > 0;
    const pass2Summary = (!isNewMode || isTemplateMode)
      ? `Proposed ${(pass2Result as { commands: CommandProposalPayload[] }).commands?.length ?? 0} diagram commands`
      : `Proposed ${(pass2Result as { nodes: NodeProposalPayload[] }).nodes?.length ?? 0} capability nodes`;

    const { summary, todos } = await pass3Todos(filtered, pass2Summary, tx.context_prompt ?? undefined);
    await supabase.from("meeting_transcripts").update({ summary }).eq("id", transcriptId);
    await setStatus(transcriptId, 80, "TODOs extracted", "resolving");
    emit({ progress: 80, step: "TODOs extracted" });

    // ── Stage 5: Resolve fuzzy names (95%) ───────────────────────────────────
    emit({ progress: 85, step: "Resolving capability names" });

    const proposals: {
      kind: string;
      payload: NodeProposalPayload | CommandProposalPayload | TodoProposalPayload;
      confidence: number;
      source_quote: string | null;
      selected: boolean;
      sort_order: number;
    }[] = [];

    let order = 0;

    if (isNewMode && !isTemplateMode) {
      const nodes = (pass2Result as { nodes: NodeProposalPayload[] }).nodes ?? [];
      for (const node of nodes) {
        const confidence = (node as NodeProposalPayload & { confidence?: number }).confidence ?? 0.7;
        proposals.push({
          kind: "node",
          payload: node,
          confidence,
          source_quote: (node as NodeProposalPayload & { sourceQuote?: string }).sourceQuote ?? null,
          selected: confidence >= 0.7,
          sort_order: order++,
        });
      }
      const commands = (pass2Result as { commands?: CommandProposalPayload[] }).commands ?? [];
      for (const cmd of commands) {
        const confidence = cmd.confidence ?? 0.7;
        proposals.push({
          kind: "command",
          payload: cmd,
          confidence,
          source_quote: cmd.sourceQuote ?? null,
          selected: confidence >= 0.7,
          sort_order: order++,
        });
      }
    } else {
      const commands = (pass2Result as { commands: CommandProposalPayload[] }).commands ?? [];
      for (const cmd of commands) {
        const confidence = cmd.confidence ?? 0.7;
        proposals.push({
          kind: "command",
          payload: cmd,
          confidence,
          source_quote: cmd.sourceQuote ?? null,
          selected: confidence >= 0.7,
          sort_order: order++,
        });
      }
    }

    // Resolve TODO targetName → targetNodeId
    for (const todo of todos) {
      let targetNodeId: string | null = null;
      if (todo.targetName && capabilities.length > 0) {
        const match = resolveCapabilityName(todo.targetName, capabilities);
        if (match) targetNodeId = match.id;
      }
      proposals.push({
        kind: "todo",
        payload: { ...todo, targetNodeId },
        confidence: 0.8,
        source_quote: todo.sourceQuote ?? null,
        selected: true,
        sort_order: order++,
      });
    }

    // ── Stage 6: Persist proposals (100%) ────────────────────────────────────
    if (proposals.length > 0) {
      await supabase.from("transcript_proposals").insert(
        proposals.map((p) => ({ ...p, transcript_id: transcriptId }))
      );
    }

    await setStatus(transcriptId, 100, "Ready for review", "ready_for_review", {
      completed_at: new Date().toISOString(),
    });
    emit({ progress: 100, step: "Ready for review" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await setFailed(transcriptId, message);
    throw err;
  }
}
