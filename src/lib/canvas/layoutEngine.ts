import type { Node } from "reactflow";
import type { Capability } from "@/types/capability";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";

/**
 * Visual Placemat layout:
 *
 * ┌──────────────────────────────────────────────┐
 * │       1  Strategic Portfolio Management       │
 * │ ┌──────────┐┌──────────┐┌──────────┐┌───┐ │
 * │ │ 1.1      ││ 1.2      ││ 1.3      ││... │ │
 * │ │ Demand   ││ Project  ││ Resource ││    │ │
 * │ │┌────────┐││┌────────┐││┌────────┐││    │ │
 * │ ││1.1.1    ││││1.2.1    ││││1.3.1    │││    │ │
 * │ ││Idea Coll││││Proj Cre ││││Res Plan │││    │ │
 * │ │├────────┤││├────────┤││├────────┤││    │ │
 * │ ││1.1.2    ││││1.2.2    ││││1.3.2    │││    │ │
 * │ │└────────┘││└────────┘││└────────┘││    │ │
 * │ └──────────┘└──────────┘└──────────┘└───┘ │
 * └──────────────────────────────────────────────┘
 */

// ---- Sizing constants ----
export const SUB_COL_W = 145; // L1 sub-column width
const SUB_COL_GAP = 6; // gap between L1 sub-columns
const L0_H = 48; // L0 header height
const L1_H = 48; // L1 node height (fits ~3 lines)
const L2_H = 48; // L2 node height
const L3_H = 42; // L3 node height
const V_GAP = 3; // uniform vertical gap between all nodes
const L2_GAP = 6; // extra gap before each L2 block
const L0_GAP = 16; // horizontal gap between L0 groups
const L0_PAD = 6; // internal padding of L0 header

function nodeH(level: number): number {
  if (level === 0) return L0_H;
  if (level === 1) return L1_H;
  if (level === 2) return L2_H;
  return L3_H;
}

interface TreeNode {
  cap: Capability;
  children: TreeNode[];
  number: string;
}

export function buildCanvasNodes(
  capabilities: Capability[],
  visibleLevels: Set<number>
): Node<CapabilityNodeData>[] {
  if (!capabilities.length) return [];

  const byId = new Map<string, Capability>();
  capabilities.forEach((c) => byId.set(c.id, c));

  // Build tree
  const nodeMap = new Map<string, TreeNode>();
  const sorted = [...capabilities].sort((a, b) => a.sort_order - b.sort_order);

  for (const cap of sorted) {
    nodeMap.set(cap.id, { cap, children: [], number: "" });
  }

  const roots: TreeNode[] = [];
  for (const cap of sorted) {
    if (cap.parent_id && nodeMap.has(cap.parent_id)) {
      nodeMap.get(cap.parent_id)!.children.push(nodeMap.get(cap.id)!);
    } else if (cap.level === 0) {
      roots.push(nodeMap.get(cap.id)!);
    }
  }
  if (roots.length === 0) {
    sorted.filter((c) => !c.parent_id).forEach((c) => roots.push(nodeMap.get(c.id)!));
  }

  // Assign hierarchical numbers
  roots.forEach((root, ri) => {
    root.number = String(ri + 1);
    const assign = (parent: TreeNode) => {
      parent.children.forEach((child, ci) => {
        child.number = `${parent.number}.${ci + 1}`;
        assign(child);
      });
    };
    assign(root);
  });

  const nodes: Node<CapabilityNodeData>[] = [];
  let globalX = 0;

  for (const root of roots) {
    if (!visibleLevels.has(root.cap.level)) continue;

    const l1Children = root.children.filter((c) => visibleLevels.has(c.cap.level));
    const numL1 = Math.max(l1Children.length, 1);
    const l0Width = numL1 * SUB_COL_W + (numL1 - 1) * SUB_COL_GAP + L0_PAD * 2;

    // --- L0 header ---
    nodes.push({
      id: root.cap.id,
      type: "capability",
      position: { x: globalX, y: 0 },
      data: {
        label: root.cap.name,
        level: root.cap.level,
        parentName: null,
        description: root.cap.description,
        number: root.number,
        colWidth: l0Width,
      },
    });

    // --- L1 sub-columns side by side ---
    let subX = globalX + L0_PAD;

    for (const l1 of l1Children) {
      let cursorY = L0_H + V_GAP;

      // L1 node
      const l1Parent = l1.cap.parent_id ? byId.get(l1.cap.parent_id) : null;
      nodes.push({
        id: l1.cap.id,
        type: "capability",
        position: { x: subX, y: cursorY },
        data: {
          label: l1.cap.name,
          level: l1.cap.level,
          parentName: l1Parent?.name ?? null,
          description: l1.cap.description,
          number: l1.number,
        },
      });
      cursorY += nodeH(l1.cap.level) + V_GAP;

      // L2/L3 stacked vertically under this L1
      const placeDescendants = (tn: TreeNode, isFirst: boolean) => {
        for (let i = 0; i < tn.children.length; i++) {
          const child = tn.children[i];
          if (!visibleLevels.has(child.cap.level)) {
            placeDescendants(child, i === 0);
            continue;
          }

          // Add group gap before L2 (except the very first one)
          if (child.cap.level === 2 && !isFirst) {
            cursorY += L2_GAP;
          }

          const parentCap = child.cap.parent_id ? byId.get(child.cap.parent_id) : null;

          nodes.push({
            id: child.cap.id,
            type: "capability",
            position: { x: subX, y: cursorY },
            data: {
              label: child.cap.name,
              level: child.cap.level,
              parentName: parentCap?.name ?? null,
              description: child.cap.description,
              number: child.number,
            },
          });
          cursorY += nodeH(child.cap.level) + V_GAP;

          placeDescendants(child, false);

          isFirst = false;
        }
      };

      placeDescendants(l1, true);
      subX += SUB_COL_W + SUB_COL_GAP;
    }

    globalX += l0Width + L0_GAP;
  }

  return nodes;
}
