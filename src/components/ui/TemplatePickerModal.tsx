"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCatalogStore } from "@/stores/catalogStore";
import { getSavedTemplates, type SavedTemplate } from "@/components/canvas/SaveAsTemplateModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  "Banking & Finance":        "bg-blue-600",
  "Healthcare":               "bg-emerald-600",
  "Retail & Consumer":        "bg-amber-500",
  "Technology & Software":    "bg-violet-600",
  "Insurance":                "bg-cyan-600",
  "Manufacturing":            "bg-orange-600",
  "Energy & Utilities":       "bg-yellow-600",
  "Government & Public Sector": "bg-slate-600",
  "Telecoms":                 "bg-pink-600",
  "Other":                    "bg-slate-500",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-slate-500";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided (canvas mode), called with the template's capabilities instead of navigating */
  onSelect?: (capabilities: SavedTemplate["capabilities"], name: string, category: string) => void;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function TemplatePickerModal({ open, onClose, onSelect }: Props) {
  const router = useRouter();
  const setCatalog = useCatalogStore((s) => s.setCatalog);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);

  // Re-read localStorage each time the modal opens
  useEffect(() => {
    if (open) {
      setTemplates(getSavedTemplates());
    }
  }, [open]);

  if (!open) return null;

  function handleSelect(t: SavedTemplate) {
    if (onSelect) {
      // Canvas mode — load in-place
      onSelect(t.capabilities, t.name, t.category);
    } else {
      // Home page mode — load into store and navigate
      setCatalog(t.name, t.capabilities, t.category);
      router.push("/dashboard");
    }
    onClose();
  }

  const isEmpty = templates.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Your saved templates</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isEmpty
                ? "No templates saved yet. Save a diagram as a template from the canvas."
                : `${templates.length} template${templates.length !== 1 ? "s" : ""} available — click one to load it.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">No templates yet</p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Open a diagram on the canvas, build it out, then click <strong>Save as template</strong> in the toolbar to save it here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-150 hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
                >
                  {/* Category dot */}
                  <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${categoryColor(t.category)} text-white text-xs font-bold`}>
                    {t.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">
                      {t.name}
                    </span>
                    {t.description && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400 line-clamp-2">
                        {t.description}
                      </span>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {t.category}
                      </span>
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {t.nodeCount} nodes
                      </span>
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {formatDate(t.savedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="ml-auto mt-1 h-4 w-4 flex-shrink-0 text-slate-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-brand-400"
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!onSelect && (
          <div className="flex-shrink-0 border-t border-slate-100 px-6 py-3 text-center">
            <button
              onClick={() => { onClose(); router.push("/dashboard"); }}
              className="text-xs font-medium text-slate-400 hover:text-brand-600 transition"
            >
              Skip — start with a blank canvas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
