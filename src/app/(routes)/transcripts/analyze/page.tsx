"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCatalogStore } from "@/stores/catalogStore";
import type { DiagramCommand } from "@/lib/commands/index";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProposedChange {
  id: string;
  todo_text: string;
  source_quote: string;
  confidence: number;
  command: DiagramCommand;
  selected: boolean;
  status: string;
}

interface TranscriptRecord {
  id: string;
  title: string;
  status: string;
  progress: number;
  current_step: string;
  understanding: string;
  error_message?: string;
}

type Phase = "upload" | "processing" | "review" | "applying" | "done";

// ── Progress steps (for the animated stepper) ─────────────────────────────

const STEPS = [
  { label: "Removing noise",              minProgress: 10 },
  { label: "Extracting capability changes", minProgress: 40 },
  { label: "Preparing review",            minProgress: 70 },
  { label: "Ready for review",            minProgress: 90 },
];

// ── Command type → group ───────────────────────────────────────────────────

const STRUCTURAL_TYPES = new Set(["ADD_NODE", "DELETE_NODE", "RENAME_NODE", "REPARENT_NODE"]);

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  ADD_NODE:     { label: "Add",     cls: "bg-emerald-500/20 text-emerald-400" },
  DELETE_NODE:  { label: "Remove",  cls: "bg-red-500/20 text-red-400" },
  RENAME_NODE:  { label: "Rename",  cls: "bg-purple-500/20 text-purple-400" },
  REPARENT_NODE:{ label: "Move",    cls: "bg-blue-500/20 text-blue-400" },
  SET_STYLE:    { label: "Style",   cls: "bg-violet-500/20 text-violet-400" },
  RESET_STYLE:  { label: "Reset",   cls: "bg-gray-500/20 text-gray-400" },
  SET_LEGEND:   { label: "Legend",  cls: "bg-amber-500/20 text-amber-400" },
  REMOVE_LEGEND:{ label: "Legend−", cls: "bg-amber-500/20 text-amber-400" },
  SET_NOTE:     { label: "Note",    cls: "bg-sky-500/20 text-sky-400" },
  SET_DESCRIPTION:{ label: "Desc", cls: "bg-sky-500/20 text-sky-400" },
  SET_TEXT_COLOR: { label: "Color", cls: "bg-pink-500/20 text-pink-400" },
};

// ── Main page ──────────────────────────────────────────────────────────────

