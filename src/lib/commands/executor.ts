import type { Capability } from "@/types/capability";
import type { DiagramCommand, NodeStylePatch } from "./index";
import { handleNodeDragDrop } from "@/lib/canvas/dragDropHandler";

export interface ExecutionResult {
  /** Updated capability tree (structural changes: rename, reparent) */
  capabilities: Capability[];
  /** Visual patches to merge into ReactFlow node.data (style/note changes) */
  nodePatches: Record<string, NodeStylePatch>;
  /** One message per applied command */
  messages: string[];
  /** IDs of commands that failed validation */
  errors: string[];
}

/**
 * Applies an array of DiagramCommands to the current capability tree and
 * returns the updated tree + node style patches.
 *
 * Structural commands (RENAME_NODE, REPARENT_NODE) mutate `capabilities`.
 * Visual commands (SET_STYLE, SET_NOTE) populate `nodePatches` which the
 * dashboard merges into ReactFlow node.data.
 */
export function executeCommands(
  commands: DiagramCommand[],
  capabilities: Capability[],
  existingPatches: Record<string, NodeStylePatch> = {}
): ExecutionResult {
  let current = [...capabilities];
  const nodePatches: Record<string, NodeStylePatch> = { ...existingPatches };
  const messages: string[] = [];
  const errors: string[] = [];

  for (const cmd of commands) {
    switch (cmd.type) {
      case "SET_STYLE": {
        const cap = current.find((c) => c.id === cmd.nodeId);
        if (!cap) {
          errors.push(`SET_STYLE: node "${cmd.nodeId}" not found`);
          break;
        }
        nodePatches[cmd.nodeId] = {
          ...(nodePatches[cmd.nodeId] ?? {}),
          ...(cmd.fill !== undefined ? { fill: cmd.fill } : {}),
          ...(cmd.border !== undefined ? { border: cmd.border } : {}),
        };
        messages.push(`Style updated on "${cap.name}"`);
        break;
      }

      case "SET_NOTE": {
        const cap = current.find((c) => c.id === cmd.nodeId);
        if (!cap) {
          errors.push(`SET_NOTE: node "${cmd.nodeId}" not found`);
          break;
        }
        nodePatches[cmd.nodeId] = {
          ...(nodePatches[cmd.nodeId] ?? {}),
          note: cmd.note,
        };
        messages.push(`Note set on "${cap.name}"`);
        break;
      }

      case "RENAME_NODE": {
        const idx = current.findIndex((c) => c.id === cmd.nodeId);
        if (idx === -1) {
          errors.push(`RENAME_NODE: node "${cmd.nodeId}" not found`);
          break;
        }
        const oldName = current[idx].name;
        current = current.map((c) =>
          c.id === cmd.nodeId ? { ...c, name: cmd.newName } : c
        );
        messages.push(`Renamed "${oldName}" → "${cmd.newName}"`);
        break;
      }

      case "REPARENT_NODE": {
        const node = current.find((c) => c.id === cmd.nodeId);
        const newParent = current.find((c) => c.id === cmd.newParentId);
        if (!node) {
          errors.push(`REPARENT_NODE: node "${cmd.nodeId}" not found`);
          break;
        }
        if (!newParent) {
          errors.push(`REPARENT_NODE: parent "${cmd.newParentId}" not found`);
          break;
        }
        // Enforce level hierarchy: parent must be exactly one level above
        if (newParent.level !== node.level - 1) {
          errors.push(
            `REPARENT_NODE: level mismatch — L${node.level} node cannot be placed under L${newParent.level} parent`
          );
          break;
        }
        const result = handleNodeDragDrop(
          cmd.nodeId,
          cmd.newParentId,
          null, // append to end of new parent's children
          current
        );
        if (result.message.includes("Cannot")) {
          errors.push(`REPARENT_NODE: ${result.message}`);
        } else {
          current = result.updatedCapabilities;
          messages.push(`Moved "${node.name}" under "${newParent.name}"`);
        }
        break;
      }

      case "DELETE_NODE": {
        const target = current.find((c) => c.id === cmd.nodeId);
        if (!target) {
          errors.push(`DELETE_NODE: node "${cmd.nodeId}" not found`);
          break;
        }

        if (cmd.reparentChildren) {
          // Lift direct children up to the deleted node's parent
          current = current.map((c) =>
            c.parent_id === cmd.nodeId
              ? { ...c, parent_id: target.parent_id }
              : c
          );
          current = current.filter((c) => c.id !== cmd.nodeId);
          // Clean up any stale style patches
          delete nodePatches[cmd.nodeId];
          messages.push(`Deleted "${target.name}" (children re-parented)`);
        } else {
          // Cascade: collect the full subtree and remove all
          const toDelete = new Set<string>();
          const queue = [cmd.nodeId];
          while (queue.length > 0) {
            const id = queue.shift()!;
            toDelete.add(id);
            current
              .filter((c) => c.parent_id === id)
              .forEach((c) => queue.push(c.id));
          }
          toDelete.forEach((id) => delete nodePatches[id]);
          const deletedNames = current
            .filter((c) => toDelete.has(c.id))
            .map((c) => c.name);
          current = current.filter((c) => !toDelete.has(c.id));
          messages.push(
            `Deleted "${target.name}"` +
              (deletedNames.length > 1
                ? ` and ${deletedNames.length - 1} descendant(s)`
                : "")
          );
        }
        break;
      }

      default:
        errors.push(`Unknown command type: ${(cmd as DiagramCommand).type}`);
    }
  }

  return { capabilities: current, nodePatches, messages, errors };
}
