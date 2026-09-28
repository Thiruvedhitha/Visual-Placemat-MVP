"use client";

import { useState, useEffect } from "react";
import { useReactFlow } from "reactflow";

export default function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);
  const [zoomInput, setZoomInput] = useState("100");

  useEffect(() => {
    const handleZoomChange = () => {
      const currentZoom = getZoom();
      const zoomPercent = Math.round(currentZoom * 100);
      setZoom(zoomPercent);
      setZoomInput(String(zoomPercent));
    };
    const interval = setInterval(handleZoomChange, 100);
    return () => clearInterval(interval);
  }, [getZoom]);

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInput(e.target.value);
  };

  const handleZoomInputBlur = () => {
    let percent = parseInt(zoomInput, 10);
    if (isNaN(percent) || percent < 10) percent = 10;
    if (percent > 300) percent = 300;
    setZoom(percent);
    setZoomInput(String(percent));
  };

  const zoomBtn =
    "flex h-7 w-7 items-center justify-center rounded text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer";

  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
      <button
        onClick={() => fitView({ padding: 0.15 })}
        title="Fit view"
        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
        </svg>
        Fit view
      </button>

      <div className="mx-0.5 h-4 w-px bg-slate-200" />

      <button className={zoomBtn} onClick={() => zoomOut()} title="Zoom out">
        −
      </button>
      <input
        type="text"
        value={zoomInput}
        onChange={handleZoomInputChange}
        onBlur={handleZoomInputBlur}
        className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-center text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        placeholder="100%"
      />
      <button className={zoomBtn} onClick={() => zoomIn()} title="Zoom in">
        +
      </button>
    </div>
  );
}
