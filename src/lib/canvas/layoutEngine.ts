import type { Node } from "reactflow";
import type { Capability } from "@/types/capability";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";
import type { DropContainerNodeData } from "@/components/canvas/DropContainerNode";

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
const CONTAINER_PAD = 20;   // visible padding on each side of content inside L2/L3 containers (10px per side)
const L1_EXTRA = 10;        // extra inset the L1 gray container adds beyond L2 containers on all 4 sides
const L1_COL_GAP = 16;     // visible gap between adjacent L1 containers
// SUB_COL_GAP = CONTAINER_PAD + 2*L1_EXTRA + L1_COL_GAP so adjacent L1 container edges are L1_COL_GAP apart
const SUB_COL_GAP = CONTAINER_PAD + 2 * L1_EXTRA + L1_COL_GAP; // = 56
const L0_H = 42;        // L0 header height (always single line)
const V_GAP = 6;        // gap between L1/L2 nodes
const L3_V_GAP = 2;    // tighter gap between L3 nodes inside the L2 container
// L2_GAP must equal CONTAINER_PAD so consecutive L2 container edges touch exactly (zero gap)
const L2_GAP = CONTAINER_PAD; // = 20 → L2 panels touch with no visible gap
const L0_GAP = 12;      // horizontal gap between L0 groups
const L0_PAD = 6;       // internal padding of L0 header
const MIN_CONTAINER_H = 32;

// Estimate rendered height from label text.
// SUB_COL_W=145, padding=8px each side → usable=129px.
// At 10px font, ~1 char ≈ 5.8px → ~22 chars/line for L1/L2.
// L3 nodes are narrower (SUB_COL_W - 2*L3_INSET = 121px) → ~20 chars/line at 9.5px font.
function nodeH(level: number, label = ""): number {
  if (level === 0) return L0_H;
  const charsPerLine = level === 3 ? 20 : 22;
  const words = label.split(" ");
  let lines = 1;
  let lineLen = 0;
  for (const w of words) {
    if (lineLen > 0 && lineLen + 1 + w.length > charsPerLine) { lines++; lineLen = w.length; }
    else { lineLen += (lineLen > 0 ? 1 : 0) + w.length; }
  }
  const fontSize = level === 3 ? 9.5 : 10;
  const numH = 10; // number badge
  const padV = 8;  // top + bottom padding in node (generous to match screenshot)
  return Math.ceil(numH + lines * fontSize * 1.25 + padV);
}

interface TreeNode {
  cap: Capability;
  children: TreeNode[];
  number: string;
}

