import type { Node } from "reactflow";
import type { Capability } from "@/types/capability";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";

/**
 * LeanIX-style visual capability map layout:
 *
 * ┌──────── L0: Strategic Management ─────────────────────────┐  ┌──── L0: Customer ──────────┐
 * │ ┌─ L1 ──────┐ ┌─ L1 ──────┐ ┌─ L1 ──────────┐           │  │ ┌─ L1 ──────┐ ┌─ L1 ────┐ │
 * │ │ Strategy   │ │ Org Dev   │ │ Governance     │           │  │ │ CRM       │ │ Sales   │ │
 * │ │ Developmt  │ │           │ │                │           │  │ │           │ │         │ │
 * │ │  L2: Plan  │ │  L2: HR   │ │  L2: Comply    │           │  │ │  L2: Acq  │ │  L2: Pl │ │
 * │ │   · Item1  │ │   · Item1 │ │   · Item1      │           │  │ │   · Item1 │ │   · I1  │ │
 * │ │   · Item2  │ │   · Item2 │ │   · Item2      │           │  │ │   · Item2 │ │         │ │
 * │ └────────────┘ └───────────┘ └────────────────┘           │  │ └───────────┘ └─────────┘ │
 * └───────────────────────────────────────────────────────────┘  └─────────────────────────────┘
 *
 * L0 = horizontal spanning header (colored band)
 * L1 = vertical columns side-by-side under their L0 parent
 * L2 = bold section headers inside L1 columns
 * L3 = bullet items under L2 headers
 */

// ---- Layout constants ----
export const L1_COL_W   = 280;   // width of each L1 column
export const SUB_COL_W  = L1_COL_W; // backward compat alias
const L1_COL_GAP  = 16;   // gap between L1 columns
const L0_BAND_H   = 50;   // L0 horizontal header height
const L0_GROUP_GAP = 32;  // gap between L0 groups horizontally
const L1_TOP_GAP  = 8;    // gap between L0 band bottom and L1 columns top
const L1_HDR_H    = 48;   // L1 colored header height
const L1_PAD      = 10;   // padding inside L1 around L2 containers
const L2_HDR_BASE = 36;   // L2 header base height (1 line)
const L2_HDR_LINE = 18;   // additional height per extra text line
const L2_PAD      = 6;    // padding inside L2 around L3 nodes
const ROW_H       = 44;   // height per L3 row
const ROW_GAP     = 3;    // gap between rows
const L2_GROUP_GAP = 8;   // extra gap between L2 containers inside L1

// Per-L0 column colors
const L0_COLORS = [
  { bg: "#c0392b", text: "#fff" }, // red
  { bg: "#e67e22", text: "#fff" }, // orange
  { bg: "#8e44ad", text: "#fff" }, // purple
  { bg: "#27ae60", text: "#fff" }, // green
  { bg: "#2980b9", text: "#fff" }, // blue
  { bg: "#16a085", text: "#fff" }, // teal
  { bg: "#d35400", text: "#fff" }, // dark orange
  { bg: "#2c3e50", text: "#fff" }, // dark navy
  { bg: "#7f8c8d", text: "#fff" }, // grey
  { bg: "#f39c12", text: "#fff" }, // yellow
];

interface TreeNode {
  cap: Capability;
  children: TreeNode[];
  number: string;
}

/**
 * Estimate L2 header height based on text length.
 * Approximate chars per line based on inner width and font size.
 */
function estimateL2HdrH(l2Name: string, l2Number: string): number {
  const text = `${l2Number} ${l2Name}`;
  const charsPerLine = Math.floor((L1_COL_W - 2 * L1_PAD - 20) / 7); // ~7px per char at 12px font
  const lines = Math.ceil(text.length / charsPerLine);
  return L2_HDR_BASE + Math.max(0, lines - 1) * L2_HDR_LINE;
}

/**
 * Measure the height an L2 container needs based on its L3 children.
 */
function measureL2Height(l2: TreeNode, visibleLevels: Set<number>): number {
  const l3Children = l2.children.filter((c) => visibleLevels.has(c.cap.level));
  const hdrH = estimateL2HdrH(l2.cap.name, l2.number);
  let h = hdrH + L2_PAD;
  h += l3Children.length * (ROW_H + ROW_GAP);
  h += L2_PAD; // bottom padding
  if (l3Children.length === 0) h += 4;
  return Math.max(h, hdrH + 10);
}

/**
 * Measure the height an L1 column needs based on its L2/L3 children.
 * L2 is now a container with its own height.
 */
