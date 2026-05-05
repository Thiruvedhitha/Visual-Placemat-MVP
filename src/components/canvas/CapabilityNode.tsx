"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

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
  nodeHeight?: number;
  nodeWidth?: number;
  canDrag?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isSelected?: boolean;
  // LeanIX-specific
  l0Color?: string;
  l0TextColor?: string;
  l1Children?: { id: string; name: string; number: string; level: number; children: { id: string; name: string; number: string }[] }[];
}

// Match sidebar layer colors
const LEVEL_COLORS = {
  0: "#0f1b2d", // L0 — Domain (dark navy)
  1: "#2563eb", // L1 — Group (vibrant blue)
  2: "#599dff", // L2 — Subgroup (light blue)
  3: "#d1e3ff", // L3 — Leaf (very light blue)
};

/**
 * LeanIX-style capability node — colors match sidebar layers.
 *
 * L0 = dark navy banner
 * L1 = blue header column with white body
 * L2 = light blue row with bold text
 * L3 = very light blue row with regular text
 */
function CapabilityNode({ data, id, selected }: NodeProps<CapabilityNodeData>) {
  const width = data.colWidth ?? data.nodeWidth ?? 190;
  const height = data.nodeHeight;
  // For L0/L1/L2, use data.isSelected (avoids ReactFlow z-index bump); L3 uses prop selected
  const isHighlighted = data.isSelected ?? selected;

  // ── L0: Dark navy horizontal banner ──
  if (data.level === 0) {
    const bgColor = data.fill || LEVEL_COLORS[0];
    const borderColor = data.border || bgColor;

    return (
      <div
        data-capability-node-id={id}
        style={{
          width: `${width}px`,
          height: height ? `${height}px` : "44px",
          borderRadius: "8px",
          background: bgColor,
          border: `2.5px solid ${isHighlighted ? "#f59e0b" : borderColor}`,
          boxShadow: isHighlighted
            ? "0 0 0 3px #f59e0b"
            : "0 3px 10px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        <span
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: "15px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            lineHeight: 1.3,
            textAlign: "center",
            padding: "0 16px",
            textShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        >
          {data.number} {data.label}
        </span>
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </div>
    );
  }

  // ── L1: Blue filled container with header ──
  if (data.level === 1) {
    const headerColor = data.fill || LEVEL_COLORS[1];
    const borderColor = data.border || headerColor;

    return (
      <div
        data-capability-node-id={id}
        style={{
          width: `${width}px`,
          height: height ? `${height}px` : "auto",
          borderRadius: "8px",
          overflow: "hidden",
          border: `3px solid ${isHighlighted ? "#f59e0b" : borderColor}`,
          boxShadow: isHighlighted
            ? "none"
            : "0 2px 8px rgba(0,0,0,0.12)",
          background: headerColor,
          display: "flex",
          flexDirection: "column",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

        {/* Header text on blue background */}
        <div
          style={{
            color: "#fff",
            padding: "12px 12px",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "15px",
            lineHeight: 1.3,
            letterSpacing: "0.02em",
          }}
        >
          {data.number} {data.label}
        </div>

        <div style={{ flex: 1 }} />

        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </div>
    );
  }

  // ── L2: Container with header (holds L3 children) ──
  if (data.level === 2) {
    const bgColor = data.fill || LEVEL_COLORS[2];
    const borderColor = data.border || bgColor;

    return (
      <div
        data-capability-node-id={id}
        style={{
          width: `${width}px`,
          height: height ? `${height}px` : "auto",
          borderRadius: "6px",
          border: `3px solid ${isHighlighted ? "#f59e0b" : borderColor}`,
          boxShadow: isHighlighted
            ? "none"
            : "0 1px 4px rgba(0,0,0,0.1)",
          background: bgColor,
          display: "flex",
          flexDirection: "column",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

        {/* Header */}
        <div
          style={{
            color: "#0f1b2d",
            padding: "10px 10px",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "12px",
            lineHeight: 1.4,
            wordBreak: "break-word",
            background: bgColor,
            borderRadius: "6px 6px 0 0",
          }}
        >
          {data.number} {data.label}
        </div>

        <div style={{ flex: 1 }} />

        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </div>
    );
  }

  // ── L3: White box with L3 sidebar color border ──
  return (
    <div
      data-capability-node-id={id}
      style={{
        width: `${width}px`,
        height: height ? `${height}px` : "auto",
        fontSize: "11px",
        fontWeight: 600,
        color: "#1a1a2e",
        lineHeight: 1.3,
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
        background: data.fill || "#fff",
        border: `2px solid ${data.border || LEVEL_COLORS[3]}`,
        borderRadius: "4px",
        cursor: "grab",
        userSelect: "none",
        overflow: "hidden",
        wordBreak: "break-word",
        boxShadow: isHighlighted
          ? "0 0 0 2px #f59e0b"
          : "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {data.number} {data.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

export default memo(CapabilityNode);
