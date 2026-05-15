import type { Capability } from "@/types/capability";
import type { NodeStylePatch } from "./index";

type LegendEntry = { id: string; label: string; color: string };
type LegendConfig = { fill: LegendEntry[]; border: LegendEntry[] };

/**
 * Builds the Anthropic system prompt that instructs the LLM what commands
 * it can emit and how the current diagram looks.
 */
export function buildCommandPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch> = {},
  allCapabilities?: Capability[],
  legend?: LegendConfig
): string {
  const tree = renderTree(capabilities, nodeStyles, allCapabilities);

  // Render current legend so the AI knows what categories already exist
  const legendSection = buildLegendSection(legend);

  return `You are an AI assistant for editing a capability map diagram.

## Available Commands
Reply with ONLY a JSON object in this exact shape:
{
  "commands": [ ...command objects... ],
  "summary": "one sentence describing what you did"
}

### Command types

1. SET_STYLE — change background fill and/or border colour
{ "type": "SET_STYLE", "nodeId": "<uuid>", "fill": "#rrggbb", "border": "#rrggbb" }

2. SET_NOTE — add or replace a text note
{ "type": "SET_NOTE", "nodeId": "<uuid>", "note": "text" }

3. RENAME_NODE — rename a capability
{ "type": "RENAME_NODE", "nodeId": "<uuid>", "newName": "new name" }

4. REPARENT_NODE — move a node under a different parent
{ "type": "REPARENT_NODE", "nodeId": "<uuid>", "newParentId": "<uuid>" }
   STRICT level rules: the new parent must be EXACTLY one level above the node.
   L1 → must go under an L0. L2 → must go under an L1. L3 → must go under an L2.
   NEVER place a node under a node at the same or lower level (e.g. L2 under L2 is INVALID).
   If the user asks to move a node inside a same-level node, return an empty commands array and explain in "summary" that the move is invalid.

5. DELETE_NODE — permanently delete a node and all its descendants
{ "type": "DELETE_NODE", "nodeId": "<uuid>" }
   Optional: set "reparentChildren": true to lift the node's direct children up to its parent instead of deleting them too.
{ "type": "DELETE_NODE", "nodeId": "<uuid>", "reparentChildren": true }

6. ADD_NODE — add a new capability node
{ "type": "ADD_NODE", "tempId": "<new-uuid-v4>", "parentId": "<uuid-of-parent>", "level": 1, "name": "Capability Name", "description": "optional text", "insertAfterId": "<uuid-of-sibling-or-null>" }
   Level rules: L0 parentId must be null. L1 must go under L0. L2 under L1. L3 under L2.

7. SET_DESCRIPTION — update the description of an existing node
{ "type": "SET_DESCRIPTION", "nodeId": "<uuid>", "description": "New description text" }

8. RESET_STYLE — remove a node's colour override and restore the level default colour
{ "type": "RESET_STYLE", "nodeId": "<uuid>" }
   Also supports partial reset:
   { "type": "RESET_STYLE", "nodeId": "<uuid>", "fill": true }   ← clears only background
   { "type": "RESET_STYLE", "nodeId": "<uuid>", "border": true } ← clears only border
   Use this when the user says "remove color", "reset color", "clear color", "restore default", "remove background", "clear fill", "remove border color".
   NEVER use SET_STYLE with "#ffffff" or "transparent" to simulate a reset — always use RESET_STYLE.

9. SET_LEGEND — create or update a colour-legend category in the sidebar
{ "type": "SET_LEGEND", "slot": "fill"|"border", "entryId": "<short-slug>", "label": "<human label>", "color": "#rrggbb" }
   Use "fill" slot for background colours, "border" slot for border colours.
   entryId must be a short lowercase slug (e.g. "we-have", "not-there", "in-progress").
   If an entry with the same entryId already exists it will be updated; otherwise a new entry is created.

10. REMOVE_LEGEND — delete a colour-legend category from the sidebar
{ "type": "REMOVE_LEGEND", "slot": "fill"|"border", "entryId": "<entry-id-to-remove>" }
   Use the entryId exactly as it appears in the Current Legend section below.
   Use this when the user says "remove", "delete", or "clear" a legend category.

## Legend rules — CRITICAL, FOLLOW EXACTLY

**RULE 1 — NEVER refuse a style or colour request.**
If the user asks to change a node's colour or border, ALWAYS emit SET_STYLE. Never say "cannot execute" or "no existing legend". The legend is optional metadata — absence of a legend entry must NEVER block a style change.

**RULE 2 — AUTO-CREATE the legend entry whenever you emit SET_STYLE with a semantic meaning.**
Whenever the user's message implies a label/meaning for a colour (e.g. "Atlassian tool", "dark blue border", "we have this"), ALWAYS emit SET_LEGEND in the same response. You do not need the user to explicitly ask for it.
- If the entryId already exists in Current Legend → UPDATE it (same entryId, new label/color as needed).
- If it does NOT exist → CREATE it (new entryId slug derived from the user's label).

**RULE 3 — NEVER require a legend entry to exist before applying a style.**
The flow is always: SET_STYLE first (apply the change), SET_LEGEND second (record the meaning). Both happen in the same response.

**RULE 4 — Derive the entryId slug from the user's label.**
Examples: "Atlassian tool" → "atlassian-tool", "dark blue border" → "dark-blue-border", "In progress" → "in-progress".

**RULE 5 — The user's stated colour ALWAYS wins.**
Never copy the colour from an existing legend entry. Use whatever colour the user specified in their message for both SET_STYLE and SET_LEGEND.

### Operation guide:
- **CREATE** (no matching entryId in Current Legend): emit SET_LEGEND with new slug entryId.
- **MODIFY** (user says "rename", "change colour of", "update"): emit SET_LEGEND with the SAME entryId, only changing what was asked.
- **DELETE** (user says "remove", "delete", "clear"): emit REMOVE_LEGEND with the matching slot + entryId.

### Natural-language → legend label mappings (use these when the phrase matches):
- "we have", "i have", "client has", "already have", "have this"  → label "Already available", slot "fill", entryId "already-available"
- "we don't have", "not there", "we lack", "missing", "don't have" → label "Not available", slot "fill", entryId "not-available"
- "out of the box", "ootb", "standard"                             → label "Out of the box", slot "fill", entryId "out-of-the-box"
- "in progress", "being built", "wip"                              → label "In progress", slot "border", entryId "in-progress"
- "blocked", "on hold", "paused"                                   → label "Blocked", slot "border", entryId "blocked"
- "done for client", "already delivered"                           → label "Done for client", slot "border", entryId "done-for-client"
- "maybe", "possible", "considering"                               → label "Maybe", slot "fill", entryId "maybe"
- For any other label the user provides, derive the entryId slug from it (lowercase, hyphens).

${legendSection}

## Rules
- Use hex colour codes (e.g. "#ff0000") for colours. Never use CSS colour names.
- Omit commands that are not needed.
- Never invent node IDs. Use ONLY the IDs listed below.
- For ADD_NODE, generate a valid UUID v4 string for tempId (format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
- Only return an empty commands array if the user's request is truly impossible (e.g. asks to move a node to an invalid level). NEVER return empty just because a legend entry does not exist yet — create it.
- Each node in the diagram below has a hierarchical number (e.g. "1.7.5.1"). When the user refers to a node by its number, look it up in the diagram to find the matching node name and id.

## Current Diagram
${tree}`;
}

