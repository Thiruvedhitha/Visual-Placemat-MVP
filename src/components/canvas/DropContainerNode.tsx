"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";

export interface DropContainerNodeData {
  label: string;
  dropLevel: 1 | 2 | 3;
  targetNodeId: string;
  width: number;
  height: number;
  isActive?: boolean;
}

// Containers color mapping:
// L1 zone  → dark blue  (same as L1 capability node bg)
// L2 zone  → light blue (same as L2 capability node bg)
// L3 zone  → very light (L3 capability node bg)
const LEVEL_STYLE = {
  1: {
    innerBg: "#1545d8",      // dark blue — matches L1 node colour
    activeBg: "#1e55e8",
    activeGlow: "rgba(21,69,216,0.45)",
    activeLabel: "↓ Drop as L1",
    labelColor: "#ffffff",
  },
  2: {
    innerBg: "#599dff",      // light blue — matches L2 node colour
    activeBg: "#70aeff",
    activeGlow: "rgba(89,157,255,0.45)",
    activeLabel: "↓ Drop as L2",
    labelColor: "#ffffff",
  },
  3: {
    innerBg: "#eef5ff",      // very light — matches L3 node colour
    activeBg: "#d9e8ff",
    activeGlow: "rgba(89,157,255,0.35)",
    activeLabel: "↓ Drop as L3",
    labelColor: "#1a2a44",
  },
} as const;

function DropContainerNode({ id, data }: NodeProps<DropContainerNodeData>) {
  const s = LEVEL_STYLE[data.dropLevel];
  const bg = data.isActive ? s.activeBg : s.innerBg;

  return (
    <div
      data-drop-container-node-id={id}
      data-drop-target-id={data.targetNodeId}
      data-drop-target-level={String(data.dropLevel)}
      style={{
        width:  `${data.width}px`,
        height: `${data.height}px`,
        borderRadius: "10px",
        background: bg,
        position: "relative",
        // IMPORTANT: never steal pointer/drag events from capability nodes
        pointerEvents: "none",
        transition: "background 0.12s ease, box-shadow 0.14s ease",
        boxShadow: data.isActive ? `0 0 0 3px ${s.activeGlow}` : "none",
      }}
    >
      {data.isActive && (
        <div
          style={{
            position: "absolute",
            top: "5px",
            left: "10px",
            fontSize: "11px",
            fontWeight: 700,
            color: s.labelColor,
            letterSpacing: "0.04em",
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
            background: "rgba(0,0,0,0.25)",
            padding: "2px 9px",
            borderRadius: "20px",
          }}
        >
          {s.activeLabel}
        </div>
      )}
    </div>
  );
}

export default memo(DropContainerNode);