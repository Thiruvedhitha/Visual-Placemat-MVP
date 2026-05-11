"use client";

import { Suspense, useRef, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactFlow, { ReactFlowProvider } from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import { useCatalogStore } from "@/stores/catalogStore";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import CapabilityNode from "@/components/canvas/CapabilityNode";

const NODE_TYPES = { capability: CapabilityNode };
const ALL_LEVELS = new Set([0, 1, 2, 3]);

type ExportOption = {
  title: string;
  description: string;
  tag: string;
  actionLabel: string;
  format: "png" | "svg" | "pdf" | "json" | "csv" | "xlsx" | "view-link" | "duplicate-link";
};

type ExportSection = {
  title: string;
  subtitle: string;
  accent: string;
  options: ExportOption[];
};

const EXPORT_SECTIONS: ExportSection[] = [
  {
    title: "View & Duplicate",
    subtitle: "Share links for review or handoff without real-time collaboration.",
    accent: "from-sky-500 to-cyan-500",
    options: [
      {
        title: "View Link",
        description: "Create a shareable read-only URL to the current diagram.",
        tag: "Link",
        actionLabel: "Create View Link",
        format: "view-link",
      },
      {
        title: "Duplicate Link",
        description: "Open as an editable copy so teammates can branch independently.",
        tag: "Copy",
        actionLabel: "Create Duplicate Link",
        format: "duplicate-link",
      },
    ],
  },
  {
    title: "Visual Export",
    subtitle: "Download image and document formats suitable for decks and reports.",
    accent: "from-emerald-500 to-teal-500",
    options: [
      {
        title: "PNG",
        description: "Raster image export for slides, docs, and chat sharing.",
        tag: "Image",
        actionLabel: "Export PNG",
        format: "png",
      },
      {
        title: "SVG",
        description: "Scalable vector export for high-fidelity design workflows.",
        tag: "Vector",
        actionLabel: "Export SVG",
        format: "svg",
      },
      {
        title: "PDF",
        description: "Page-friendly export for executive reviews and printing.",
        tag: "Document",
        actionLabel: "Export PDF",
        format: "pdf",
      },
    ],
  },
  {
    title: "Data Export",
    subtitle: "Move underlying diagram data to systems and analysis pipelines.",
    accent: "from-amber-500 to-orange-500",
    options: [
      {
        title: "JSON",
        description: "Export full node, edge, and layout payload for re-import.",
        tag: "Schema",
        actionLabel: "Export JSON",
        format: "json",
      },
      {
        title: "CSV",
        description: "Flat tabular export for spreadsheet and BI workflows.",
        tag: "Table",
        actionLabel: "Export CSV",
        format: "csv",
      },
      {
        title: "Excel",
        description: "Workbook export preserving hierarchy columns and metadata.",
        tag: "XLSX",
        actionLabel: "Export Excel",
        format: "xlsx",
      },
    ],
  },
];

export default function ExportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading export options...</p>
        </div>
      }
    >
      <ReactFlowProvider>
        <ExportContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

