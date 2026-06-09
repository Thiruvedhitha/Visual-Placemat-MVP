"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Capability } from "@/types/capability";
import type { NodeStylePatch } from "@/lib/commands/index";

export interface VersionEntry {
  id: string;
  version_number: number | null;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface VersionHistoryPanelProps {
  catalogId: string | null;
  onRestore: (capabilities: Capability[], nodeStyles: Record<string, NodeStylePatch>) => void;
}

function VersionRow({
  v,
  onRestore,
  restoringId,
  onRename,
}: {
  v: VersionEntry;
  onRestore: (v: VersionEntry) => void;
  restoringId: string | null;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== v.name) onRename(v.id, trimmed);
    setEditing(false);
  };

  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 transition ${
        v.is_active ? "bg-green-50" : "hover:bg-slate-50"
      }`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          v.is_active ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600"
        }`}
      >
        {v.version_number ?? "—"}
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setDraft(v.name); setEditing(false); }
            }}
            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs text-slate-800 outline-none ring-1 ring-blue-400"
          />
        ) : (
          <button
            onClick={() => { setDraft(v.name); setEditing(true); }}
            title="Click to rename"
            className="group flex w-full items-center gap-1 text-left text-xs font-medium text-slate-700 hover:text-blue-600"
          >
            <span className="min-w-0 truncate">{v.name}</span>
            <svg className="h-3 w-3 flex-shrink-0 opacity-0 transition group-hover:opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z" />
            </svg>
          </button>
        )}

        <p className="mt-0.5 text-[10px] text-slate-400">
          {new Date(v.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {v.is_active && (
          <span className="mt-1 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            Current
          </span>
        )}
        {!v.is_active && (
          <button
            onClick={() => onRestore(v)}
            disabled={restoringId !== null}
            className="mt-2 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {restoringId === v.id ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              "Restore"
            )}
          </button>
        )}
      </div>
    </li>
  );
}

export default function VersionHistoryPanel({ catalogId, onRestore }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!catalogId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalogs/versions?catalogId=${encodeURIComponent(catalogId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load versions");
      setVersions(data.versions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [catalogId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handleRestore = async (version: VersionEntry) => {
    if (!catalogId || version.is_active) return;
    setRestoringId(version.id);
    setError(null);
    try {
      const res = await fetch("/api/catalogs/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogId, versionId: version.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setVersions((prev) => prev.map((v) => ({ ...v, is_active: v.id === version.id })));
      onRestore(data.capabilities, data.nodeStyles ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  const handleRename = async (id: string, name: string) => {
    setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
    try {
      const res = await fetch(`/api/catalogs/versions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Rename failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
      fetchVersions();
    }
  };

  if (!catalogId) {
    return (
      <div className="p-4 text-xs text-slate-400">
        Apply changes once to start tracking version history.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Version History
        </h3>
        <button
          onClick={fetchVersions}
          disabled={loading}
          title="Refresh"
          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <p className="px-4 pt-2 text-[10px] text-slate-400">Click a version name to rename it.</p>

      {error && (
        <p className="mx-4 mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && versions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : versions.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            No saved versions yet. Click Apply to create one.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {versions.map((v) => (
              <VersionRow
                key={v.id}
                v={v}
                onRestore={handleRestore}
                restoringId={restoringId}
                onRename={handleRename}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