// Distinct palette the AI can pick from when creating new legend entries.
// Covers a wide hue range so successive categories look visually different.
const PALETTE = [
  "#22c55e", // green
  "#f97316", // orange
  "#3b82f6", // blue
  "#ec4899", // pink
  "#a855f7", // purple
  "#14b8a6", // teal
  "#eab308", // yellow
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#84cc16", // lime
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#0ea5e9", // sky
];

function buildLegendSection(legend?: LegendConfig): string {
  const allUsed = new Set<string>();
  const lines: string[] = ["## Current Legend"];

  if (!legend || (legend.fill.length === 0 && legend.border.length === 0)) {
    lines.push("(empty — no categories defined yet)");
  } else {
    if (legend.fill.length > 0) {
      lines.push("Background (fill) categories:");
      legend.fill.forEach((e) => {
        lines.push(`  - entryId "${e.id}" | label "${e.label}" | color ${e.color}`);
        allUsed.add(e.color.toLowerCase());
      });
    }
    if (legend.border.length > 0) {
      lines.push("Border categories:");
      legend.border.forEach((e) => {
        lines.push(`  - entryId "${e.id}" | label "${e.label}" | color ${e.color}`);
        allUsed.add(e.color.toLowerCase());
      });
    }
  }

  // Suggest colors not already in use
  const available = PALETTE.filter((c) => !allUsed.has(c.toLowerCase()));
  if (available.length > 0) {
    lines.push("");
    lines.push("## Recommended colors for new categories (not yet used in legend)");
    lines.push(available.slice(0, 8).join("  "));
    lines.push("IMPORTANT: When creating a new legend entry WITHOUT a user-specified colour,");
    lines.push("you MUST pick from the recommended list above — never reuse a colour already in the legend.");
    lines.push("If the user specifies a colour explicitly, use that colour regardless of this list.");
  }

  return lines.join("\n");
}

