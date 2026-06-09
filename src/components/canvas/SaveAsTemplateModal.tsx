"use client";

import { useState, useEffect } from "react";
import type { Capability } from "@/types/capability";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  capabilities: Capability[];
  nodeCount: number;
  savedAt: string;
}

const STORAGE_KEY = "vp_saved_templates";

export function getSavedTemplates(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveTemplate(template: SavedTemplate): void {
  const existing = getSavedTemplates();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, template]));
}

// ─── Category options ─────────────────────────────────────────────────────────

const CATEGORIES = [
  "Banking & Finance",
  "Healthcare",
  "Retail & Consumer",
  "Technology & Software",
  "Insurance",
  "Manufacturing",
  "Energy & Utilities",
  "Government & Public Sector",
  "Telecoms",
  "Other",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  capabilities: Capability[];
  defaultName?: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function SaveAsTemplateModal({ open, onClose, capabilities, defaultName = "" }: Props) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Reset form each time modal opens
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setCategory(CATEGORIES[0]);
      setDescription("");
      setSaved(false);
      setError("");
    }
  }, [open, defaultName]);

  if (!open) return null;

  function handleSave() {
    if (!name.trim()) {
      setError("Please enter a template name.");
      return;
    }

    const template: SavedTemplate = {
      id: `tpl_${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim(),
      capabilities,
      nodeCount: capabilities.length,
      savedAt: new Date().toISOString(),
    };

    saveTemplate(template);
    setSaved(true);

    // Auto-close after brief success display
    setTimeout(() => {
      onClose();
    }, 1200);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
              <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Save as Template</h2>
              <p className="text-[11px] text-slate-400">{capabilities.length} capabilities will be saved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {saved ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">Template saved!</p>
            <p className="text-xs text-slate-400">"{name}" has been saved to your templates.</p>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            {/* Template name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Template name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="e.g. Banking Capability Map v1"
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400 transition ${
                  error ? "border-red-300 focus:ring-red-300" : "border-slate-200"
                }`}
                autoFocus
              />
              {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Description <span className="text-slate-300 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short note about what this template covers…"
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
              />
            </div>

            {/* Stat pill */}
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              <span className="text-xs text-slate-500">
                {capabilities.length} capabilities across {new Set(capabilities.map((c) => c.level)).size} level{new Set(capabilities.map((c) => c.level)).size !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        {!saved && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition"
            >
              Save template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