export function buildCanvasNodes(
  capabilities: Capability[],
  visibleLevels: Set<number>
): Node<CapabilityNodeData | DropContainerNodeData>[] {
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

  // Pre-compute ONE uniform height per level across the entire diagram.
  // Every L1 node gets the same height, every L2 the same, every L3 the same —
  // driven by whichever label is longest at each level.
  const globalMaxH: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const cap of sorted) {
    if (cap.level === 0 || cap.level > 3) continue;
    const h = nodeH(cap.level, cap.name);
    if (h > globalMaxH[cap.level]) globalMaxH[cap.level] = h;
  }
  const capH = (cap: Capability): number =>
    cap.level === 0 ? L0_H : (globalMaxH[cap.level] ?? nodeH(cap.level, cap.name));

  const nodes: Node<CapabilityNodeData | DropContainerNodeData>[] = [];
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

      // L1 capability node
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
          nodeHeight: capH(l1.cap),
        },
      });
      cursorY += capH(l1.cap) + V_GAP;

      // Track where the L2 panel area starts (for the per-L1 gray container)
      const l1ColStartY = cursorY;

      const l2Children = l1.children.filter((c) => visibleLevels.has(c.cap.level));

      // If no L2 children, show a minimal placeholder drop zone for the L1 sub-column
      if (l2Children.length === 0) {
        nodes.push({
          id: `drop-l2-empty-${l1.cap.id}`,
          type: "dropContainer",
          position: { x: subX - CONTAINER_PAD / 2, y: cursorY - CONTAINER_PAD / 2 },
          draggable: false,
          selectable: false,
          connectable: false,
          zIndex: -1,
          data: {
            label: "Drop as L2",
            dropLevel: 2,
            targetNodeId: l1.cap.id,
            width: SUB_COL_W + CONTAINER_PAD,
            height: MIN_CONTAINER_H,
          },
        });
        cursorY += MIN_CONTAINER_H;
      }

      // One container per L2 node — L2 capability node sits ABOVE its container
      // (mirrors how L1 node sits above the L1 container), container wraps only L3 children.
      for (let li = 0; li < l2Children.length; li++) {
        const l2 = l2Children[li];

        // Gap between bottom of previous L2 container and top of this L2 node
        if (li > 0) cursorY += L2_GAP;

        // L2 capability node — sits ABOVE its light-blue container (not inside it)
        const l2Parent = l2.cap.parent_id ? byId.get(l2.cap.parent_id) : null;
        nodes.push({
          id: l2.cap.id,
          type: "capability",
          position: { x: subX, y: cursorY },
          data: {
            label: l2.cap.name,
            level: 2,
            parentName: l2Parent?.name ?? null,
            description: l2.cap.description,
            number: l2.number,
            nodeHeight: capH(l2.cap),
          },
        });
        cursorY += capH(l2.cap) + V_GAP;

        // L2 container + L3 nodes — only rendered when L3 level is visible
        const l3Children = l2.children.filter((c) => visibleLevels.has(c.cap.level));
        if (l3Children.length > 0) {
          // Container starts here, after the L2 node
          const l2ContainerTop = cursorY;

          for (const l3 of l3Children) {
            const l3Parent = l3.cap.parent_id ? byId.get(l3.cap.parent_id) : null;
            nodes.push({
              id: l3.cap.id,
              type: "capability",
              position: { x: subX, y: cursorY },
              data: {
                label: l3.cap.name,
                level: 3,
                parentName: l3Parent?.name ?? null,
                description: l3.cap.description,
                number: l3.number,
                nodeHeight: capH(l3.cap),
              },
            });
            cursorY += capH(l3.cap) + L3_V_GAP;
          }

          // L2 light-blue container — only when there are visible L3 nodes
          const l2ContainerH = cursorY - l2ContainerTop;
          nodes.push({
            id: `drop-l2-${l2.cap.id}`,
            type: "dropContainer",
            position: { x: subX - CONTAINER_PAD / 2, y: l2ContainerTop - CONTAINER_PAD / 2 },
            draggable: false,
            selectable: false,
            connectable: false,
            zIndex: -1,
            data: {
              label: "Drop as L2",
              dropLevel: 2,
              targetNodeId: l2.cap.id,
              width: SUB_COL_W + CONTAINER_PAD,
              height: Math.max(l2ContainerH + CONTAINER_PAD, MIN_CONTAINER_H),
            },
          });
        }
      }

      // Per-L1-sub-column gray container — wraps ALL L2 panels for this L1.
      // Pushed last so its height is known. Uses dropLevel=1 for gray color;
      // actual drop level is always taken from the dragged node's own level.
      // Expanded by L1_EXTRA on all 4 sides beyond the L2 containers so the gray background
      // is visible as a border around all the dark-blue L2 panels.
      const l1ColH = cursorY - l1ColStartY;
      nodes.push({
        id: `drop-l1col-${l1.cap.id}`,
        type: "dropContainer",
        position: {
          x: subX - CONTAINER_PAD / 2 - L1_EXTRA,
          y: l1ColStartY - CONTAINER_PAD / 2 - L1_EXTRA,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -2, // deepest background layer
        data: {
          label: "L1 column",
          dropLevel: 1,
          targetNodeId: l1.cap.id,
          width: SUB_COL_W + CONTAINER_PAD + 2 * L1_EXTRA,
          height: Math.max(l1ColH + CONTAINER_PAD + 2 * L1_EXTRA, MIN_CONTAINER_H),
        },
      });

      subX += SUB_COL_W + SUB_COL_GAP;
    }

    globalX += l0Width + L0_GAP;
  }

  return nodes;
}