function measureL1Height(l1: TreeNode, visibleLevels: Set<number>): number {
  let h = L1_HDR_H + L1_PAD; // header + top padding
  const l2Children = l1.children.filter((c) => visibleLevels.has(c.cap.level));
  for (let i = 0; i < l2Children.length; i++) {
    if (i > 0) h += L2_GROUP_GAP;
    h += measureL2Height(l2Children[i], visibleLevels) + ROW_GAP;
  }
  h += L1_PAD; // bottom padding
  if (l2Children.length === 0) h += 8;
  return Math.max(h, 70);
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
  let groupX = 0;

  roots.forEach((root, rootIdx) => {
    const color = L0_COLORS[rootIdx % L0_COLORS.length];
    const l1Children = root.children.filter((c) => visibleLevels.has(c.cap.level));

    // Number of L1 columns in this group
    const numL1 = l1Children.length;
    const groupW = numL1 > 0
      ? numL1 * L1_COL_W + (numL1 - 1) * L1_COL_GAP
      : L1_COL_W;

    // Measure L1 heights
    const l1Heights = l1Children.map((l1) => measureL1Height(l1, visibleLevels));
    const maxL1H = l1Heights.length > 0 ? Math.max(...l1Heights) : 0;

    // ── L0: horizontal spanning header ──
    if (visibleLevels.has(0)) {
      nodes.push({
        id: root.cap.id,
        type: "capability",
        position: { x: groupX, y: 0 },
        data: {
          label: root.cap.name,
          level: 0,
          parentName: null,
          description: root.cap.description,
          note: root.cap.note,
          number: root.number,
          colWidth: groupW,
          nodeHeight: L0_BAND_H,
          l0Color: color.bg,
          l0TextColor: color.text,
        },
      });
    }

    // ── L1: vertical columns side-by-side ──
    const l1Y = visibleLevels.has(0) ? L0_BAND_H + L1_TOP_GAP : 0;

    l1Children.forEach((l1, l1Idx) => {
      const l1X = groupX + l1Idx * (L1_COL_W + L1_COL_GAP);
      const l1H = l1Heights[l1Idx];
      const l1Parent = l1.cap.parent_id ? byId.get(l1.cap.parent_id) : null;

      // L1 node — header + container background
      nodes.push({
        id: l1.cap.id,
        type: "capability",
        position: { x: l1X, y: l1Y },
        data: {
          label: l1.cap.name,
          level: 1,
          parentName: l1Parent?.name ?? null,
          description: l1.cap.description,
          note: l1.cap.note,
          number: l1.number,
          nodeWidth: L1_COL_W,
          nodeHeight: l1H,
          l0Color: color.bg,
        },
      });

      // L2 containers and L3 nodes inset inside the L1 column
      let cursorY = l1Y + L1_HDR_H + L1_PAD;
      const l2Children = l1.children.filter((c) => visibleLevels.has(c.cap.level));
      const innerW = L1_COL_W - 2 * L1_PAD;

      for (let l2i = 0; l2i < l2Children.length; l2i++) {
        const l2 = l2Children[l2i];
        if (l2i > 0) cursorY += L2_GROUP_GAP;
        const l2Parent = l2.cap.parent_id ? byId.get(l2.cap.parent_id) : null;
        const l2H = measureL2Height(l2, visibleLevels);

        // L2 container node
        nodes.push({
          id: l2.cap.id,
          type: "capability",
          position: { x: l1X + L1_PAD, y: cursorY },
          zIndex: 2,
          data: {
            label: l2.cap.name,
            level: 2,
            parentName: l2Parent?.name ?? null,
            description: l2.cap.description,
            note: l2.cap.note,
            number: l2.number,
            nodeWidth: innerW,
            nodeHeight: l2H,
            l0Color: color.bg,
          },
        });

        // L3 items nested inside L2 container
        const l3Children = l2.children.filter((c) => visibleLevels.has(c.cap.level));
        const l2HdrH = estimateL2HdrH(l2.cap.name, l2.number);
        let l3CursorY = cursorY + l2HdrH + L2_PAD;
        const l3InnerW = innerW - 2 * L2_PAD;

        for (const l3 of l3Children) {
          const l3Parent = l3.cap.parent_id ? byId.get(l3.cap.parent_id) : null;

          nodes.push({
            id: l3.cap.id,
            type: "capability",
            position: { x: l1X + L1_PAD + L2_PAD, y: l3CursorY },
            zIndex: 3,
            data: {
              label: l3.cap.name,
              level: 3,
              parentName: l3Parent?.name ?? null,
              description: l3.cap.description,
              note: l3.cap.note,
              number: l3.number,
              nodeWidth: l3InnerW,
              nodeHeight: ROW_H,
              l0Color: color.bg,
            },
          });
          l3CursorY += ROW_H + ROW_GAP;
        }

        cursorY += l2H + ROW_GAP;
      }
    });

    groupX += groupW + L0_GROUP_GAP;
  });

  return nodes;
}
