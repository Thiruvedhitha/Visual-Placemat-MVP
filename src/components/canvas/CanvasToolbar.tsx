"use client";

import { useState, useEffect } from "react";
import { useReactFlow } from "reactflow";

interface CanvasToolbarProps {
  interactionMode: "select" | "pan";
  onModeChange: (mode: "select" | "pan") => void;
}

export default function CanvasToolbar({ interactionMode, onModeChange }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const [zoomInput, setZoomInput] = useState("100");

  // Update zoom display when zoom changes
  useEffect(() => {
    const handleZoomChange = () => {
      const currentZoom = getZoom();
      const zoomPercent = Math.round(currentZoom * 100);
      setZoom(zoomPercent);
      setZoomInput(String(zoomPercent));
    };

    // Listen to view changes
    const interval = setInterval(handleZoomChange, 100);
    return () => clearInterval(interval);
  }, [getZoom]);

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setZoomInput(value);
  };

  const handleZoomInputBlur = () => {
    let percent = parseInt(zoomInput, 10);
    if (isNaN(percent) || percent < 10) percent = 10;
    if (percent > 300) percent = 300;

    setZoom(percent);
    setZoomInput(String(percent));
  };

  const btn =
    "px-3 py-1 text-sm font-medium rounded transition-colors cursor-pointer";
  const inactive = "text-slate-600 hover:bg-slate-100";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1.5">
        {/* Zoom Out Button */}
        <button
          className={`${btn} w-8 ${inactive}`}
          onClick={() => zoomOut()}
          title="Zoom out"
        >
          −
        </button>

        {/* Zoom Percentage Input */}
        <input
          type="text"
          value={zoomInput}
          onChange={handleZoomInputChange}
          onBlur={handleZoomInputBlur}
          className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="100%"
        />

        {/* Zoom In Button */}
        <button
          className={`${btn} w-8 ${inactive}`}
          onClick={() => zoomIn()}
          title="Zoom in"
        >
          +
        </button>
      </div>

      <div className="mx-1 h-4 w-px bg-slate-200" />

      <button
        className={`${btn} ${inactive}`}
        onClick={() => fitView({ padding: 0.15 })}
        title="Fit view"
      >
        Fit view
      </button>
    </div>
  );
}