function ExportContent() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get("catalogId");
  const capabilities = useCatalogStore((s) => s.capabilities);
  const catalogName = useCatalogStore((s) => s.catalogName);
  const storeCatalogId = useCatalogStore((s) => s.catalogId);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Build nodes from store
  const nodes = buildCanvasNodes(capabilities, ALL_LEVELS);

  // Calculate canvas bounds for proper export
  const getBounds = useCallback(() => {
    if (!nodes.length) return { width: 800, height: 600 };
    let maxX = 0, maxY = 0;
    for (const n of nodes) {
      const w = n.data.colWidth ?? n.data.nodeWidth ?? 190;
      const h = n.data.nodeHeight ?? 44;
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    return { width: maxX + 80, height: maxY + 40 };
  }, [nodes]);

  const handleExport = useCallback(async (format: string) => {
    // Handle link-based exports (no canvas needed)
    if (format === "view-link") {
      const id = storeCatalogId || catalogId;
      if (!id) {
        alert("Please save the catalog first (click Apply on the canvas) before creating a view link.");
        return;
      }
      const viewUrl = `${window.location.origin}/view?catalogId=${encodeURIComponent(id)}`;
      await navigator.clipboard.writeText(viewUrl);
      setCopiedLink("view-link");
      setTimeout(() => setCopiedLink(null), 3000);
      return;
    }
    if (format === "duplicate-link") {
      const id = storeCatalogId || catalogId;
      if (!id) {
        alert("Please save the catalog first (click Apply on the canvas) before creating a duplicate link.");
        return;
      }
      const dupUrl = `${window.location.origin}/dashboard?catalogId=${encodeURIComponent(id)}`;
      await navigator.clipboard.writeText(dupUrl);
      setCopiedLink("duplicate-link");
      setTimeout(() => setCopiedLink(null), 3000);
      return;
    }

    if (!canvasRef.current) return;
    setExporting(format);

    // Give ReactFlow a moment to ensure nodes are fully painted
    await new Promise((r) => setTimeout(r, 500));

    try {
      const flowEl = canvasRef.current.querySelector(".react-flow__viewport") as HTMLElement;
      if (!flowEl) throw new Error("Canvas not found");

      const { width, height } = getBounds();
      const baseName = catalogName || "capability-map";

      if (format === "png") {
        const dataUrl = await toPng(flowEl, {
          backgroundColor: "#f8fafc",
          width,
          height,
          style: {
            transform: "translate(30px, 20px) scale(1)",
            transformOrigin: "top left",
            width: `${width}px`,
            height: `${height}px`,
          },
        });
        // Convert data URL to blob for reliable download
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        saveAs(blob, `${baseName}.png`);
      } else if (format === "svg") {
        // Export as PNG embedded in SVG
        const pngDataUrl = await toPng(flowEl, {
          backgroundColor: "#f8fafc",
          width,
          height,
          style: {
            transform: "translate(30px, 20px) scale(1)",
            transformOrigin: "top left",
            width: `${width}px`,
            height: `${height}px`,
          },
        });
        const svgMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <image width="${width}" height="${height}" xlink:href="${pngDataUrl}"/>
</svg>`;
        // Use File object to ensure correct extension and type
        const file = new File([svgMarkup], `${baseName}.svg`, { type: "image/svg+xml" });
        saveAs(file);
      } else if (format === "pdf") {
        // Capture at 2x resolution for sharp PDF output
        const scale = 2;
        const dataUrl = await toPng(flowEl, {
          backgroundColor: "#ffffff",
          width,
          height,
          pixelRatio: scale,
          style: {
            transform: "translate(30px, 20px) scale(1)",
            transformOrigin: "top left",
            width: `${width}px`,
            height: `${height}px`,
          },
        });

        // A4 page dimensions in mm
        const A4_W = 297;
        const A4_H = 210;
        const MARGIN = 12; // mm
        const usableW = A4_W - MARGIN * 2;
        const usableH = A4_H - MARGIN * 2;

        // Fit image within usable area preserving aspect ratio
        const imgAspect = width / height;
        let imgW = usableW;
        let imgH = imgW / imgAspect;
        if (imgH > usableH) {
          imgH = usableH;
          imgW = imgH * imgAspect;
        }

        // Centre on page
        const offsetX = MARGIN + (usableW - imgW) / 2;
        const offsetY = MARGIN + (usableH - imgH) / 2;

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, A4_W, A4_H, "F");

        // Title bar at top
        pdf.setFillColor(15, 27, 45); // #0f1b2d navy
        pdf.rect(0, 0, A4_W, 10, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text(baseName, MARGIN, 6.5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.text(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), A4_W - MARGIN, 6.5, { align: "right" });

        // Add the capability map image
        pdf.addImage(dataUrl, "PNG", offsetX, offsetY + 4, imgW, imgH - 4);

        // Footer
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, A4_H - 7, A4_W, 7, "F");
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(6);
        pdf.text("Generated by Visual Placemat", A4_W / 2, A4_H - 2.5, { align: "center" });

        pdf.save(`${baseName}.pdf`);
      } else if (format === "json") {
        const json = JSON.stringify(capabilities, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        saveAs(blob, `${baseName}.json`);
      } else if (format === "csv") {
        const header = "id,name,level,parent_id,sort_order,description,note";
        const rows = capabilities.map((c) =>
          [c.id, `"${(c.name || "").replace(/"/g, '""')}"`, c.level, c.parent_id || "", c.sort_order, `"${(c.description || "").replace(/"/g, '""')}"`, `"${(c.note || "").replace(/"/g, '""')}"`].join(",")
        );
        const csv = [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        saveAs(blob, `${baseName}.csv`);
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [capabilities, catalogName, storeCatalogId, catalogId, getBounds]);

  const { width: canvasW, height: canvasH } = getBounds();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hidden canvas for export capture — rendered but not visible */}
      <div
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: canvasW,
          height: canvasH,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
          overflow: "hidden",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnDrag={false}
          preventScrolling={false}
          defaultViewport={{ x: 30, y: 20, zoom: 1 }}
          minZoom={1}
          maxZoom={1}
          proOptions={{ hideAttribution: true }}
        />
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-navy-950 via-brand-800 to-brand-600 px-6 py-10 text-white sm:px-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 20%, rgba(255,255,255,.2) 0, rgba(255,255,255,0) 35%), radial-gradient(circle at 85% 70%, rgba(255,255,255,.18) 0, rgba(255,255,255,0) 40%)",
              }}
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">Export Hub</p>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Export and Share Your Diagram</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-100/90">
                Pick a format or link mode based on how your team consumes the canvas. Visuals for slides,
                data for systems, and links for asynchronous collaboration.
              </p>
              {catalogId && (
                <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                  Catalog ID: <span className="ml-1 font-mono">{catalogId}</span>
                </p>
              )}
            </div>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10">
            {EXPORT_SECTIONS.map((section) => (
              <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {section.options.map((option) => (
                    <div
                      key={option.title}
                      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">{option.title}</h3>
                        <span
                          className={`rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white ${section.accent}`}
                        >
                          {option.tag}
                        </span>
                      </div>
                      <p className="min-h-12 text-xs leading-relaxed text-slate-500">{option.description}</p>
                      <button
                        type="button"
                        onClick={() => handleExport(option.format)}
                        disabled={exporting !== null}
                        className={`mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold transition ${
                          exporting === option.format
                            ? "cursor-wait border-brand-300 text-brand-600"
                            : copiedLink === option.format
                            ? "border-green-300 text-green-600"
                            : "text-slate-600 hover:border-brand-300 hover:text-brand-700"
                        }`}
                      >
                        {exporting === option.format
                          ? "Exporting…"
                          : copiedLink === option.format
                          ? "✓ Link Copied!"
                          : option.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <p className="text-xs text-slate-500">Run one export action at a time using the buttons in each card.</p>
            <div className="flex items-center gap-2">
              <Link
                href={catalogId ? `/dashboard?catalogId=${encodeURIComponent(catalogId)}` : "/dashboard"}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Back to Canvas
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
