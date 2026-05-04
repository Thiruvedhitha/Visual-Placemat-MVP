import type { Capability } from "@/types/capability";
import type { Node } from "reactflow";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";

// ─── Command type definitions ─────────────────────────────────────────────────

/**
 * Style commands — update React Flow node visuals only.
 * These do NOT affect the capability tree structure.
 * Applied immediately (no ghost preview).
 */
export type StyleCommand =
  | { type: "SET_FILL";   nodeId: string; value: string }
  | { type: "SET_BORDER"; nodeId: string; value: string }
  | { type: "SET_NOTE";   nodeId: string; value: string };

/**
 * Structural commands — update the capability tree.
 * Applied immediately to Zustand store + canvas rebuild.
 */
export type StructuralCommand =
  | { type: "REPARENT"; nodeId: string; newParentId: string }
  | { type: "RENAME";   nodeId: string; name: string }
  | { type: "ADD";      parentId: string; level: 0 | 1 | 2 | 3; name: string; tempId: string }
  | { type: "REMOVE";   nodeId: string };

export type NodeCommand = StyleCommand | StructuralCommand;

// ─── Apply style commands to React Flow nodes ─────────────────────────────────

export function applyStyleCommands(
  commands: StyleCommand[],
  nodes: Node<CapabilityNodeData>[]
): Node<CapabilityNodeData>[] {
  if (!commands.length) return nodes;
  return nodes.map((node) => {
    const mine = commands.filter((c) => c.nodeId === node.id);
    if (!mine.length) return node;
    const data = { ...node.data };
    for (const cmd of mine) {
      if (cmd.type === "SET_FILL")   data.fill   = cmd.value;
      if (cmd.type === "SET_BORDER") data.border = cmd.value;
      if (cmd.type === "SET_NOTE")   data.note   = cmd.value;
    }
    return { ...node, data };
  });
}

// ─── Apply structural commands to capabilities ────────────────────────────────

export function applyStructuralCommands(
  commands: StructuralCommand[],
  capabilities: Capability[],
  catalogId: string
): Capability[] {
  let caps = [...capabilities];
  const now = new Date().toISOString();

  for (const cmd of commands) {
    switch (cmd.type) {
      case "REPARENT":
        caps = caps.map((c) =>
          c.id === cmd.nodeId ? { ...c, parent_id: cmd.newParentId, updated_at: now } : c
        );
        break;

      case "RENAME":
        caps = caps.map((c) =>
          c.id === cmd.nodeId ? { ...c, name: cmd.name, updated_at: now } : c
        );
        break;

      case "ADD": {
        caps = [
          ...caps,
          {
            id: cmd.tempId,
            catalog_id: catalogId,
            parent_id: cmd.parentId,
            level: cmd.level,
            name: cmd.name,
            description: null,
            sort_order: caps.filter((c) => c.parent_id === cmd.parentId).length,
            source: "ai",
            is_deleted: false,
            created_at: now,
            updated_at: now,
          } as Capability,
        ];
        break;
      }

      case "REMOVE": {
        const toDelete = new Set<string>();
        const queue = [cmd.nodeId];
        while (queue.length) {
          const id = queue.shift()!;
          toDelete.add(id);
          caps.forEach((c) => { if (c.parent_id === id) queue.push(c.id); });
        }
        caps = caps.filter((c) => !toDelete.has(c.id));
        break;
      }
    }
  }
  return caps;
}

// ─── AI system prompt fragment ────────────────────────────────────────────────
/**
 * Include this in your Claude system prompt to teach the LLM which commands
 * are available. The LLM returns a JSON object: { commands: NodeCommand[] }
 */
export const COMMAND_SYSTEM_PROMPT = `
You can edit the capability map by returning a JSON object with a "commands" array.

Available commands (use exact type strings):

  { "type": "SET_FILL",   "nodeId": "<id>",         "value": "#hexcolor"       }
  { "type": "SET_BORDER", "nodeId": "<id>",         "value": "#hexcolor"       }
  { "type": "SET_NOTE",   "nodeId": "<id>",         "value": "note text"       }
  { "type": "REPARENT",   "nodeId": "<id>",         "newParentId": "<id>"      }
  { "type": "RENAME",     "nodeId": "<id>",         "name": "new name"         }
  { "type": "ADD",        "parentId": "<id>",       "level": <0|1|2|3>,
                          "name": "new name",        "tempId": "temp-<unique>"  }
  { "type": "REMOVE",     "nodeId": "<id>"                                      }

Rules:
- nodeId / parentId must be IDs taken from the node list provided in context.
- ADD level must equal parent.level + 1.
- REPARENT newParentId must have level = movedNode.level - 1.
- Colors must be valid CSS hex strings, e.g. "#3b82f6".
- REMOVE deletes the node AND all its descendants.
- SET_FILL / SET_BORDER / SET_NOTE are visual only; they do not restructure the tree.
- Generate tempId as "temp-" followed by a short random string for ADD commands.
`.trim();
