"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type ExportOption = {
  title: string;
  description: string;
  tag: string;
  actionLabel: string;
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
      },
      {
        title: "Duplicate Link",
        description: "Open as an editable copy so teammates can branch independently.",
        tag: "Copy",
        actionLabel: "Create Duplicate Link",
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
      },
      {
        title: "SVG",
        description: "Scalable vector export for high-fidelity design workflows.",
        tag: "Vector",
        actionLabel: "Export SVG",
      },
      {
        title: "PDF",
        description: "Page-friendly export for executive reviews and printing.",
        tag: "Document",
        actionLabel: "Export PDF",
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
      },
      {
        title: "CSV",
        description: "Flat tabular export for spreadsheet and BI workflows.",
        tag: "Table",
        actionLabel: "Export CSV",
      },
      {
        title: "Excel",
        description: "Workbook export preserving hierarchy columns and metadata.",
        tag: "XLSX",
        actionLabel: "Export Excel",
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
      <ExportContent />
    </Suspense>
  );
}

function ExportContent() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get("catalogId");

  return (
    <div className="min-h-screen bg-slate-50">
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
                        className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        {option.actionLabel}
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
