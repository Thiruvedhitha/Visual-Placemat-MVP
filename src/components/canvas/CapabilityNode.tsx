"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { SUB_COL_W } from "@/lib/canvas/layoutEngine";

export interface CapabilityNodeData {
  label: string;
  level: 0 | 1 | 2 | 3;
  parentName: string | null;
  description: string | null;
  number?: string;
  fill?: string;
  border?: string;
  note?: string;
  colWidth?: number; // only on L0 — spans all its L1 sub-columns
}

/**
 * Level styles:
 * L0 — dark navy header (spans all L1 sub-columns)
 * L1 — brand blue
 * L2 — medium blue
 * L3 — pale blue / white with border
 */
const LEVEL_STYLES: Record<
  number,
  { bg: string; text: string; border: string; numColor: string }
> = {
  0: { bg: "#0f1b2d", text: "#ffffff", border: "#0f1b2d", numColor: "#8ebfff" },
  1: { bg: "#1545d8", text: "#ffffff", border: "#1545d8", numColor: "#bcd7ff" },
  2: { bg: "#599dff", text: "#ffffff", border: "#3478f6", numColor: "#d9e8ff" },
  3: { bg: "#eef5ff", text: "#1a2a44", border: "#bcd7ff", numColor: "#599dff" },
};

const LEVEL_HEIGHTS: Record<number, number> = { 0: 48, 1: 48, 2: 48, 3: 42 };

function CapabilityNode({ data, selected }: NodeProps<CapabilityNodeData>) {
  const style = LEVEL_STYLES[data.level] || LEVEL_STYLES[3];
  const bg = data.fill || style.bg;
  const borderColor = data.border || style.border;
  const width = data.colWidth ?? SUB_COL_W;
  const height = data.colWidth ? undefined : LEVEL_HEIGHTS[data.level] ?? 42;

  return (
    <div
      style={{
        background: bg,
        color: style.text,
        border: `1.5px solid ${borderColor}`,
        width: `${width}px`,
        height: height ? `${height}px` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: data.level === 0 ? "4px 8px" : "3px 5px",
        borderRadius: data.level === 0 ? "6px" : "4px",
        textAlign: "center",
        boxShadow: selected
          ? "0 0 0 2.5px #f59e0b"
          : data.level === 0
            ? "0 2px 6px rgba(0,0,0,0.15)"
            : "0 1px 2px rgba(0,0,0,0.06)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Number */}
      {data.number && (
        <div
          style={{
            fontSize: data.level === 0 ? "13px" : "9px",
            fontWeight: 700,
            color: style.numColor,
            lineHeight: 1.1,
          }}
        >
          {data.number}
        </div>
      )}

      {/* Name — clamps to 2 lines max */}
      <div
        style={{
          fontSize: data.level === 0 ? "12px" : data.level === 3 ? "9.5px" : "10px",
          fontWeight: data.level <= 1 ? 600 : 500,
          lineHeight: 1.2,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
          wordBreak: "break-word",
        }}
      >
        {data.label}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

export default memo(CapabilityNode);
