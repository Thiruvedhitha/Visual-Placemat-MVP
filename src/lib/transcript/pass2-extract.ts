import OpenAI from "openai";
import type { Capability } from "@/types/capability";
import type { NodeStylePatch } from "@/lib/commands";
import type { NodeProposalPayload, CommandProposalPayload, TranscriptMode } from "@/types/transcript";

const openai = new OpenAI();

// ── Helpers ───────────────────────────────────────────────────────────────────

function capsToYaml(caps: Capability[]): string {
  const byParent = new Map<string | null, Capability[]>();
  for (const c of caps) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const lines: string[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    for (const c of children) {
      lines.push(`${"  ".repeat(depth)}- id: ${c.id}\n${"  ".repeat(depth)}  name: "${c.name}"\n${"  ".repeat(depth)}  level: ${c.level}`);
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return lines.join("\n");
}

const COMMAND_TYPES = `
SET_STYLE: { type, nodeId, fill?, border? } — set background/border hex colour
SET_NOTE: { type, nodeId, note } — attach a text note
SET_DESCRIPTION: { type, nodeId, description } — update description field
SET_TEXT_COLOR: { type, nodeId, color } — set text hex colour
RENAME_NODE: { type, nodeId, newName } — rename a capability
REPARENT_NODE: { type, nodeId, newParentId } — move node under a different parent
DELETE_NODE: { type, nodeId, reparentChildren? } — delete a node (and optionally lift children)
ADD_NODE: { type, tempId (new uuid), parentId, level (0-3), name, description?, insertAfterId? } — add new node
RESET_STYLE: { type, nodeId, fill?, border?, textColor? } — remove style overrides
SET_LEGEND: { type, slot ("fill"|"border"|"textColor"), entryId, label, color } — add/update legend entry
REMOVE_LEGEND: { type, slot, entryId } — remove a legend entry
`.trim();

// ── new_diagram mode ──────────────────────────────────────────────────────────

export interface Pass2NewResult {
  nodes: NodeProposalPayload[];
  commands: CommandProposalPayload[];
}

async function extractNew(filteredText: string, contextPrompt?: string): Promise<Pass2NewResult> {
  const contextSection = contextPrompt ? `\n\nUser specifications:\n${contextPrompt}` : "";
  const attempt = async (extra = ""): Promise<Pass2NewResult> => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract a hierarchical business capability map from a meeting transcript.
Return JSON: { "nodes": [ ...node objects... ], "commands": [ ...command objects... ] }

Each node: { "tempId": "<unique string like n1,n2...>", "parentTempId": "<parent tempId or null>", "level": 0|1|2|3, "name": "<capability name>", "description": "<optional short description>", "confidence": 0.0-1.0, "sourceQuote": "<exact verbatim quote that supports this node>" }

Commands are used only for semantic categories and visual assignments in new diagrams:
- SET_LEGEND: { "type": "SET_LEGEND", "slot": "fill"|"border"|"textColor", "entryId": "<stable-kebab-case-id>", "label": "<category label>", "color": "<#RRGGBB>", "confidence": 0.0-1.0, "sourceQuote": "<supporting transcript quote or User specifications>", "rationale": "<reason>" }
- SET_STYLE: { "type": "SET_STYLE", "nodeId": "<node tempId>", "fill": "<#RRGGBB>", "border": "<#RRGGBB optional>", "confidence": 0.0-1.0, "sourceQuote": "<supporting quote>", "rationale": "<reason>" }
- SET_TEXT_COLOR: { "type": "SET_TEXT_COLOR", "nodeId": "<node tempId>", "color": "<#RRGGBB>", "confidence": 0.0-1.0, "sourceQuote": "<supporting quote>", "rationale": "<reason>" }

Rules:
- Level 0 = top-level domain (e.g. "Finance", "HR")
- Level 1 = sub-domain under L0, Level 2 = capability under L1, Level 3 = sub-capability under L2
- parentTempId must reference another node's tempId (or null for L0)
- When User specifications define legend categories, emit one SET_LEGEND command for every category even if the category rules came from the context textbox rather than the transcript
- When a transcript statement classifies a node under a specified category, emit a SET_STYLE command using that category's exact color and the node's tempId
- Do not use node names or invented UUIDs as nodeId in new-diagram commands; use the exact tempId from the nodes array
- Do not emit ADD_NODE commands because every new capability must already be present in the nodes array
- Include confidence ∈ [0,1] per node (how certain you are this was explicitly mentioned)
- sourceQuote must be non-empty${contextSection}${extra}`,
        },
        { role: "user", content: filteredText },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.nodes)) throw new Error("nodes missing");
    if (parsed.commands !== undefined && !Array.isArray(parsed.commands)) throw new Error("commands invalid");
    return {
      nodes: parsed.nodes as NodeProposalPayload[],
      commands: (parsed.commands ?? []) as CommandProposalPayload[],
    };
  };

  try {
    return await attempt();
  } catch {
    return await attempt(" You MUST return valid JSON.");
  }
}

// ── edit_diagram mode ─────────────────────────────────────────────────────────

export interface Pass2EditResult {
  commands: CommandProposalPayload[];
}

async function extractEdit(
  filteredText: string,
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch>,
  legend?: { fill: { id: string; label: string; color: string }[]; border: { id: string; label: string; color: string }[] },
  contextPrompt?: string
): Promise<Pass2EditResult> {
  const treeYaml = capsToYaml(capabilities);
  const legendText = legend
    ? `Fill categories: ${legend.fill.map((e) => `${e.id}=${e.color}`).join(", ")}\nBorder categories: ${legend.border.map((e) => `${e.id}=${e.color}`).join(", ")}`
    : "No legend defined yet.";
  const contextSection = contextPrompt ? `\n\nUser specifications:\n${contextPrompt}\n\nFollow these rules when generating SET_STYLE and SET_LEGEND commands based on the specifications above.` : "";

  const attempt = async (extra = ""): Promise<Pass2EditResult> => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You propose diagram commands based on a meeting transcript and the existing capability tree.
Available command types: ${COMMAND_TYPES}

IMPORTANT: When referencing existing nodes in commands (nodeId, newParentId, insertAfterId), you MUST use the exact "id" UUID values from the capability tree below. Do NOT use node names as IDs.

Return JSON: { "commands": [ ...command objects... ] }
Each command must include the standard fields for its type PLUS:
  "confidence": 0.0-1.0 (how explicitly this was mentioned in the transcript)
  "sourceQuote": "<verbatim quote supporting this command>"
  "rationale": "<one sentence why>"

Existing capability tree (YAML):
${treeYaml}

Current legend:
${legendText}${contextSection}${extra}`,
        },
        { role: "user", content: filteredText },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.commands)) throw new Error("commands missing");
    return { commands: parsed.commands as CommandProposalPayload[] };
  };

  try {
    return await attempt();
  } catch {
    return await attempt(" You MUST return valid JSON.");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function pass2Extract(
  filteredText: string,
  mode: TranscriptMode,
  ctx: {
    capabilities?: Capability[];
    nodeStyles?: Record<string, NodeStylePatch>;
    legend?: { fill: { id: string; label: string; color: string }[]; border: { id: string; label: string; color: string }[] };
    contextPrompt?: string;
  }
): Promise<Pass2NewResult | Pass2EditResult> {
  if (mode === "new_diagram") {
    return extractNew(filteredText, ctx.contextPrompt);
  } else {
    return extractEdit(filteredText, ctx.capabilities ?? [], ctx.nodeStyles ?? {}, ctx.legend, ctx.contextPrompt);
  }
}
