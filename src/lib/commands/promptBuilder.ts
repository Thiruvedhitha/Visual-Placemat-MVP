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

## Rules
- Use hex colour codes (e.g. "#ff0000") for colours. Never use CSS colour names.
- Omit commands that are not needed.
- Never invent node IDs. Use ONLY the IDs listed below.
- If the user's request cannot be fulfilled with the available commands, return an empty commands array and explain in "summary".

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
      lines.push(`${prefix}L${cap.level} | ${cap.name} | id:${cap.id}${styleNote}`);
      walk(cap.id, indent + 1);
    }
  }

  walk(null, 0);
  return lines.join("\n") || "(empty diagram)";
}