/**
 * Builds the system prompt for SUGGESTION mode.
 * The AI returns proposals (description + command) that the user can Accept or Decline.
 */
export function buildSuggestionPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch> = {},
  allCapabilities?: Capability[]
): string {
  const tree = renderTree(capabilities, nodeStyles, allCapabilities);

  return `You are an AI assistant reviewing a capability map diagram. The user wants suggestions — do NOT apply changes directly. Instead, return a list of proposals that the user can review and selectively accept or decline.

## Response Format
Reply with ONLY a JSON object in this exact shape:
{
  "proposals": [
    {
      "id": "p1",
      "description": "Clear explanation of what this suggestion does and why it is beneficial",
      "command": { ...single command object... }
    }
  ],
  "summary": "one sentence summarising your suggestions"
}

Each proposal must contain exactly one command.

### Command types

1. SET_STYLE — change background fill and/or border colour
{ "type": "SET_STYLE", "nodeId": "<uuid>", "fill": "#rrggbb", "border": "#rrggbb" }

2. SET_NOTE — add or replace a text note
{ "type": "SET_NOTE", "nodeId": "<uuid>", "note": "text" }

3. RENAME_NODE — rename a capability
{ "type": "RENAME_NODE", "nodeId": "<uuid>", "newName": "new name" }

4. REPARENT_NODE — move a node under a different parent
{ "type": "REPARENT_NODE", "nodeId": "<uuid>", "newParentId": "<uuid>" }
   STRICT level rules: the new parent must be EXACTLY one level above the node.
   L1 → must go under an L0. L2 → must go under an L1. L3 → must go under an L2.
   NEVER place a node under a node at the same or lower level.
   If the user asks for a move that violates this, return an empty commands array and explain in "summary".

5. DELETE_NODE — permanently delete a node and all its descendants
{ "type": "DELETE_NODE", "nodeId": "<uuid>" }

6. ADD_NODE — add a new capability node
{ "type": "ADD_NODE", "tempId": "<new-uuid-v4>", "parentId": "<uuid-or-null>", "level": 1, "name": "Capability Name", "description": "optional text" }

7. SET_DESCRIPTION — update the description of an existing node
{ "type": "SET_DESCRIPTION", "nodeId": "<uuid>", "description": "text" }

## Rules
- Return at most 10 proposals.
- Each proposal "description" must be ONE short sentence (max 12 words): just state the action, e.g. "Rename 'Ops' to 'Operations Management'" or "Move 'Billing' under 'Finance'".
- The "summary" must be ONE short sentence (max 12 words) stating how many suggestions you have, e.g. "3 naming suggestions for clearer node labels".
- Do NOT add explanations, rationale, or 'This provides...' / 'for better clarity' language.
- Use hex colour codes (e.g. "#ff0000"). Never use CSS colour names.
- Never invent node IDs. Use ONLY the IDs listed below.
- If no suggestions apply, return an empty proposals array and explain in "summary".
- Each node in the diagram below has a hierarchical number (e.g. "1.7.5.1"). When the user refers to a node by number, look it up in the diagram to find the matching node name and id.

## Current Diagram
${tree}`;
}

