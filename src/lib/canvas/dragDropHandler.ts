import type { Capability } from "@/types/capability";

/**
 * Handles dragging a node and dropping it under a new parent.
 * Updates the tree structure and renumbers affected nodes.
 *
 * Example:
 * - Dragging 1.2.1 and dropping under 1.4 (between 1.4.4 and 1.4.5)
 * - Result: 1.2.1 becomes a child of 1.4 → renumbered as 1.4.5
 * - All descendants (1.2.1.1, 1.2.1.2) also move → renamed as 1.4.5.1, 1.4.5.2, etc.
 */

interface DragDropResult {
  updatedCapabilities: Capability[];
  message: string;
}

/**
 * Get all descendants of a node (including the node itself for subtree size)
 */
function getSubtree(
  nodeId: string,
  capabilities: Capability[]
): string[] {
  const subtree = [nodeId];
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = capabilities.filter((c) => c.parent_id === current);
    children.forEach((child) => {
      subtree.push(child.id);
      queue.push(child.id);
    });
  }

  return subtree;
}

/**
 * Calculate new sort_order for a node being inserted at a specific position
 */
function calculateNewSortOrder(
  newParentId: string | null,
  insertAfterNodeId: string | null,
  capabilities: Capability[]
): number {
  if (!newParentId) {
    // Root level (L0)
    const siblings = capabilities.filter((c) => !c.parent_id && c.level === 0);
    return siblings.length > 0 ? Math.max(...siblings.map((c) => c.sort_order)) + 1 : 0;
  }

  // Get siblings (same parent)
  const siblings = capabilities.filter((c) => c.parent_id === newParentId);

  if (!insertAfterNodeId) {
    // Insert at beginning
    return siblings.length > 0 ? Math.min(...siblings.map((c) => c.sort_order)) - 1 : 0;
  }

  // Insert after specific node
  const insertAfterNode = siblings.find((c) => c.id === insertAfterNodeId);
  if (!insertAfterNode) return siblings.length > 0 ? Math.max(...siblings.map((c) => c.sort_order)) + 1 : 0;

  // Insert between insertAfterNode and next sibling
  const nextSibling = siblings
    .filter((c) => c.sort_order > insertAfterNode.sort_order)
    .sort((a, b) => a.sort_order - b.sort_order)[0];

  if (!nextSibling) {
    return insertAfterNode.sort_order + 1;
  }

  // Average sort order (works even with large gaps)
  return (insertAfterNode.sort_order + nextSibling.sort_order) / 2;
}

/**
 * Validate if a drop is legal (no circular parent-child relationship)
 */
function isValidDrop(
  draggedNodeId: string,
  newParentId: string | null,
  capabilities: Capability[]
): { valid: boolean; reason?: string } {
  if (!newParentId) {
    // Dropping at root is always valid
    return { valid: true };
  }

  // Check if newParent is a descendant of draggedNode
  const subtree = getSubtree(draggedNodeId, capabilities);
  if (subtree.includes(newParentId)) {
    return { valid: false, reason: "Cannot move a node under its own descendant" };
  }

  return { valid: true };
}

/**
 * Main function: Handle drag-drop operation
 */
export function handleNodeDragDrop(
  draggedNodeId: string,
  newParentId: string | null,
  insertAfterNodeId: string | null,
  capabilities: Capability[]
): DragDropResult {
  // Validate
  const validation = isValidDrop(draggedNodeId, newParentId, capabilities);
  if (!validation.valid) {
    return {
      updatedCapabilities: capabilities,
      message: validation.reason || "Invalid drop target",
    };
  }

  const draggedNode = capabilities.find((c) => c.id === draggedNodeId);
  if (!draggedNode) {
    return {
      updatedCapabilities: capabilities,
      message: "Dragged node not found",
    };
  }

  // Get all nodes in the subtree being moved
  const subtreeIds = getSubtree(draggedNodeId, capabilities);

  // Determine new level
  let newLevel = draggedNode.level;
  if (newParentId) {
    const newParent = capabilities.find((c) => c.id === newParentId);
    if (newParent) {
      newLevel = Math.min(newParent.level + 1, 3) as 0 | 1 | 2 | 3;
    }
  } else {
    newLevel = 0;
  }

  // Calculate new sort order
  const newSortOrder = calculateNewSortOrder(newParentId, insertAfterNodeId, capabilities);

  // Build updated capabilities
  let updated = capabilities.map((cap) => {
    // The dragged node gets new parent and sort order
    if (cap.id === draggedNodeId) {
      return {
        ...cap,
        parent_id: newParentId,
        level: newLevel,
        sort_order: newSortOrder,
      };
    }

    // Children of dragged node: update their level (propagate down)
    if (subtreeIds.includes(cap.id) && cap.id !== draggedNodeId) {
      const draggedNodeLevel = draggedNode.level;
      const levelDiff = newLevel - draggedNodeLevel;
      return {
        ...cap,
        level: Math.min(Math.max(cap.level + levelDiff, 0), 3) as 0 | 1 | 2 | 3,
      };
    }

    return cap;
  });

  // Reorder siblings to fill gaps and maintain consistency
  updated = normalizeSortOrders(updated);

  const oldParentId = draggedNode.parent_id;
  const newParentName = newParentId
    ? capabilities.find((c) => c.id === newParentId)?.name || "unknown"
    : "root";
  const oldParentName = oldParentId
    ? capabilities.find((c) => c.id === oldParentId)?.name || "unknown"
    : "root";

  return {
    updatedCapabilities: updated,
    message: `Moved "${draggedNode.name}" from ${oldParentName} to ${newParentName} (and ${subtreeIds.length - 1} descendants)`,
  };
}

/**
 * Normalize sort_order values across the tree to avoid gaps and conflicts
 */
function normalizeSortOrders(capabilities: Capability[]): Capability[] {
  const byParent = new Map<string | null, Capability[]>();

  capabilities.forEach((cap) => {
    const parent = cap.parent_id;
    if (!byParent.has(parent)) {
      byParent.set(parent, []);
    }
    byParent.get(parent)!.push(cap);
  });

  const updated = [...capabilities];

  byParent.forEach((siblings) => {
    siblings.sort((a, b) => a.sort_order - b.sort_order);
    siblings.forEach((cap, index) => {
      const capInUpdated = updated.find((c) => c.id === cap.id);
      if (capInUpdated) {
        capInUpdated.sort_order = index;
      }
    });
  });

  return updated;
}

/**
 * Get hierarchical number for a capability (e.g., "1.2.3.4")
 */
export function getCapabilityNumber(capId: string, capabilities: Capability[]): string {
  const byId = new Map(capabilities.map((c) => [c.id, c]));
  const path: number[] = [];

  let current: Capability | undefined = byId.get(capId);
  while (current) {
    const parent: Capability | undefined = current.parent_id
      ? byId.get(current.parent_id)
      : undefined;
    const parentId = parent?.id ?? null;
    const siblings = capabilities.filter((c) => c.parent_id === parentId);
    siblings.sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((c) => c.id === current!.id) + 1;
    path.unshift(index);
    current = parent;
  }

  return path.join(".");
}
