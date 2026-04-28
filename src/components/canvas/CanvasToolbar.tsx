"use client";

import { useReactFlow } from "reactflow";

interface CanvasToolbarProps {
  interactionMode: "select" | "pan";
  onModeChange: (mode: "select" | "pan") => void;
}

export default function CanvasToolbar({ interactionMode, onModeChange }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const btn =
    "px-3 py-1 text-sm font-medium rounded transition-colors cursor-pointer";
  const active = "bg-brand-100 text-brand-700";
  const inactive = "text-slate-600 hover:bg-slate-100";

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-sm">
      <button
        className={`${btn} ${interactionMode === "select" ? active : inactive}`}
        onClick={() => onModeChange("select")}
      >
        Select
      </button>
      <button
        className={`${btn} ${interactionMode === "pan" ? active : inactive}`}
        onClick={() => onModeChange("pan")}
      >
        Pan
      </button>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <button className={`${btn} ${inactive}`} onClick={() => zoomIn()}>
        Zoom in
      </button>
      <button className={`${btn} ${inactive}`} onClick={() => zoomOut()}>
        Zoom out
      </button>
      <button className={`${btn} ${inactive}`} onClick={() => fitView({ padding: 0.15 })}>
        Fit view
      </button>
    </div>
  );
}
