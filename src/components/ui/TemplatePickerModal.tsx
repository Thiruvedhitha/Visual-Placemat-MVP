"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCatalogStore } from "@/stores/catalogStore";
import { getSavedTemplates, type SavedTemplate } from "@/components/canvas/SaveAsTemplateModal";
import type { Capability } from "@/types/capability";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  "Banking & Finance":          "bg-blue-600",
  "Healthcare":                 "bg-emerald-600",
  "Retail & Consumer":          "bg-amber-500",
  "Technology & Software":      "bg-violet-600",
  "Insurance":                  "bg-cyan-600",
  "Manufacturing":              "bg-orange-600",
  "Energy & Utilities":         "bg-yellow-600",
  "Government & Public Sector": "bg-slate-600",
  "Telecoms":                   "bg-pink-600",
  "Other":                      "bg-slate-500",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-slate-500";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuiltinTemplate {
  id: string;
  name: string;
  category: string;
  nodeCount: number;
  nodeStyles: Record<string, unknown>;
  capabilities: Capability[];
}

// ─── Shared template card ─────────────────────────────────────────────────────

function TemplateCard({
  name,
  category,
  nodeCount,
  badge,
  sub,
  onClick,
}: {
  name: string;
  category: string;
  nodeCount: number;
  badge?: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-150 hover:border-brand-300 hover:shadow-md active:scale-[0.98] w-full"
    >
      <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${categoryColor(category)} text-white text-xs font-bold`}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">
          {name}
        </span>
        {sub && (
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400 line-clamp-2">
            {sub}
          </span>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badge && (
            <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
              {badge}
            </span>
          )}
          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {category}
          </span>
          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {nodeCount} nodes
          </span>
        </div>
      </div>
      <svg
        className="ml-auto mt-1 h-4 w-4 flex-shrink-0 text-slate-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-brand-400"
        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
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
  const [userTemplates, setUserTemplates] = useState<SavedTemplate[]>([]);
  const [builtinTemplates, setBuiltinTemplates] = useState<BuiltinTemplate[]>([]);
  const [loadingBuiltin, setLoadingBuiltin] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Load user-saved templates from localStorage
    setUserTemplates(getSavedTemplates());
    // Load built-in templates from DB
    setLoadingBuiltin(true);
    fetch("/api/catalogs/templates")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.templates)) setBuiltinTemplates(data.templates); })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoadingBuiltin(false));
  }, [open]);

  if (!open) return null;

  function handleSelectBuiltin(t: BuiltinTemplate) {
    if (onSelect) {
      onSelect(t.capabilities, t.name, t.category);
    } else {
      // Navigate with catalogId so the dashboard fetches directly from DB
      router.push(`/dashboard?catalogId=${encodeURIComponent(t.id)}`);
    }
    onClose();
  }

  function handleSelectUser(t: SavedTemplate) {
    if (onSelect) {
      onSelect(t.capabilities, t.name, t.category);
    } else {
      setCatalog(t.name, t.capabilities, t.category);
      router.push("/dashboard");
    }
    onClose();
  }

  const hasBuiltin = builtinTemplates.length > 0;
  const hasUser = userTemplates.length > 0;
  const isEmpty = !loadingBuiltin && !hasBuiltin && !hasUser;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
        style={{ maxHeight: "82vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Choose a template</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Start from a built-in map or one of your saved templates.
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Built-in templates ── */}
          {(loadingBuiltin || hasBuiltin) && (
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Built-in templates
              </p>
              {loadingBuiltin ? (
                <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading…
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {builtinTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      name={t.name}
                      category={t.category}
                      nodeCount={t.nodeCount}
                      badge="Built-in"
                      onClick={() => handleSelectBuiltin(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── User-saved templates ── */}
          {hasUser && (
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Your saved templates
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {userTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    name={t.name}
                    category={t.category}
                    nodeCount={t.nodeCount}
                    sub={t.description || undefined}
                    onClick={() => handleSelectUser(t)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {isEmpty && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">No templates yet</p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Open a diagram on the canvas, build it out, then click <strong>Save as template</strong> to save it here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!onSelect && (
          <div className="flex-shrink-0 border-t border-slate-100 px-6 py-3 text-center">
            <button
              onClick={() => { onClose(); router.push("/dashboard?mode=ai"); }}
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
