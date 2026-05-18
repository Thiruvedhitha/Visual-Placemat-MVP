import type { Capability } from "@/types/capability";
import type { NodeStylePatch } from "./index";

/**
 * Builds the Anthropic system prompt that instructs the LLM what commands
 * it can emit and how the current diagram looks.
 */
export function buildCommandPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch> = {}
): string {
  const tree = renderTree(capabilities, nodeStyles);

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

4. REPARENT_NODE — move a node under a different parent (hierarchy rules apply: L1 must go under L0, L2 under L1, L3 under L2)
{ "type": "REPARENT_NODE", "nodeId": "<uuid>", "newParentId": "<uuid>" }

5. DELETE_NODE — permanently delete a node and all its descendants
{ "type": "DELETE_NODE", "nodeId": "<uuid>" }
   Optional: set "reparentChildren": true to lift the node's direct children up to its parent instead of deleting them too.
{ "type": "DELETE_NODE", "nodeId": "<uuid>", "reparentChildren": true }

6. ADD_NODE — add a new capability node
{ "type": "ADD_NODE", "tempId": "<new-uuid-v4>", "parentId": "<uuid-of-parent>", "level": 1, "name": "Capability Name", "description": "optional text", "insertAfterId": "<uuid-of-sibling-or-null>" }
   Level rules: L0 parentId must be null. L1 must go under L0. L2 under L1. L3 under L2.

7. SET_DESCRIPTION — update the description of an existing node
{ "type": "SET_DESCRIPTION", "nodeId": "<uuid>", "description": "New description text" }

## Rules
- Use hex colour codes (e.g. "#ff0000") for colours. Never use CSS colour names.
- Omit commands that are not needed.
- Never invent node IDs. Use ONLY the IDs listed below.
- For ADD_NODE, generate a valid UUID v4 string for tempId (format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
- If the user's request cannot be fulfilled with the available commands, return an empty commands array and explain in "summary".

## Current Diagram
${tree}`;
}

/**
 * Builds the system prompt for SUGGESTION mode.
 * The AI returns proposals (description + command) that the user can Accept or Decline.
 */
export function buildSuggestionPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch> = {}
): string {
  const tree = renderTree(capabilities, nodeStyles);

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

4. REPARENT_NODE — move a node under a different parent (hierarchy rules: L1 under L0, L2 under L1, L3 under L2)
{ "type": "REPARENT_NODE", "nodeId": "<uuid>", "newParentId": "<uuid>" }

5. DELETE_NODE — permanently delete a node and all its descendants
{ "type": "DELETE_NODE", "nodeId": "<uuid>" }

6. ADD_NODE — add a new capability node
{ "type": "ADD_NODE", "tempId": "<new-uuid-v4>", "parentId": "<uuid-or-null>", "level": 1, "name": "Capability Name", "description": "optional text" }

7. SET_DESCRIPTION — update the description of an existing node
{ "type": "SET_DESCRIPTION", "nodeId": "<uuid>", "description": "text" }

## Rules
- Return at most 10 proposals.
- If the user asks for "a name", "a suggestion", or anything phrased in the singular, return EXACTLY 1 proposal. Target the single most recently added or mentioned node. Never return multiple rename proposals for nodes sharing the same name.
- Each proposal "description" must be ONE short sentence (max 12 words): always include the node level prefix, e.g. "Rename L2 'Ops' to 'Operations Management'" or "Move L3 'Billing' under 'Finance'".
- The "summary" must be ONE short sentence (max 12 words) stating how many suggestions you have, e.g. "3 naming suggestions for clearer node labels".
- Do NOT add explanations, rationale, or 'This provides...' / 'for better clarity' language.
- Use hex colour codes (e.g. "#ff0000"). Never use CSS colour names.
- Never invent node IDs. Use ONLY the IDs listed below.
- If no suggestions apply, return an empty proposals array and explain in "summary".

## Current Diagram
${tree}`;
}

/**
 * Builds the system prompt for CHAT/INFO mode.
 * The AI answers conversational questions about the map in plain text — no JSON, no commands.
 */
export function buildChatPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch> = {}
): string {
  const tree = renderTree(capabilities, nodeStyles);

  return `You are an AI assistant for a capability map diagram. Answer the user's question in plain text using the diagram data below.

Rules:
- Answer concisely and directly. Use bullet points or numbered lists when listing nodes.
- Do NOT output JSON or commands.
- When listing nodes, show their level and name, e.g. "L1: Strategy & OKR Management".
- Refer only to nodes that exist in the diagram below.

## Current Diagram
${tree}`;
}

/**
 * Renders the capability tree as an indented text list with IDs and current styles.
 */
function renderTree(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch>
): string {
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
      const prefix = "  ".repeat(indent);
      const style = nodeStyles[cap.id];
      const styleNote = style
        ? ` [fill:${style.fill ?? "default"} border:${style.border ?? "default"}${style.note ? ` note:"${style.note}"` : ""}]`
        : "";
      const descNote = cap.description ? ` desc:"${cap.description}"` : "";
      lines.push(`${prefix}L${cap.level} | ${cap.name} | id:${cap.id}${styleNote}${descNote}`);
      walk(cap.id, indent + 1);
    }
  }

  walk(null, 0);
  return lines.join("\n") || "(empty diagram)";
}