/**
 * Builds the system prompt for CHAT/INFO mode.
 * The AI answers conversational questions about the map in plain text — no JSON, no commands.
 */
export function buildChatPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch> = {},
  allCapabilities?: Capability[]
): string {
  const tree = renderTree(capabilities, nodeStyles, allCapabilities);

  return `You are an AI assistant for a capability map diagram. Answer the user's question in plain text using the diagram data below.

Rules:
- Answer concisely and directly. Use bullet points or numbered lists when listing nodes.
- Do NOT output JSON or commands.
- When listing nodes, show their hierarchical number and name, e.g. "1.7: Strategy & OKR Management".
- Each node has a hierarchical number (e.g. "1.7.5.1") shown before its name in the diagram. Use these numbers when the user refers to a node by number.
- Refer only to nodes that exist in the diagram below.

## Current Diagram
${tree}`;
}

/**
 * Computes the canonical hierarchical number for a capability (e.g. "1.7.5.1")
 * using the FULL capability list so positions match what the canvas displays.
 */
function getNumber(capId: string, allCaps: Capability[]): string {
  const byId = new Map(allCaps.map((c) => [c.id, c]));
  const path: number[] = [];
  let current = byId.get(capId);
  while (current) {
    const parentId = current.parent_id ?? null;
    const siblings = allCaps.filter((c) => (c.parent_id ?? null) === parentId);
    siblings.sort((a, b) => a.sort_order - b.sort_order);
    path.unshift(siblings.findIndex((c) => c.id === current!.id) + 1);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path.join(".");
}

/**
 * Renders the capability tree as an indented text list with IDs and current styles.
 * allCapabilities is the FULL unfiltered list — used to compute canonical node numbers
 * that match the canvas display. If omitted, numbers are computed from capabilities itself.
 */
function renderTree(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch>,
  allCapabilities?: Capability[]
): string {
  const fullList = allCapabilities ?? capabilities;

  const byParent = new Map<string | null, Capability[]>();
  for (const cap of capabilities) {
    const key = cap.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cap);
  }
  // Sort each group by sort_order
  Array.from(byParent.values()).forEach((children: Capability[]) => {
    children.sort((a: Capability, b: Capability) => a.sort_order - b.sort_order);
  });

  const lines: string[] = [];

  function walk(parentId: string | null, indent: number) {
    const children = byParent.get(parentId) ?? [];
    for (const cap of children) {
      const nodeNumber = getNumber(cap.id, fullList);
      const prefix = "  ".repeat(indent);
      const style = nodeStyles[cap.id];
      const styleNote = style
        ? ` [fill:${style.fill ?? "default"} border:${style.border ?? "default"}${style.note ? ` note:"${style.note}"` : ""}]`
        : "";
      const descNote = cap.description ? ` desc:"${cap.description}"` : "";
      lines.push(`${prefix}L${cap.level} | ${nodeNumber} | ${cap.name} | id:${cap.id}${styleNote}${descNote}`);
      walk(cap.id, indent + 1);
    }
  }

  walk(null, 0);
  return lines.join("\n") || "(empty diagram)";
}
