"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ProgressBar from "./ProgressBar";
import TranscriptUpload from "./TranscriptUpload";
import type {
  MeetingTranscript,
  TranscriptMode,
  TranscriptProposal,
  NodeProposalPayload,
  CommandProposalPayload,
  TodoProposalPayload,
} from "@/types/transcript";

interface Props {
  mode: TranscriptMode;
  catalogId?: string;
  onClose: () => void;
  /** Called after apply completes — receives new or updated catalogId */
  onApplied?: (catalogId: string) => void;
}

type Tab = "summary" | "nodes" | "commands" | "todos";
type Stage = "upload" | "processing" | "review" | "applying" | "done" | "error";

interface ProposalGroup {
  nodes: TranscriptProposal[];
  commands: TranscriptProposal[];
  todos: TranscriptProposal[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

export default function TranscriptReviewModal({ mode, catalogId, onClose, onApplied }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<MeetingTranscript | null>(null);
  const [proposals, setProposals] = useState<ProposalGroup>({ nodes: [], commands: [], todos: [] });
  const [tab, setTab] = useState<Tab>(mode === "new_diagram" ? "nodes" : "commands");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyDebug, setApplyDebug] = useState<{
    selected: number; applied: number; failed: number;
    nodesCreated: number; catalogId: string;
    messages: string[]; errors: string[];
  } | null>(null);

  // After pipeline finishes, load proposals
  const loadReview = useCallback(async (id: string) => {
    const res = await fetch(`/api/transcripts/${id}`);
    if (!res.ok) { setErrorMsg("Failed to load results"); setStage("error"); return; }
    const data = await res.json();
    setTranscript(data.transcript);
    setProposals(data.proposals);
    setStage("review");
  }, []);

  const handleCreated = (id: string) => {
    setTranscriptId(id);
    setStage("processing");
  };

  const handleDone = useCallback(() => {
    if (transcriptId) loadReview(transcriptId);
  }, [transcriptId, loadReview]);

  const handlePipelineError = (msg: string) => {
    setErrorMsg(msg);
    setStage("error");
  };

  // Toggle checkbox for a proposal
  async function toggleSelection(proposal: TranscriptProposal) {
    const newSelected = !proposal.selected;
    // Optimistic update
    setProposals((prev) => {
      const update = (arr: TranscriptProposal[]) =>
        arr.map((p) => (p.id === proposal.id ? { ...p, selected: newSelected } : p));
      return { nodes: update(prev.nodes), commands: update(prev.commands), todos: update(prev.todos) };
    });
    await fetch(`/api/transcripts/${transcriptId}/proposals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: [{ id: proposal.id, selected: newSelected }] }),
    });
  }

  // Select / deselect all within a kind
  async function toggleAll(kind: keyof ProposalGroup, selected: boolean) {
    const items = proposals[kind];
    setProposals((prev) => ({
      ...prev,
      [kind]: prev[kind].map((p) => ({ ...p, selected })),
    }));
    await fetch(`/api/transcripts/${transcriptId}/proposals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: items.map((p) => ({ id: p.id, selected })) }),
    });
  }

  async function apply() {
    if (!transcriptId) return;
    setApplying(true);
    setStage("applying");
    const selectedCommands = proposals.commands.filter((p) => p.selected).length;
    const res = await fetch(`/api/transcripts/${transcriptId}/apply`, { method: "POST" });
    const data = await res.json();
    setApplying(false);
    if (!res.ok) { setErrorMsg(data.error ?? "Apply failed"); setStage("error"); return; }
    setApplyDebug({
      selected: selectedCommands,
      applied: data.appliedCount ?? 0,
      failed: data.failedCount ?? 0,
      nodesCreated: data.nodesCreated ?? 0,
      catalogId: data.catalogId ?? "",
      messages: data.messages ?? [],
      errors: data.errors ?? [],
    });
    setStage("done");
    if (data.catalogId && onApplied) onApplied(data.catalogId);
    if (data.catalogId && mode === "new_diagram" && process.env.NODE_ENV !== "development") {
      router.push(`/dashboard?catalogId=${data.catalogId}`);
    }
  }

  const selectedCount =
    proposals.nodes.filter((p) => p.selected).length +
    proposals.commands.filter((p) => p.selected).length +
    proposals.todos.filter((p) => p.selected).length;

  // Derive tabs dynamically: use commands tab if any command proposals exist (e.g. template-based new_diagram)
  const tabs: Tab[] = [
    "summary",
    ...(proposals.nodes.length > 0 || (mode === "new_diagram" && proposals.commands.length === 0) ? ["nodes" as const] : []),
    ...(proposals.commands.length > 0 || mode === "edit_diagram" ? ["commands" as const] : []),
    "todos",
  ];

  // Auto-switch to correct content tab once proposals load
  useEffect(() => {
    if (mode === "new_diagram" && proposals.nodes.length > 0) setTab("nodes");
    else if (proposals.commands.length > 0) setTab("commands");
    else if (proposals.nodes.length > 0) setTab("nodes");
  }, [proposals.commands.length, proposals.nodes.length]);

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {stage === "upload" && "Start with Transcript"}
              {stage === "processing" && "Analysing Transcript…"}
              {(stage === "review" || stage === "applying") && (transcript?.title ?? "Review Proposals")}
              {stage === "done" && "Applied Successfully"}
              {stage === "error" && "Something went wrong"}
            </h2>
            {transcript?.meeting_date && (
              <p className="text-xs text-slate-400">{new Date(transcript.meeting_date).toLocaleDateString()}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Upload stage */}
          {stage === "upload" && (
            <TranscriptUpload mode={mode} catalogId={catalogId} onCreated={handleCreated} />
          )}

          {/* Processing stage */}
          {stage === "processing" && transcriptId && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <p className="text-sm text-slate-600">Running 3-pass AI analysis…</p>
              <div className="w-full max-w-sm">
                <ProgressBar transcriptId={transcriptId} onDone={handleDone} onError={handlePipelineError} />
              </div>
            </div>
          )}

          {/* Review stage */}
          {(stage === "review" || stage === "applying") && (
            <>
              {/* Tabs */}
              <div className="mb-4 flex gap-1 border-b">
                {tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                      ${tab === t ? "border-b-2 border-brand-500 text-brand-700" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {t === "nodes" && `Nodes (${proposals.nodes.length})`}
                    {t === "commands" && `Commands (${proposals.commands.length})`}
                    {t === "todos" && `TODOs (${proposals.todos.length})`}
                    {t === "summary" && "Summary"}
                  </button>
                ))}
              </div>

              {/* Summary tab */}
              {tab === "summary" && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {transcript?.summary ?? "No summary generated."}
                </div>
              )}

              {/* Nodes tab */}
              {tab === "nodes" && (
                <ProposalList
                  items={proposals.nodes}
                  kind="node"
                  onToggle={toggleSelection}
                  onToggleAll={(s) => toggleAll("nodes", s)}
                  renderPayload={(p) => {
                    const n = p.payload as NodeProposalPayload;
                    return (
                      <span>
                        <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          L{n.level}
                        </span>
                        {n.name}
                        {n.description && <span className="ml-2 text-xs text-slate-400">{n.description}</span>}
                      </span>
                    );
                  }}
                />
              )}

              {/* Commands tab */}
              {tab === "commands" && (
                <ProposalList
                  items={proposals.commands}
                  kind="command"
                  onToggle={toggleSelection}
                  onToggleAll={(s) => toggleAll("commands", s)}
                  renderPayload={(p) => {
                    const c = p.payload as CommandProposalPayload;
                    return (
                      <span>
                        <span className="mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono text-blue-700">
                          {c.type}
                        </span>
                        {c.rationale ?? ""}
                        {p.source_quote && (
                          <span className="mt-0.5 block text-xs text-slate-400 italic">
                            "{p.source_quote}"
                          </span>
                        )}
                      </span>
                    );
                  }}
                />
              )}

              {/* TODOs tab */}
              {tab === "todos" && (
                <ProposalList
                  items={proposals.todos}
                  kind="todo"
                  onToggle={toggleSelection}
                  onToggleAll={(s) => toggleAll("todos", s)}
                  renderPayload={(p) => {
                    const t = p.payload as TodoProposalPayload;
                    return (
                      <span className="flex flex-col gap-0.5">
                        <span>{t.text}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-400">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>
                            {t.priority}
                          </span>
                          {t.owner && <span>Owner: {t.owner}</span>}
                          {t.targetName && <span>→ {t.targetName}</span>}
                        </span>
                        {p.source_quote && (
                          <span className="text-xs text-slate-400 italic">"{p.source_quote}"</span>
                        )}
                      </span>
                    );
                  }}
                />
              )}
            </>
          )}

          {/* Applying */}
          {stage === "applying" && applying && (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              Applying changes…
            </div>
          )}

          {/* Done */}
          {stage === "done" && (
            <div className="flex flex-col gap-4 py-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                  <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600">
                  {mode === "new_diagram"
                    ? (process.env.NODE_ENV === "development" ? "Diagram created." : "Diagram created. Redirecting…")
                    : "Diagram updated successfully."}
                </p>
                {process.env.NODE_ENV === "development" && mode === "new_diagram" && applyDebug?.catalogId && (
                  <button
                    onClick={() => router.push(`/dashboard?catalogId=${applyDebug.catalogId}`)}
                    className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Go to Diagram →
                  </button>
                )}
              </div>

              {/* Dev-only detailed debug panel */}
              {process.env.NODE_ENV === "development" && applyDebug && (
                <DevDebugPanel
                  transcriptId={transcriptId}
                  applyDebug={applyDebug}
                  proposals={proposals}
                  transcript={transcript}
                />
              )}
            </div>
          )}

          {/* Error */}
          {stage === "error" && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {errorMsg ?? "An unexpected error occurred."}
            </div>
          )}
        </div>

        {/* Footer */}
        {stage === "review" && (
          <div className="flex items-center justify-between border-t px-6 py-3">
            <span className="text-xs text-slate-500">{selectedCount} item{selectedCount !== 1 ? "s" : ""} selected</span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={selectedCount === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Apply {selectedCount} selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null;
}

// ── Proposal list sub-component ───────────────────────────────────────────────

function ProposalList({
  items,
  onToggle,
  onToggleAll,
  renderPayload,
}: {
  items: TranscriptProposal[];
  kind: string;
  onToggle: (p: TranscriptProposal) => void;
  onToggleAll: (selected: boolean) => void;
  renderPayload: (p: TranscriptProposal) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No proposals in this category.</p>;
  }

  const allSelected = items.every((p) => p.selected);

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <button onClick={() => onToggleAll(!allSelected)} className="hover:text-brand-600">
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      {items.map((p) => (
        <label
          key={p.id}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors
            ${p.selected ? "border-brand-200 bg-brand-50" : "border-slate-100 hover:bg-slate-50"}`}
        >
          <input
            type="checkbox"
            checked={p.selected}
            onChange={() => onToggle(p)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <div className="flex-1 text-sm text-slate-700">{renderPayload(p)}</div>
          <span
            className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium
              ${p.confidence >= 0.8 ? "bg-green-100 text-green-700" : p.confidence >= 0.6 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}
          >
            {Math.round(p.confidence * 100)}%
          </span>
        </label>
      ))}
    </div>
  );
}

// ── Dev Debug Panel ───────────────────────────────────────────────────────────

type DebugTab = "summary" | "llm_output" | "execution";

function DevDebugPanel({
  transcriptId,
  applyDebug,
  proposals,
  transcript,
}: {
  transcriptId: string | null;
  applyDebug: {
    selected: number; applied: number; failed: number;
    nodesCreated: number; catalogId: string;
    messages: string[]; errors: string[];
  };
  proposals: { nodes: TranscriptProposal[]; commands: TranscriptProposal[]; todos: TranscriptProposal[] };
  transcript: MeetingTranscript | null;
}) {
  const [debugTab, setDebugTab] = useState<DebugTab>("summary");

  const totalProposals = proposals.nodes.length + proposals.commands.length + proposals.todos.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
      <p className="mb-3 font-semibold text-slate-700 text-sm">🛠 Dev — Pipeline Debug</p>

      {/* Tab buttons */}
      <div className="mb-3 flex gap-1 border-b border-slate-200">
        {(["summary", "llm_output", "execution"] as DebugTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setDebugTab(t)}
            className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors
              ${debugTab === t ? "border-b-2 border-brand-500 text-brand-700" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t === "summary" && "Summary"}
            {t === "llm_output" && `LLM Output (${totalProposals})`}
            {t === "execution" && `Execution (${applyDebug.applied + applyDebug.failed})`}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {debugTab === "summary" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-white p-2 border border-slate-100">
              <p className="text-slate-400 mb-0.5">Transcript ID</p>
              <p className="font-mono text-slate-700 truncate">{transcriptId}</p>
            </div>
            <div className="rounded bg-white p-2 border border-slate-100">
              <p className="text-slate-400 mb-0.5">Mode</p>
              <p className="font-medium text-slate-700">{transcript?.mode ?? "—"}</p>
            </div>
            <div className="rounded bg-white p-2 border border-slate-100">
              <p className="text-slate-400 mb-0.5">Context Prompt</p>
              <p className="text-slate-700 line-clamp-2">{transcript?.context_prompt || "None"}</p>
            </div>
            <div className="rounded bg-white p-2 border border-slate-100">
              <p className="text-slate-400 mb-0.5">AI Summary</p>
              <p className="text-slate-700 line-clamp-2">{transcript?.summary || "—"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">
              Nodes: <strong>{proposals.nodes.length}</strong>
            </span>
            <span className="rounded bg-purple-50 px-2 py-1 text-purple-700">
              Commands: <strong>{proposals.commands.length}</strong>
            </span>
            <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">
              TODOs: <strong>{proposals.todos.length}</strong>
            </span>
            <span className="rounded bg-green-50 px-2 py-1 text-green-700">
              Executed: <strong>{applyDebug.applied}</strong>
            </span>
            {applyDebug.failed > 0 && (
              <span className="rounded bg-red-50 px-2 py-1 text-red-700">
                Failed: <strong>{applyDebug.failed}</strong>
              </span>
            )}
            {applyDebug.nodesCreated > 0 && (
              <span className="rounded bg-green-50 px-2 py-1 text-green-700">
                Nodes created: <strong>{applyDebug.nodesCreated}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* LLM Output tab — full list of proposals as returned by the AI */}
      {debugTab === "llm_output" && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {proposals.nodes.length > 0 && (
            <div>
              <p className="font-medium text-blue-700 mb-1">Node Proposals ({proposals.nodes.length})</p>
              {proposals.nodes.map((p, i) => {
                const n = p.payload as NodeProposalPayload;
                return (
                  <div key={i} className="mb-1 rounded bg-white border border-slate-100 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1 text-slate-500">L{n.level}</span>
                      <span className="font-medium text-slate-800">{n.name}</span>
                      <span className={`ml-auto rounded px-1 text-xs ${p.selected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {p.selected ? "✓" : "—"}
                      </span>
                    </div>
                    {n.description && <p className="text-slate-500 mt-0.5">{n.description}</p>}
                  </div>
                );
              })}
            </div>
          )}
          {proposals.commands.length > 0 && (
            <div>
              <p className="font-medium text-purple-700 mb-1">Command Proposals ({proposals.commands.length})</p>
              {proposals.commands.map((p, i) => {
                const c = p.payload as CommandProposalPayload;
                return (
                  <div key={i} className="mb-1 rounded bg-white border border-slate-100 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-50 px-1 font-mono text-purple-700">{c.type}</span>
                      <span className="text-slate-700 truncate flex-1">{c.rationale ?? ""}</span>
                      <span className={`rounded px-1 text-xs ${p.selected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {p.selected ? "✓" : "—"}
                      </span>
                    </div>
                    <pre className="text-slate-500 mt-0.5 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(c, null, 0).slice(0, 200)}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
          {proposals.todos.length > 0 && (
            <div>
              <p className="font-medium text-amber-700 mb-1">TODO Proposals ({proposals.todos.length})</p>
              {proposals.todos.map((p, i) => {
                const t = p.payload as TodoProposalPayload;
                return (
                  <div key={i} className="mb-1 rounded bg-white border border-slate-100 px-2 py-1.5">
                    <span className="text-slate-700">{t.text}</span>
                    {t.owner && <span className="ml-1 text-slate-400">({t.owner})</span>}
                  </div>
                );
              })}
            </div>
          )}
          {totalProposals === 0 && (
            <p className="text-slate-400 py-4 text-center">No proposals generated.</p>
          )}
        </div>
      )}

      {/* Execution tab — what executeCommands actually did */}
      {debugTab === "execution" && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="rounded bg-slate-200 px-2 py-1">
              Selected: <strong>{applyDebug.selected}</strong>
            </span>
            <span className="rounded bg-green-100 px-2 py-1 text-green-700">
              Success: <strong>{applyDebug.applied}</strong>
            </span>
            {applyDebug.failed > 0 && (
              <span className="rounded bg-red-100 px-2 py-1 text-red-700">
                Failed: <strong>{applyDebug.failed}</strong>
              </span>
            )}
            {applyDebug.nodesCreated > 0 && (
              <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">
                Nodes created: <strong>{applyDebug.nodesCreated}</strong>
              </span>
            )}
          </div>

          {applyDebug.messages.length > 0 && (
            <div>
              <p className="font-medium text-green-700 mb-1">✓ Executed Commands</p>
              <ul className="space-y-0.5">
                {applyDebug.messages.map((m, i) => (
                  <li key={i} className="rounded bg-white border border-green-100 px-2 py-1 text-slate-700">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {applyDebug.errors.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-red-700 mb-1">✗ Failed Commands</p>
              <ul className="space-y-0.5">
                {applyDebug.errors.map((e, i) => (
                  <li key={i} className="rounded bg-white border border-red-100 px-2 py-1 text-red-600">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {applyDebug.messages.length === 0 && applyDebug.errors.length === 0 && applyDebug.nodesCreated === 0 && (
            <p className="text-slate-400 py-4 text-center">No commands were executed (nodes created directly).</p>
          )}
        </div>
      )}
    </div>
  );
}