export default function AnalyzeTranscriptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const catalogId     = searchParams.get("catalogId");
  const legend        = useCatalogStore((s) => s.legend);

  const [phase,         setPhase]         = useState<Phase>("upload");
  const [text,          setText]          = useState("");
  const [title,         setTitle]         = useState("");
  const [transcriptId,  setTranscriptId]  = useState<string | null>(null);
  const [transcript,    setTranscript]    = useState<TranscriptRecord | null>(null);
  const [changes,       setChanges]       = useState<ProposedChange[]>([]);
  const [error,         setError]         = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup polling on unmount ──────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Upload & analyse ───────────────────────────────────────────────────
  async function handleUpload() {
    if (!catalogId) { setError("No catalog selected. Open a diagram first, then use Analyze Transcript."); return; }
    if (text.trim().length < 50) { setError("Transcript must be at least 50 characters"); return; }
    setError("");
    setPhase("processing");

    const res = await fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, text, title: title || "Untitled meeting", legend }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Upload failed"); setPhase("upload"); return; }

    setTranscriptId(data.transcriptId);
    startPolling(data.transcriptId);
  }

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/transcripts/${id}`);
      if (!res.ok) return;
      const { transcript: t, changes: ch } = await res.json();
      setTranscript(t);

      if (t.status === "ready_for_review") {
        clearInterval(pollRef.current!);
        setChanges(ch as ProposedChange[]);
        setPhase("review");
      } else if (t.status === "failed") {
        clearInterval(pollRef.current!);
        setError(t.error_message || "Processing failed");
        setPhase("upload");
      }
    }, 1500);
  }

  // ── Selection toggles ──────────────────────────────────────────────────
  const toggleChange = useCallback((id: string) =>
    setChanges((prev) => prev.map((c) => c.id === id ? { ...c, selected: !c.selected } : c)), []);
  const selectAll         = () => setChanges((p) => p.map((c) => ({ ...c, selected: true })));
  const deselectAll       = () => setChanges((p) => p.map((c) => ({ ...c, selected: false })));
  const selectHighConf    = () => setChanges((p) => p.map((c) => ({ ...c, selected: c.confidence >= 0.8 })));

  // ── Apply selected changes ─────────────────────────────────────────────
  async function handleApply() {
    const selected = changes.filter((c) => c.selected);
    if (selected.length === 0) { setError("Select at least one change to apply"); return; }
    setError("");
    setPhase("applying");

    // Save selections to DB
    await fetch(`/api/transcripts/${transcriptId}/changes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: changes.map((c) => ({ id: c.id, selected: c.selected })) }),
    });

    // Fetch commands + mark applied
    const res = await fetch(`/api/transcripts/${transcriptId}/apply`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Apply failed"); setPhase("review"); return; }

    const commands: DiagramCommand[] = data.commands ?? [];

    // Store commands in sessionStorage so the dashboard can pick them up on focus/load.
    // The dashboard checks for a pending transcript payload on mount.
    if (commands.length > 0 && catalogId) {
      sessionStorage.setItem(
        `transcript_commands_${catalogId}`,
        JSON.stringify({ commands, transcriptId, ts: Date.now() })
      );
    }

    setPhase("done");
  }

  // ── Render: upload ─────────────────────────────────────────────────────
  if (phase === "upload") return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold mb-1">Analyze Meeting Transcript</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Paste a meeting transcript and AI will extract capability changes and status assignments for you to review before applying.
      </p>

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

      <input
        type="text"
        placeholder="Meeting title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 mb-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
      />
      <textarea
        placeholder="Paste your Teams / Zoom / Google Meet transcript here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-3 font-mono text-sm mb-4 resize-y text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
      />
      <div className="flex items-center gap-4">
        <button
          onClick={handleUpload}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium text-sm transition"
        >
          Analyze Transcript
        </button>
        <span className="text-slate-500 text-xs">{text.length.toLocaleString()} characters</span>
        {!catalogId && <span className="text-amber-400 text-xs">⚠ No catalog — open a diagram first</span>}
      </div>
    </div>
  );

  // ── Render: processing ─────────────────────────────────────────────────
  if (phase === "processing") return (
    <div className="max-w-2xl mx-auto p-6 mt-16">
      <h2 className="text-xl font-bold mb-6">Analyzing transcript…</h2>
      <div className="w-full bg-slate-700 rounded-full h-2.5 mb-3">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-700"
          style={{ width: `${transcript?.progress ?? 10}%` }}
        />
      </div>
      <div className="flex items-center justify-between mb-8">
        <p className="text-slate-300 text-sm">{transcript?.current_step ?? "Starting…"}</p>
        <p className="text-slate-400 text-sm font-mono tabular-nums">{transcript?.progress ?? 10}%</p>
      </div>
      <div className="space-y-3">
        {STEPS.map((step) => {
          const prog = transcript?.progress ?? 0;
          const done   = prog > step.minProgress;
          const active = !done && prog >= step.minProgress - 15;
          return (
            <div key={step.label} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${done ? "bg-emerald-500 text-white" : active ? "bg-blue-500 text-white animate-pulse" : "bg-slate-700 text-slate-500"}`}>
                {done ? "✓" : active ? "•" : "○"}
              </div>
              <span className={`text-sm ${done ? "text-emerald-400" : active ? "text-white" : "text-slate-500"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Render: review / applying / done ──────────────────────────────────
  if (phase === "review" || phase === "applying" || phase === "done") {
    const selectedCount   = changes.filter((c) => c.selected).length;
    const structural      = changes.filter((c) => STRUCTURAL_TYPES.has(c.command?.type ?? ""));
    const styleAndLegend  = changes.filter((c) => !STRUCTURAL_TYPES.has(c.command?.type ?? ""));

    return (
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => { setPhase("upload"); setChanges([]); setTranscript(null); setTranscriptId(null); }}
          className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          ← New transcript
        </button>

        <h1 className="text-2xl font-bold mb-1">Review Proposed Changes</h1>

        {/* AI understanding */}
        {transcript?.understanding && (
          <div className="my-4 p-4 bg-slate-800/60 border border-slate-700 rounded-lg">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Meeting summary</p>
            <p className="text-sm text-slate-200">{transcript.understanding}</p>
          </div>
        )}

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

        {changes.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm bg-slate-800/40 rounded-lg border border-slate-700">
            No capability-related changes were detected in this transcript.
          </div>
        ) : (
          <>
            {/* Bulk actions */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button onClick={selectAll}      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition">Select all</button>
              <button onClick={deselectAll}    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition">Deselect all</button>
              <button onClick={selectHighConf} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200 transition">High confidence (≥ 80%)</button>
              <span className="ml-auto text-xs text-slate-400">{selectedCount} / {changes.length} selected</span>
            </div>

            {/* Structural changes */}
            {structural.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Structural changes <span className="text-slate-500 normal-case">({structural.length})</span>
                </h2>
                <div className="space-y-1.5">
                  {structural.map((c) => (
                    <ChangeRow key={c.id} change={c} onToggle={toggleChange} disabled={phase !== "review"} />
                  ))}
                </div>
              </section>
            )}

            {/* Style / legend changes */}
            {styleAndLegend.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Style &amp; legend <span className="text-slate-500 normal-case">({styleAndLegend.length})</span>
                </h2>
                <div className="space-y-1.5">
                  {styleAndLegend.map((c) => (
                    <ChangeRow key={c.id} change={c} onToggle={toggleChange} disabled={phase !== "review"} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer actions */}
        {phase === "review" && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-slate-700/60">
            <button
              onClick={handleApply}
              disabled={selectedCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-6 py-2 rounded font-medium text-sm transition"
            >
              Apply {selectedCount} change{selectedCount !== 1 ? "s" : ""}
            </button>
            <button
              onClick={() => router.back()}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm transition"
            >
              Cancel
            </button>
          </div>
        )}

        {phase === "applying" && (
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full animate-pulse" style={{ width: "80%" }} />
            </div>
            <p className="text-slate-400 text-sm mt-2">Applying changes to diagram…</p>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-lg">
            <p className="text-emerald-400 font-medium text-sm">✓ Changes applied to the diagram</p>
            <p className="text-slate-400 text-xs mt-1">
              The selected changes have been committed. Open the dashboard to see the updated map.
            </p>
            <button
              onClick={() => catalogId && router.push(`/dashboard?catalogId=${catalogId}`)}
              className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm transition"
            >
              Go to diagram →
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── ChangeRow ──────────────────────────────────────────────────────────────

function ChangeRow({
  change,
  onToggle,
  disabled,
}: {
  change: ProposedChange;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const badge = ACTION_BADGE[change.command?.type ?? ""] ?? { label: change.command?.type ?? "?", cls: "bg-slate-600 text-slate-300" };
  const confColor =
    change.confidence >= 0.85 ? "text-emerald-400" :
    change.confidence >= 0.6  ? "text-amber-400"   : "text-red-400";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors
        ${change.selected ? "bg-slate-800 border-blue-500/40" : "bg-slate-900/60 border-slate-700/50 opacity-50"}
        ${disabled ? "pointer-events-none" : "cursor-pointer hover:border-slate-500"}`}
      onClick={() => !disabled && onToggle(change.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={change.selected}
        onChange={() => onToggle(change.id)}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 rounded accent-blue-500 shrink-0"
      />

      {/* Action badge */}
      <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
        {badge.label}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-100 leading-snug">{change.todo_text}</p>
        {change.source_quote && (
          <p className="text-[11px] text-slate-500 italic mt-0.5 truncate">
            &ldquo;{change.source_quote}&rdquo;
          </p>
        )}
      </div>

      {/* Confidence */}
      <span className={`shrink-0 text-xs font-mono ${confColor}`}>
        {Math.round(change.confidence * 100)}%
      </span>
    </div>
  );
}
