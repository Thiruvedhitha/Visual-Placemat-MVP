"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";

interface Props {
  catalogId: string;
  open: boolean;
  onClose: () => void;
}

export default function CatalogNotesPanel({ catalogId, open, onClose }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && catalogId) {
      setLoaded(false);
      fetch(`/api/catalogs/${catalogId}/notes`)
        .then((r) => r.json())
        .then((d) => { setNotes(d.notes ?? ""); setLoaded(true); })
        .catch(() => setLoaded(true));
    }
  }, [open, catalogId]);

  const save = useCallback(async () => {
    if (!catalogId) return;
    setSaving(true);
    await fetch(`/api/catalogs/${catalogId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
  }, [catalogId, notes]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Diagram Notes</h2>
          <button
            onClick={() => { save(); onClose(); }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!loaded ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={save}
              rows={14}
              placeholder="Add notes about this diagram — decisions, context, change history…"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-xs text-slate-400">{saving ? "Saving…" : "Auto-saves on blur"}</span>
          <div className="flex gap-2">
            <button
              onClick={() => { save(); onClose(); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
