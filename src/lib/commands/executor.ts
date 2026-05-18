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

      case "RESET_STYLE": {
        const cap = current.find((c) => c.id === cmd.nodeId);
        if (!cap) {
          errors.push(`RESET_STYLE: node "${cmd.nodeId}" not found`);
          break;
        }
        const resetFill = cmd.fill !== false; // default true
        const resetBorder = cmd.border !== false; // default true
        const existing = { ...(nodePatches[cmd.nodeId] ?? {}) };
        if (resetFill) delete existing.fill;
        if (resetBorder) delete existing.border;
        nodePatches[cmd.nodeId] = existing;
        messages.push(`Style reset on "${cap.name}"`);
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

      case "ADD_NODE": {
        // Validate parent exists when specified
        if (cmd.parentId !== null) {
          const parent = current.find((c) => c.id === cmd.parentId);
          if (!parent) {
            errors.push(`ADD_NODE: parent "${cmd.parentId}" not found`);
            break;
          }
          if (parent.level !== cmd.level - 1) {
            errors.push(
              `ADD_NODE: level mismatch — L${cmd.level} node cannot be placed under L${parent.level} parent`
            );
            break;
          }
        }

        // Derive catalog_id from a sibling or any existing capability
        const catalogId =
          current.find((c) => c.parent_id === cmd.parentId)?.catalog_id ??
          current[0]?.catalog_id ??
          "";

        // Compute sort_order
        const siblings = current.filter((c) => c.parent_id === cmd.parentId);
        let newSortOrder: number;
        if (cmd.insertAfterId) {
          const afterSibling = siblings.find((s) => s.id === cmd.insertAfterId);
          newSortOrder = afterSibling ? afterSibling.sort_order + 1 : siblings.length;
          // Shift subsequent siblings up
          current = current.map((c) =>
            c.parent_id === cmd.parentId && c.sort_order >= newSortOrder && c.id !== cmd.tempId
              ? { ...c, sort_order: c.sort_order + 1 }
              : c
          );
        } else {
          newSortOrder =
            siblings.length > 0 ? Math.max(...siblings.map((s) => s.sort_order)) + 1 : 0;
        }

        const now = new Date().toISOString();
        current = [
          ...current,
          {
            id: cmd.tempId,
            catalog_id: catalogId,
            parent_id: cmd.parentId,
            level: cmd.level,
            name: cmd.name,
            description: cmd.description ?? null,
            note: null,
            sort_order: newSortOrder,
            source: "ai_generated",
            is_deleted: false,
            created_at: now,
            updated_at: now,
          },
        ];
        messages.push(`Added "${cmd.name}"`);
        break;
      }

      case "SET_DESCRIPTION": {
        const cap = current.find((c) => c.id === cmd.nodeId);
        if (!cap) {
          errors.push(`SET_DESCRIPTION: node "${cmd.nodeId}" not found`);
          break;
        }
        current = current.map((c) =>
          c.id === cmd.nodeId ? { ...c, description: cmd.description } : c
        );
        nodePatches[cmd.nodeId] = {
          ...(nodePatches[cmd.nodeId] ?? {}),
          description: cmd.description,
        };
        messages.push(`Description updated on "${cap.name}"`);
        break;
      }

      case "SET_LEGEND":
      case "REMOVE_LEGEND":
        // Handled by the dashboard before executeCommands is called — skip silently.
        break;

      default:
        errors.push(`Unknown command type: ${(cmd as DiagramCommand).type}`);
    }
  }

  return { capabilities: current, nodePatches, messages, errors };
}
