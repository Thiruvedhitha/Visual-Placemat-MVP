import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { executeCommands } from "@/lib/commands/executor";
import type { NodeProposalPayload, TodoProposalPayload, TranscriptProposal, CommandProposalPayload } from "@/types/transcript";
import type { Capability, CapabilityStyleCategory } from "@/types/capability";
import type { DiagramCommand } from "@/lib/commands";
import { applyLegendCommands, type LegendCommand } from "@/lib/commands/legend";
import { resolveCapabilityName } from "./resolve";
import { mergeNodeStyleMaps, resolveCapabilityCategoryStyles } from "@/lib/capabilityStyles";
import {
  ensureCapabilityStyleCategories,
  persistCapabilityCategoryAssignments,
} from "@/lib/capabilityStyles.server";

export interface ApplyNewResult {
  catalogId: string;
  nodesCreated: number;
  appliedCount: number;
  failedCount: number;
  messages: string[];
  errors: string[];
}

export async function applyNew(transcriptId: string, userId: string): Promise<ApplyNewResult> {
  const supabase = getSupabaseAdmin();

  const { data: tx } = await supabase
    .from("meeting_transcripts")
    .select("title, meeting_date, summary, template_id")
    .eq("id", transcriptId)
    .single();

  // ── Template-based flow: clone template then apply command proposals ──────
  if (tx?.template_id) {
    return applyNewFromTemplate(transcriptId, userId, tx);
  }

  // Fetch accepted node proposals
  const { data: proposals } = await supabase
    .from("transcript_proposals")
    .select("*")
    .eq("transcript_id", transcriptId)
    .eq("kind", "node")
    .eq("selected", true)
    .order("sort_order");

  const { data: todosRaw } = await supabase
    .from("transcript_proposals")
    .select("*")
    .eq("transcript_id", transcriptId)
    .eq("kind", "todo")
    .eq("selected", true);

  const { data: commandsRaw } = await supabase
    .from("transcript_proposals")
    .select("*")
    .eq("transcript_id", transcriptId)
    .eq("kind", "command")
    .eq("selected", true)
    .order("sort_order");

  const nodes: TranscriptProposal[] = proposals ?? [];
  const todos: TranscriptProposal[] = todosRaw ?? [];
  const rawCommands = (commandsRaw ?? []).map(
    (proposal: TranscriptProposal) => ({ ...(proposal.payload as DiagramCommand) })
  );
  let commandAppliedCount = 0;
  let commandMessages: string[] = [];
  let commandErrors: string[] = [];

  // Create catalog
  const { data: catalog, error: catErr } = await supabase
    .from("capability_catalogs")
    .insert({
      user_id: userId,
      name: tx?.title ?? "Meeting Transcript",
      description: tx?.summary ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (catErr || !catalog) throw new Error(catErr?.message ?? "Failed to create catalog");

  const catalogId = catalog.id;

  // Build tempId → real uuid map; sort L0 first so parent FKs resolve
  const tempToReal = new Map<string, string>();
  const sorted = [...nodes].sort(
    (a, b) => (a.payload as NodeProposalPayload).level - (b.payload as NodeProposalPayload).level
  );

  const capRows: Capability[] = [];
  for (const proposal of sorted) {
    const p = proposal.payload as NodeProposalPayload;
    const realId = crypto.randomUUID();
    tempToReal.set(p.tempId, realId);

    const parentId = p.parentTempId ? (tempToReal.get(p.parentTempId) ?? null) : null;
    const creationStamp = `Created via transcript "${tx?.title ?? "import"}" on ${new Date().toLocaleDateString()}`;
    capRows.push({
      id: realId,
      catalog_id: catalogId,
      parent_id: parentId,
      level: p.level,
      name: p.name,
      description: p.description ?? null,
      note: creationStamp,
      sort_order: sorted.indexOf(proposal),
      source: "transcript",
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (capRows.length > 0) {
    const { error: capErr } = await supabase.from("capabilities").insert(capRows);
    if (capErr) throw new Error(capErr.message);
  }

  // Attach TODOs as node notes via fuzzy resolve
  for (const todo of todos) {
    const t = todo.payload as TodoProposalPayload;
    if (!t.targetName) continue;
    const match = resolveCapabilityName(t.targetName, capRows);
    if (!match) continue;

    const { data: existing } = await supabase
      .from("capabilities")
      .select("note")
      .eq("id", match.id)
      .single();
    const note = [existing?.note, `TODO: ${t.text}`].filter(Boolean).join("\n");
    await supabase.from("capabilities").update({ note }).eq("id", match.id);

    await supabase
      .from("transcript_proposals")
      .update({ status: "applied" })
      .eq("id", todo.id);
  }

  // Mark node proposals applied
  await supabase
    .from("transcript_proposals")
    .update({ status: "applied" })
    .eq("transcript_id", transcriptId)
    .eq("kind", "node")
    .eq("selected", true);

  // Highlight all created nodes with border + text color + legend
  if (capRows.length > 0) {
    const transcriptBorderColor = "#f59e0b";
    const transcriptTextColor = "#7c2d12";
    const commands = rawCommands.map((command) => {
      if (!("nodeId" in command)) return command;
      return { ...command, nodeId: tempToReal.get(command.nodeId) ?? command.nodeId } as DiagramCommand;
    });
    const legendCommands = commands.filter(
      (command): command is LegendCommand => command.type === "SET_LEGEND" || command.type === "REMOVE_LEGEND"
    );
    const styleCommands = commands.filter(
      (command) => command.type !== "SET_LEGEND" && command.type !== "REMOVE_LEGEND"
    );
    const execution = executeCommands(styleCommands, capRows, {});
    const nodeStyles = { ...execution.nodePatches };
    for (const cap of capRows) {
      nodeStyles[cap.id] = {
        ...(nodeStyles[cap.id] ?? {}),
        border: transcriptBorderColor,
        textColor: transcriptTextColor,
      };
    }

    const legendEntryId = `transcript_${transcriptId.slice(0, 8)}`;
    const legendLabel = tx?.title ?? "Transcript Import";
    const semanticLegend = applyLegendCommands(legendCommands);
    const legend = applyLegendCommands([
      { type: "SET_LEGEND", slot: "border", entryId: legendEntryId, label: legendLabel, color: transcriptBorderColor },
      { type: "SET_LEGEND", slot: "textColor", entryId: `${legendEntryId}_text`, label: `${legendLabel} text`, color: transcriptTextColor },
    ], semanticLegend);

    await supabase
      .from("capability_catalogs")
      .update({ node_styles: nodeStyles, chat_history: { map: [], commits: [], legend } })
      .eq("id", catalogId);

    const stylePlan = await ensureCapabilityStyleCategories(supabase, {
      catalogId,
      capabilityIds: capRows.map((capability) => capability.id),
      nodeStyles,
      legend,
      source: "transcript",
      sourceId: transcriptId,
    });
    await persistCapabilityCategoryAssignments(
      supabase,
      catalogId,
      capRows.map((capability) => capability.id),
      stylePlan.assignments
    );

    if ((commandsRaw ?? []).length > 0) {
      await supabase
        .from("transcript_proposals")
        .update({ status: "applied" })
        .eq("transcript_id", transcriptId)
        .eq("kind", "command")
        .eq("selected", true);
    }
    commandAppliedCount = legendCommands.length + execution.messages.length;
    commandMessages = [
      ...legendCommands.map((command) => command.type === "SET_LEGEND"
        ? `Category added: "${command.label}"`
        : `Category removed: "${command.entryId}"`),
      ...execution.messages,
    ];
    commandErrors = execution.errors;
  }

  // Backfill catalog_id on transcript row
  await supabase
    .from("meeting_transcripts")
    .update({ catalog_id: catalogId, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", transcriptId);

  return {
    catalogId,
    nodesCreated: capRows.length,
    appliedCount: commandAppliedCount,
    failedCount: commandErrors.length,
    messages: commandMessages,
    errors: commandErrors,
  };
}

// ── Template-based flow ───────────────────────────────────────────────────────

async function applyNewFromTemplate(
  transcriptId: string,
  userId: string,
  tx: { title: string | null; meeting_date: string | null; summary: string | null; template_id: string }
): Promise<ApplyNewResult> {
  const supabase = getSupabaseAdmin();

  // 1. Clone the template catalog
  const { data: template } = await supabase
    .from("capability_catalogs")
    .select("name, description, industry, node_styles, chat_history")
    .eq("id", tx.template_id)
    .single();

  const { data: newCatalog, error: catErr } = await supabase
    .from("capability_catalogs")
    .insert({
      user_id: userId,
      name: tx.title ?? template?.name ?? "Meeting Transcript",
      description: tx.summary ?? template?.description ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (catErr || !newCatalog) throw new Error(catErr?.message ?? "Failed to create catalog");
  const catalogId = newCatalog.id;

  // 2. Clone style categories first so capability references remain same-catalog.
  const { data: templateCategories, error: categoryLoadError } = await supabase
    .from("capability_style_categories")
    .select("*")
    .eq("catalog_id", tx.template_id);
  if (categoryLoadError) throw new Error(categoryLoadError.message);

  const categoryIdMap = new Map<string, string>();
  const clonedCategories = ((templateCategories ?? []) as CapabilityStyleCategory[]).map((category) => {
    const id = crypto.randomUUID();
    categoryIdMap.set(category.id, id);
    return {
      id,
      catalog_id: catalogId,
      slot: category.slot,
      entry_key: category.entry_key,
      label: category.label,
      color: category.color,
      source: category.source,
      source_id: category.source_id,
      created_by: category.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  if (clonedCategories.length > 0) {
    const { error } = await supabase.from("capability_style_categories").insert(clonedCategories);
    if (error) throw new Error(`Failed to clone style categories: ${error.message}`);
  }

  // 3. Copy capabilities with remapped node and category IDs.
  const { data: caps } = await supabase
    .from("capabilities")
    .select("*")
    .eq("catalog_id", tx.template_id)
    .eq("is_deleted", false)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });

  const oldToNew = new Map<string, string>();
  for (const cap of caps ?? []) oldToNew.set(cap.id, crypto.randomUUID());

  const clonedCaps: Capability[] = (caps ?? []).map((cap) => ({
    id: oldToNew.get(cap.id)!,
    catalog_id: catalogId,
    parent_id: cap.parent_id ? (oldToNew.get(cap.parent_id) ?? null) : null,
    level: cap.level,
    name: cap.name,
    description: cap.description ?? null,
    note: cap.note ?? null,
    sort_order: cap.sort_order,
    source: "template",
    is_deleted: false,
    fill_category_id: cap.fill_category_id ? (categoryIdMap.get(cap.fill_category_id) ?? null) : null,
    border_category_id: cap.border_category_id ? (categoryIdMap.get(cap.border_category_id) ?? null) : null,
    text_category_id: cap.text_category_id ? (categoryIdMap.get(cap.text_category_id) ?? null) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (clonedCaps.length > 0) {
    const { error } = await supabase.from("capabilities").insert(clonedCaps);
    if (error) throw new Error(`Failed to clone capabilities: ${error.message}`);
  }

  const clonedLegacyStyles: Record<string, Record<string, unknown>> = {};
  for (const [oldId, style] of Object.entries(template?.node_styles ?? {})) {
    const newId = oldToNew.get(oldId);
    if (newId) clonedLegacyStyles[newId] = style as Record<string, unknown>;
  }
  const templateLegend = template?.chat_history?.legend ?? { fill: [], border: [], textColor: [] };
  const initialStyles = mergeNodeStyleMaps(
    resolveCapabilityCategoryStyles(clonedCaps, clonedCategories),
    clonedLegacyStyles
  );
  await supabase.from("capability_catalogs").update({
    node_styles: clonedLegacyStyles,
    chat_history: { map: [], commits: [], legend: templateLegend },
  }).eq("id", catalogId);

  // 4. Apply accepted command proposals against the cloned catalog.
  const { data: commandProposals } = await supabase
    .from("transcript_proposals")
    .select("*")
    .eq("transcript_id", transcriptId)
    .eq("kind", "command")
    .eq("selected", true)
    .order("sort_order");

  // Build name→newId lookup for fallback resolution when LLM IDs don't match
  const nameToNewId = new Map<string, string>();
  for (const cap of caps ?? []) {
    const newId = oldToNew.get(cap.id)!;
    nameToNewId.set(cap.name.toLowerCase(), newId);
  }

  function remapId(id: string | undefined | null): string | undefined | null {
    if (!id || typeof id !== "string") return id;
    if (oldToNew.has(id)) return oldToNew.get(id)!;
    // Fallback: LLM may have used a name string instead of a UUID
    const byName = nameToNewId.get(id.toLowerCase());
    if (byName) return byName;
    return id; // pass through — executeCommands will report "not found"
  }

  const commands: DiagramCommand[] = (commandProposals ?? []).map(
    (p: TranscriptProposal) => {
      const cmd = { ...(p.payload as DiagramCommand) };
      // Remap template node IDs → cloned node IDs
      if ("nodeId" in cmd) {
        (cmd as Record<string, unknown>).nodeId = remapId((cmd as Record<string, unknown>).nodeId as string);
      }
      if ("parentId" in cmd) {
        (cmd as Record<string, unknown>).parentId = remapId((cmd as Record<string, unknown>).parentId as string);
      }
      if ("newParentId" in cmd) {
        (cmd as Record<string, unknown>).newParentId = remapId((cmd as Record<string, unknown>).newParentId as string);
      }
      if ("insertAfterId" in cmd) {
        (cmd as Record<string, unknown>).insertAfterId = remapId((cmd as Record<string, unknown>).insertAfterId as string);
      }
      return cmd;
    }
  );
  const legendCommands = commands.filter(
    (command): command is LegendCommand => command.type === "SET_LEGEND" || command.type === "REMOVE_LEGEND"
  );
  const diagramCommands = commands.filter(
    (command) => command.type !== "SET_LEGEND" && command.type !== "REMOVE_LEGEND"
  );

  let execMessages: string[] = [];
  let execErrors: string[] = [];
  let appliedCount = 0;
  let failedCount = 0;

  if (commands.length > 0) {
    const result = executeCommands(diagramCommands, clonedCaps, initialStyles);
    execMessages = [
      ...legendCommands.map((command) => command.type === "SET_LEGEND"
        ? `Category added: "${command.label}"`
        : `Category removed: "${command.entryId}"`),
      ...result.messages,
    ];
    execErrors = result.errors;
    appliedCount = legendCommands.length + result.messages.length;
    failedCount = result.errors.length;

    // Persist structural changes
    for (const cap of result.capabilities) {
      const orig = clonedCaps.find((c) => c.id === cap.id);
      if (!orig) {
        const stamp = `Added via transcript "${tx.title ?? "import"}" on ${new Date().toLocaleDateString()}`;
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
        const stamp = `Modified via transcript "${tx.title ?? "import"}" on ${new Date().toLocaleDateString()}`;
        const existingNote = orig.note ?? "";
        const { error } = await supabase
          .from("capabilities")
          .update({ name: cap.name, parent_id: cap.parent_id, sort_order: cap.sort_order,
            note: [existingNote, stamp].filter(Boolean).join("\n") })
          .eq("id", cap.id);
        if (error) throw new Error(`Failed to update capability "${cap.name}": ${error.message}`);
      }
    }

    const resultIds = new Set(result.capabilities.map((capability) => capability.id));
    for (const capability of clonedCaps) {
      if (!resultIds.has(capability.id)) {
        const { error } = await supabase.from("capabilities").update({ is_deleted: true }).eq("id", capability.id);
        if (error) throw new Error(`Failed to delete capability "${capability.name}": ${error.message}`);
      }
    }

    // Persist visual patches + border highlights on touched nodes
    const transcriptBorderColor = "#f59e0b";
    const transcriptTextColor = "#7c2d12";
    const touchedIds = new Set<string>();
    for (const cap of result.capabilities) {
      const orig = clonedCaps.find((c) => c.id === cap.id);
      if (!orig || orig.name !== cap.name || orig.parent_id !== cap.parent_id) {
        touchedIds.add(cap.id);
      }
    }
    const mergedPatches = { ...result.nodePatches };
    for (const id of touchedIds) {
      mergedPatches[id] = { ...(mergedPatches[id] ?? {}), border: transcriptBorderColor, textColor: transcriptTextColor };
    }
    await supabase.from("capability_catalogs").update({ node_styles: mergedPatches }).eq("id", catalogId);

    // Add legend entry for this transcript
    const legendEntryId = `transcript_${transcriptId.slice(0, 8)}`;
    const legendLabel = tx.title ?? "Transcript Import";
    const semanticLegend = applyLegendCommands(legendCommands, templateLegend);
    const legend = applyLegendCommands([
      { type: "SET_LEGEND", slot: "border", entryId: legendEntryId, label: legendLabel, color: transcriptBorderColor },
      { type: "SET_LEGEND", slot: "textColor", entryId: `${legendEntryId}_text`, label: `${legendLabel} text`, color: transcriptTextColor },
    ], semanticLegend);
    await supabase.from("capability_catalogs")
      .update({ chat_history: { map: [], commits: [], legend } })
      .eq("id", catalogId);

    const stylePlan = await ensureCapabilityStyleCategories(supabase, {
      catalogId,
      capabilityIds: result.capabilities.map((capability) => capability.id),
      nodeStyles: mergedPatches,
      legend,
      source: "transcript",
      sourceId: transcriptId,
      currentAssignments: Object.fromEntries(result.capabilities.map((capability) => [capability.id, {
        fill_category_id: capability.fill_category_id ?? null,
        border_category_id: capability.border_category_id ?? null,
        text_category_id: capability.text_category_id ?? null,
      }])),
    });
    await persistCapabilityCategoryAssignments(
      supabase,
      catalogId,
      result.capabilities.map((capability) => capability.id),
      stylePlan.assignments
    );

    // Mark proposals applied
    for (const p of commandProposals ?? []) {
      await supabase.from("transcript_proposals").update({ status: "applied" }).eq("id", (p as TranscriptProposal).id);
    }
  }

  // 5. Backfill transcript row
  await supabase
    .from("meeting_transcripts")
    .update({ catalog_id: catalogId, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", transcriptId);

  return {
    catalogId,
    nodesCreated: clonedCaps.length + commands.filter((c) => c.type === "ADD_NODE").length,
    appliedCount,
    failedCount,
    messages: execMessages,
    errors: execErrors,
  };
}
