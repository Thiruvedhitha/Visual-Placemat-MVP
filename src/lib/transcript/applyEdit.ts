import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { executeCommands } from "@/lib/commands/executor";
import { resolveCapabilityName } from "./resolve";
import type { CommandProposalPayload, TodoProposalPayload, TranscriptProposal } from "@/types/transcript";
import type { DiagramCommand } from "@/lib/commands";
import { applyLegendCommands, type LegendCommand } from "@/lib/commands/legend";
import type { Capability, CapabilityStyleCategory } from "@/types/capability";
import { mergeNodeStyleMaps, resolveCapabilityCategoryStyles } from "@/lib/capabilityStyles";
import {
  ensureCapabilityStyleCategories,
  persistCapabilityCategoryAssignments,
} from "@/lib/capabilityStyles.server";

export interface ApplyEditResult {
  appliedCount: number;
  failedCount: number;
  messages: string[];
  errors: string[];
}

export async function applyEdit(transcriptId: string, catalogId: string): Promise<ApplyEditResult> {
  const supabase = getSupabaseAdmin();

  // Load diagram state
  const { data: caps } = await supabase
    .from("capabilities")
    .select("*")
    .eq("catalog_id", catalogId)
    .eq("is_deleted", false);

  const { data: catalogRow } = await supabase
    .from("capability_catalogs")
    .select("node_styles, chat_history")
    .eq("id", catalogId)
    .single();

  const capabilities: Capability[] = caps ?? [];
  const { data: categoryRows } = await supabase
    .from("capability_style_categories")
    .select("*")
    .eq("catalog_id", catalogId);
  const categoryStyles = resolveCapabilityCategoryStyles(
    capabilities,
    (categoryRows ?? []) as CapabilityStyleCategory[]
  );
  const existingPatches = mergeNodeStyleMaps(categoryStyles, catalogRow?.node_styles ?? {});
  const chatHistory = catalogRow?.chat_history ?? { map: [], commits: [] };

  // Load accepted command proposals
  const { data: commandProposals } = await supabase
    .from("transcript_proposals")
    .select("*")
    .eq("transcript_id", transcriptId)
    .eq("kind", "command")
    .eq("selected", true)
    .order("sort_order");

  const { data: todoProposals } = await supabase
    .from("transcript_proposals")
    .select("*")
    .eq("transcript_id", transcriptId)
    .eq("kind", "todo")
    .eq("selected", true);

  const { data: txRow } = await supabase
    .from("meeting_transcripts")
    .select("summary, title")
    .eq("id", transcriptId)
    .single();

  // Build and execute commands
  const commands: DiagramCommand[] = (commandProposals ?? []).map(
    (p: TranscriptProposal) => p.payload as DiagramCommand
  );
  const legendCommands = commands.filter(
    (command): command is LegendCommand => command.type === "SET_LEGEND" || command.type === "REMOVE_LEGEND"
  );
  const diagramCommands = commands.filter(
    (command) => command.type !== "SET_LEGEND" && command.type !== "REMOVE_LEGEND"
  );
  if (legendCommands.length > 0) {
    chatHistory.legend = applyLegendCommands(legendCommands, chatHistory.legend);
  }

  let appliedCount = 0;
  let failedCount = 0;
  let cmdMessages: string[] = [];
  let cmdErrors: string[] = [];

  if (commands.length > 0) {
    const result = executeCommands(diagramCommands, capabilities, existingPatches);
    appliedCount = legendCommands.length + diagramCommands.length - result.errors.length;
    failedCount = result.errors.length;
    cmdMessages = [
      ...legendCommands.map((command) => command.type === "SET_LEGEND"
        ? `Category added: "${command.label}"`
        : `Category removed: "${command.entryId}"`),
      ...result.messages,
    ];
    cmdErrors = result.errors;

    // Persist structural changes: capabilities table
    const updatedCaps = result.capabilities;
    for (const cap of updatedCaps) {
      const orig = capabilities.find((c) => c.id === cap.id);
      if (!orig) {
        // new node from ADD_NODE
        const stamp = `Added via transcript "${txRow?.title ?? "import"}" on ${new Date().toLocaleDateString()}`;
        const { error } = await supabase.from("capabilities").insert({
          id: cap.id,
          catalog_id: catalogId,
          parent_id: cap.parent_id,
          level: cap.level,
          name: cap.name,
          description: cap.description ?? null,
          note: stamp,
          sort_order: cap.sort_order,
          source: "transcript",
        });
        if (error) throw new Error(`Failed to add capability "${cap.name}": ${error.message}`);
      } else if (orig.name !== cap.name || orig.parent_id !== cap.parent_id) {
        const modStamp = `Modified via transcript "${txRow?.title ?? "import"}" on ${new Date().toLocaleDateString()}`;
        const { data: existing } = await supabase.from("capabilities").select("note").eq("id", cap.id).single();
        const updatedNote = [existing?.note, modStamp].filter(Boolean).join("\n");
        const { error } = await supabase
          .from("capabilities")
          .update({ name: cap.name, parent_id: cap.parent_id, sort_order: cap.sort_order, note: updatedNote })
          .eq("id", cap.id);
        if (error) throw new Error(`Failed to update capability "${cap.name}": ${error.message}`);
      }
    }

    // Handle deletions: capabilities in orig but not in result
    const resultIds = new Set(updatedCaps.map((c) => c.id));
    for (const cap of capabilities) {
      if (!resultIds.has(cap.id)) {
        const { error } = await supabase.from("capabilities").update({ is_deleted: true }).eq("id", cap.id);
        if (error) throw new Error(`Failed to delete capability "${cap.name}": ${error.message}`);
      }
    }

    // Persist visual patches
    await supabase
      .from("capability_catalogs")
      .update({ node_styles: result.nodePatches })
      .eq("id", catalogId);

    // Highlight added/modified nodes with a border color + text color
    const transcriptBorderColor = "#f59e0b"; // amber-500
    const transcriptTextColor = "#7c2d12"; // dark amber for readability
    const touchedIds = new Set<string>();
    for (const cap of updatedCaps) {
      const orig = capabilities.find((c) => c.id === cap.id);
      if (!orig || orig.name !== cap.name || orig.parent_id !== cap.parent_id) {
        touchedIds.add(cap.id);
      }
    }
    const mergedPatches = { ...result.nodePatches };
    if (touchedIds.size > 0) {
      for (const id of touchedIds) {
        mergedPatches[id] = { ...(mergedPatches[id] ?? {}), border: transcriptBorderColor, textColor: transcriptTextColor };
      }
      await supabase.from("capability_catalogs").update({ node_styles: mergedPatches }).eq("id", catalogId);

      // Add border legend entry with transcript title
      const legendEntryId = `transcript_${transcriptId.slice(0, 8)}`;
      const legendLabel = txRow?.title ?? "Transcript Import";
      const existingLegend = chatHistory?.legend ?? { fill: [], border: [], textColor: [] };
      const borderEntries = [...(existingLegend.border ?? [])];
      const textEntries = [...(existingLegend.textColor ?? [])];
      if (!borderEntries.find((e: { id: string }) => e.id === legendEntryId)) {
        borderEntries.push({ id: legendEntryId, label: legendLabel, color: transcriptBorderColor });
      }
      const textLegendEntryId = `${legendEntryId}_text`;
      if (!textEntries.find((e: { id: string }) => e.id === textLegendEntryId)) {
        textEntries.push({ id: textLegendEntryId, label: `${legendLabel} text`, color: transcriptTextColor });
      }
      chatHistory.legend = { ...existingLegend, border: borderEntries, textColor: textEntries };
    }

    const stylePlan = await ensureCapabilityStyleCategories(supabase, {
      catalogId,
      capabilityIds: updatedCaps.map((capability) => capability.id),
      nodeStyles: mergedPatches,
      legend: chatHistory.legend,
      source: "transcript",
      sourceId: transcriptId,
      currentAssignments: Object.fromEntries(updatedCaps.map((capability) => [capability.id, {
        fill_category_id: capability.fill_category_id ?? null,
        border_category_id: capability.border_category_id ?? null,
        text_category_id: capability.text_category_id ?? null,
      }])),
    });
    await persistCapabilityCategoryAssignments(
      supabase,
      catalogId,
      updatedCaps.map((capability) => capability.id),
      stylePlan.assignments
    );

    // Mark command proposals
    for (const p of commandProposals ?? []) {
      await supabase
        .from("transcript_proposals")
        .update({ status: result.errors.length > 0 ? "applied" : "applied" })
        .eq("id", (p as TranscriptProposal).id);
    }
  }

  // Apply TODO proposals: attach note to target node
  for (const todoP of todoProposals ?? []) {
    const t = todoP.payload as TodoProposalPayload;
    let targetId = t.targetNodeId ?? null;
    if (!targetId && t.targetName) {
      const match = resolveCapabilityName(t.targetName, capabilities);
      if (match) targetId = match.id;
    }
    if (targetId) {
      const { data: cap } = await supabase.from("capabilities").select("note").eq("id", targetId).single();
      const note = [cap?.note, `TODO: ${t.text}`].filter(Boolean).join("\n");
      await supabase.from("capabilities").update({ note }).eq("id", targetId);
    }
    await supabase.from("transcript_proposals").update({ status: "applied" }).eq("id", todoP.id);
  }

  // Append to chat_history.commits + persist legend if border highlights were added
  const commit = {
    prompt: `Transcript: ${txRow?.title ?? "Meeting"}`,
    summary: txRow?.summary ?? "",
    adds: commands.filter((c) => c.type === "ADD_NODE").length,
    deletes: commands.filter((c) => c.type === "DELETE_NODE").length,
    renames: commands.filter((c) => c.type === "RENAME_NODE").length,
    styles: commands.filter((c) => c.type === "SET_STYLE" || c.type === "SET_TEXT_COLOR" || c.type === "SET_LEGEND").length,
    ts: new Date().toISOString(),
  };
  const commits = [...(chatHistory.commits ?? []), commit].slice(-50);
  const finalChatHistory = { ...chatHistory, commits };
  await supabase
    .from("capability_catalogs")
    .update({ chat_history: finalChatHistory })
    .eq("id", catalogId);

  // Mark transcript complete
  await supabase
    .from("meeting_transcripts")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", transcriptId);

  return { appliedCount, failedCount, messages: cmdMessages, errors: cmdErrors };
}
