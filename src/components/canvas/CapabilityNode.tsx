"use client";

import { memo, useState } from "react";
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
  colWidth?: number;
  nodeHeight?: number;  // uniform height shared by all siblings in the same group
  nodeWidth?: number;   // explicit width override (used for L3 nodes inset inside cyan zone)
  canDrag?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
}

const LEVEL_STYLES: Record<
  number,
  { bg: string; text: string; border: string; numColor: string }
> = {
  0: { bg: "#0f1b2d", text: "#ffffff", border: "#0f1b2d", numColor: "#8ebfff" },
  1: { bg: "#1545d8", text: "#ffffff", border: "#1545d8", numColor: "#bcd7ff" },
  2: { bg: "#599dff", text: "#ffffff", border: "#3478f6", numColor: "#d9e8ff" },
  3: { bg: "#eef5ff", text: "#1a2a44", border: "#bcd7ff", numColor: "#599dff" },
};

const LEVEL_HEIGHTS: Record<number, number> = { 0: 44, 1: 44, 2: 40, 3: 36 };

function CapabilityNode({ data, id, selected }: NodeProps<CapabilityNodeData>) {
  const style = LEVEL_STYLES[data.level] || LEVEL_STYLES[3];
  const bg = data.fill || style.bg;
  const borderColor = data.border || style.border;
  const width = data.colWidth ?? data.nodeWidth ?? SUB_COL_W;
  // Use the pre-computed uniform height so all siblings are the same size.
  // colWidth nodes (L0 header) size themselves; others use nodeHeight.
  const fixedH = data.colWidth ? undefined : (data.nodeHeight ?? LEVEL_HEIGHTS[data.level] ?? 36);

  return (
    <div
      data-capability-node-id={id}
      style={{
        background: data.isDropTarget
          ? data.level === 3
            ? "#d4f4dd"
            : "#10b98126"
          : data.isDragging
            ? data.level === 3
              ? "#fef3c7"
              : "#fcd34d26"
            : bg,
        color: style.text,
        border: `2px solid ${data.isDropTarget ? "#10b981" : data.isDragging ? "#f59e0b" : borderColor}`,
        width: `${width}px`,
        minHeight: data.colWidth ? undefined : `${LEVEL_HEIGHTS[data.level] ?? 36}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: data.level === 0 ? "4px 8px" : "3px 5px",
        // L3 nodes are pill-shaped like the reference screenshot
        borderRadius: data.level === 0 ? "6px" : "4px",
        textAlign: "center",
        boxShadow: selected
          ? "0 0 0 2.5px #f59e0b"
          : data.isDragging
            ? "0 4px 12px rgba(245, 158, 11, 0.4)"
            : data.isDropTarget
              ? "0 0 0 2px #10b981, inset 0 0 8px rgba(16, 185, 129, 0.3)"
              : data.level === 0
                ? "0 2px 6px rgba(0,0,0,0.15)"
                : "0 1px 2px rgba(0,0,0,0.06)",
        cursor: data.isDragging ? "grabbing" : data.canDrag ? "grab" : "default",
        overflow: "visible",
        transition: "all 0.15s ease",
        position: "relative",
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "auto",
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

      {/* Name — full text, no clamping */}
      <div
        style={{
          fontSize: data.level === 0 ? "12px" : data.level === 3 ? "9.5px" : "10px",
          fontWeight: data.level <= 1 ? 600 : 500,
          lineHeight: 1.25,
          wordBreak: "break-word",
          whiteSpace: "normal",
        }}
      >
        {data.label}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Drop indicator for bottom (shows where it will be inserted) */}
      {data.isDropTarget && data.level >= 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "-4px",
            left: "0",
            right: "0",
            height: "2px",
            backgroundColor: "#10b981",
            borderRadius: "1px",
          }}
        />
      )}
    </div>
  );
}

export default memo(CapabilityNode);
