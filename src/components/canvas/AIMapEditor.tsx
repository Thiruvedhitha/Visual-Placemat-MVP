"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Capability } from "@/types/capability";
import type { DiagramCommand, NodeStylePatch, Proposal } from "@/lib/commands/index";
import type { CapabilityNodeData } from "./CapabilityNode";
import { useCatalogStore } from "@/stores/catalogStore";
import { showToast } from "@/components/ui/Toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS = ["L0 domain", "L1 group", "L2 subgroup", "L3 leaf"];

const LEVEL_BG_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d", 1: "#2563eb", 2: "#599dff", 3: "#ffffff",
};
const LEVEL_BORDER_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d", 1: "#2563eb", 2: "#599dff", 3: "#d1e3ff",
};

type Scope = "map" | "node";
type ChatMessage =
  | { role: "user"; text: string; ts?: string }
  | { role: "ai"; text: string; ts?: string; proposals?: Proposal[] };

/** Returns true when the user wants suggestions rather than direct changes */
function isSuggestionPrompt(text: string): boolean {
  const lower = text.toLowerCase();
  const hasSuggestionWord = /\b(suggest|suggestion|recommend|recommendation|review|audit|check|analyze|analyse|what if|could you|identify|are there|show me|flag|find gaps)\b/.test(lower);
  const hasDirectActionWord = /\b(rename|delete|remove|add|create|move|reparent|set the|update|change the)\b/.test(lower);
  return hasSuggestionWord && !hasDirectActionWord;
}

/** Returns true for conversational/informational queries that need a plain text answer */
function isInfoPrompt(text: string): boolean {
  const lower = text.toLowerCase();
  const hasInfoWord = /\b(list|show|display|what are|what is|how many|count|tell me|which|describe|overview|summarize|summary|give me|print|enumerate)\b/.test(lower);
  const hasActionWord = /\b(rename|delete|remove|add|create|move|reparent|set|update|change|suggest|recommend)\b/.test(lower);
  return hasInfoWord && !hasActionWord;
}

const AI_QUICK_ACTIONS: { icon: string; label: string; prompt: string; mode: "suggest" }[] = [
  { icon: "✎", label: "Rename node",       mode: "suggest", prompt: "Suggest better names for any nodes in this map that are unclear, inconsistent, or could be improved." },
  { icon: "◐", label: "Modify properties", mode: "suggest", prompt: "Suggest property changes for nodes in this map — such as background color, border color, or reparenting to a better location in the hierarchy." },
];

function makeUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} wk${weeks > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} mo${months > 1 ? "s" : ""} ago`;
}

// ── Legend command reference panel ───────────────────────────────────────────

const LEGEND_CMD_GROUPS = [
  {
    slot: "fill" as const,
    label: "Background (fill) categories",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/20",
    bgColor: "bg-emerald-500/5",
    commands: [
      { op: "Create", phrase: 'mark as [label] with [color]', example: 'mark as "We have" with green' },
      { op: "Modify", phrase: 'rename [old] to [new] / change colour of [label] to [color]', example: 'rename "client category" to "Already available"' },
      { op: "Delete", phrase: 'remove the [label] category', example: 'delete the "Maybe" category' },
    ],
  },
  {
    slot: "border" as const,
    label: "Border categories",
    color: "text-violet-400",
    borderColor: "border-violet-500/20",
    bgColor: "bg-violet-500/5",
    commands: [
      { op: "Create", phrase: 'add border category [label] with [color]', example: 'add border "In progress" with orange' },
      { op: "Modify", phrase: 'change [label] border colour to [color]', example: 'change "Blocked" border to red' },
      { op: "Delete", phrase: 'remove border category [label]', example: 'remove border category "Apptio Tool"' },
    ],
  },
];

function LegendCommandRef() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex-shrink-0 border-b border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition hover:text-slate-300"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Legend commands
        </span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-2.5 px-4 pb-3">
          {LEGEND_CMD_GROUPS.map((group) => (
            <div key={group.slot} className={`rounded-lg border ${group.borderColor} ${group.bgColor} p-2.5 space-y-1.5`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${group.color}`}>{group.label}</p>
              {group.commands.map((cmd) => (
                <div key={cmd.op} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      cmd.op === "Create" ? "bg-emerald-500/20 text-emerald-300" :
                      cmd.op === "Modify" ? "bg-amber-500/20 text-amber-300" :
                      "bg-red-500/20 text-red-300"
                    }`}>{cmd.op}</span>
                    <span className="text-[10px] text-slate-400 italic">{cmd.phrase}</span>
                  </div>
                  <p className="pl-8 text-[9px] text-slate-600">e.g. "{cmd.example}"</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AIMapEditorProps {
  open: boolean;
  onClose: () => void;
  capabilities: Capability[];
  nodeStyles: Record<string, NodeStylePatch>;
  selectedNodeId: string | null;
  onEnterPickMode: () => void;
  onExitPickMode: () => void;
  pickMode: boolean;
  onAICommands: (commands: DiagramCommand[]) => string[];
  onUpdateNode?: (id: string, patch: Partial<CapabilityNodeData & NodeStylePatch>) => void;
  onPickNode?: (id: string) => void;
}

// ── Supabase chat helpers ────────────────────────────────────────────────────

async function loadHistoryFromDB(catalogId: string | null): Promise<{ messages: ChatMessage[]; commits: CommitEntry[]; sessions: ArchivedSession[] }> {
  if (!catalogId) return { messages: [], commits: [], sessions: [] };
  try {
    const res = await fetch(`/api/chat?catalogId=${catalogId}`);
    if (!res.ok) return { messages: [], commits: [], sessions: [] };
    const data = await res.json();
    const messages = (data.messages ?? []).map((m: { role: string; text: string; ts?: string }) => ({
      role: m.role as "user" | "ai",
      text: m.text,
      ...(m.ts ? { ts: m.ts } : {}),
    }));
    return { messages, commits: data.commits ?? [], sessions: data.sessions ?? [] };
  } catch {
    return { messages: [], commits: [], sessions: [] };
  }
}

async function saveMessagesToDB(catalogId: string | null, msgs: { role: string; text: string }[]) {
  console.log("[chat] saveMessagesToDB called — catalogId:", catalogId, "msgs:", msgs.length);
  if (!catalogId) {
    console.log("[chat] Skipping save — no catalogId (catalog not yet saved to DB)");
    return;
  }
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, messages: msgs }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[chat] Failed to save messages:", err);
    } else {
      console.log("[chat] Messages saved successfully");
    }
  } catch (e) {
    console.error("[chat] Network error saving messages:", e);
  }
}

async function clearHistoryFromDB(catalogId: string | null) {
  if (!catalogId) return;
  try {
    await fetch(`/api/chat?catalogId=${catalogId}`, { method: "DELETE" });
  } catch {
    // silently skip
  }
}

type CommitEntry = {
  prompt: string;
  summary: string;
  adds: number;
  deletes: number;
  renames: number;
  styles: number;
  ts: string;
};

type ArchivedSession = {
  name: string;
  messages: { role: string; text: string; ts?: string }[];
  commits: CommitEntry[];
  ts: string;
};

async function saveCommitToDB(catalogId: string | null, commit: CommitEntry) {
  if (!catalogId) return;
  try {
    await fetch("/api/chat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, commit }),
    });
  } catch {
    // silently skip
  }
}

async function archiveSessionToDB(catalogId: string | null) {
  if (!catalogId) return;
  try {
    await fetch("/api/chat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, archiveSession: true }),
    });
  } catch {
    // silently skip
  }
}

function summarizeCommands(commands: import("@/lib/commands/index").DiagramCommand[]): Omit<CommitEntry, "prompt" | "summary" | "ts"> {
  let adds = 0, deletes = 0, renames = 0, styles = 0;
  for (const cmd of commands) {
    switch (cmd.type) {
      case "ADD_NODE": adds++; break;
      case "DELETE_NODE": deletes++; break;
      case "RENAME_NODE": renames++; break;
      case "SET_STYLE": styles++; break;
      case "REPARENT_NODE": renames++; break; // count as modification
      case "SET_NOTE": case "SET_DESCRIPTION": styles++; break;
    }
  }
  return { adds, deletes, renames, styles };
}

// ── SessionRow (for History tab) ──────────────────────────────────────────────

function SessionRow({ session, msgCount, commitCount, totalAdds, totalDeletes, onOpen }: {
  session: ArchivedSession;
  msgCount: number;
  commitCount: number;
  totalAdds: number;
  totalDeletes: number;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-white/5">
      {/* Main row — click to open the chat */}
      <button
        onClick={onOpen}
        className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        {/* Chevron to expand commits inline */}
        <svg
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium leading-snug text-slate-200 line-clamp-2">{session.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500">{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
            {totalAdds > 0 && <span className="text-[10px] font-semibold text-emerald-400">+{totalAdds}</span>}
            {totalDeletes > 0 && <span className="text-[10px] font-semibold text-red-400">-{totalDeletes}</span>}
            <span className="text-[10px] text-slate-600">{session.ts ? timeAgo(session.ts) : ""}</span>
          </div>
        </div>
        <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-white/5 bg-white/[0.02] px-4 py-2 space-y-1.5">
          {session.commits.length > 0 ? (
            session.commits.map((c, ci) => (
              <div key={ci} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-300 line-clamp-1">{c.summary}</p>
                  <div className="flex items-center gap-2">
                    {c.adds > 0 && <span className="text-[10px] font-semibold text-emerald-400">+{c.adds}</span>}
                    {c.deletes > 0 && <span className="text-[10px] font-semibold text-red-400">-{c.deletes}</span>}
                    {c.renames > 0 && <span className="text-[10px] font-semibold text-amber-400">~{c.renames}</span>}
                    {c.styles > 0 && <span className="text-[10px] font-semibold text-violet-400">◉{c.styles}</span>}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-slate-600 italic">Conversation only — no map changes</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIMapEditor({
  open,
  onClose,
  capabilities,
  nodeStyles,
  selectedNodeId,
  onEnterPickMode,
  onExitPickMode,
  pickMode: _pickMode,
  onAICommands,
  onUpdateNode,
  onPickNode,
}: AIMapEditorProps) {
  const [scope, setScope] = useState<Scope>("map");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [viewingSession, setViewingSession] = useState<ArchivedSession | null>(null);
  // Per-message proposal state: messageIndex -> proposalId -> status
  const [proposalStates, setProposalStates] = useState<Record<number, Record<string, "pending" | "accepted" | "declined">>>({});
  // Form state for Add / Delete quick actions
  const [activeForm, setActiveForm] = useState<"add" | "delete" | null>(null);
  const [addName, setAddName] = useState("");
  const [addLevel, setAddLevel] = useState<number>(1);
  const [addParentId, setAddParentId] = useState("");
  const [deleteNodeId, setDeleteNodeId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Derive catalogId from Zustand store (real DB UUID only)
  const storeCatalogId = useCatalogStore((s) => s.catalogId);
  const capCatalogId = capabilities[0]?.catalog_id;
  // Only use a catalogId that looks like a real UUID (not "unsaved", "default", temp IDs, etc.)
  const isValidUUID = (id: string | null | undefined): id is string =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const catalogId = isValidUUID(storeCatalogId) ? storeCatalogId : isValidUUID(capCatalogId) ? capCatalogId : null;
  const prevCatalogIdRef = useRef<string | null>(catalogId);
  const flushedRef = useRef(false);

  // Load persisted history from Supabase when the panel opens or the scope changes
  // But NOT when catalogId changes from null→UUID (first Apply) — keep in-memory messages
  useEffect(() => {
    if (open) {
      const prev = prevCatalogIdRef.current;
      const isFirstSave = !prev && catalogId;
      if (!isFirstSave) {
        loadHistoryFromDB(catalogId).then(({ messages: msgs, commits: cmts, sessions: sess }) => {
          setMessages(msgs);
          setCommits(cmts);
          setSessions(sess);
        });
        setProposalStates({});
        setActiveForm(null);
      }
      setInputText("");
    }
  }, [open, scope, catalogId]);

  // When catalogId changes from null to a real UUID (after first Apply),
  // flush all in-memory messages to the DB retroactively (once only)
  useEffect(() => {
    const prev = prevCatalogIdRef.current;
    if (!prev && catalogId && !flushedRef.current && messages.length > 0) {
      flushedRef.current = true;
      const allMsgs = messages.map((m) => ({ role: m.role, text: m.text }));
      saveMessagesToDB(catalogId, allMsgs);
    }
    prevCatalogIdRef.current = catalogId;
  }, [catalogId, messages, scope]);

  // No longer auto-persist to localStorage — messages are saved per-turn via API

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeForm]);

  useEffect(() => {
    if (scope === "node") onEnterPickMode();
    else onExitPickMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const clearHistory = useCallback(() => {
    clearHistoryFromDB(catalogId);
    setMessages([]);
    setCommits([]);
    setSessions([]);
    setProposalStates({});
    setActiveForm(null);
    setViewingSession(null);
  }, [catalogId]);

  const startNewChat = useCallback(() => {
    if (messages.length === 0) return; // nothing to archive
    // Build session locally
    const firstUserMsg = messages.find(m => m.role === "user");
    const sessionName = firstUserMsg?.text?.slice(0, 80) || "Untitled chat";
    const session: ArchivedSession = {
      name: sessionName,
      messages: messages.map(m => ({ role: m.role, text: m.text, ts: m.ts })),
      commits: [...commits],
      ts: new Date().toISOString(),
    };
    setSessions(prev => [...prev, session]);
    // Clear active chat
    setMessages([]);
    setCommits([]);
    setProposalStates({});
    setActiveForm(null);
    // Persist to DB
    archiveSessionToDB(catalogId);
    setActiveTab("chat");
    setViewingSession(null);
  }, [messages, commits, catalogId]);

  const targetNode = scope === "node" && selectedNodeId
    ? capabilities.find((c) => c.id === selectedNodeId) ?? null
    : null;
  const parentCap = targetNode?.parent_id
    ? capabilities.find((c) => c.id === targetNode.parent_id) ?? null
    : null;
  const grandparentCap = parentCap?.parent_id
    ? capabilities.find((c) => c.id === parentCap.parent_id) ?? null
    : null;
  const validParents = targetNode
    ? capabilities.filter((c) => c.level === targetNode.level - 1)
    : [];
  const currentStyle = targetNode ? (nodeStyles[targetNode.id] ?? {}) : {};

  const buildPrompt = useCallback(
    (userText: string) => {
      if (scope === "node" && targetNode) {
        return `[Scope: single node — "${targetNode.name}" (L${targetNode.level})${
          parentCap ? `, under "${parentCap.name}"` : ""
        }]\n\n${userText}`;
      }
      // In map scope, if a node is selected on the canvas inject it so the AI
      // can resolve "it", "this", "the selected node" to the exact ID.
      if (scope === "map" && selectedNodeId) {
        const sel = capabilities.find((c) => c.id === selectedNodeId);
        if (sel) {
          return `[CANVAS SELECTION — the user currently has this node selected on the canvas:\n  name: "${sel.name}" | level: L${sel.level} | id: ${sel.id}\n  When the user says "it", "this", "the selected node", or refers to a node without naming it, they mean THIS node. Always use id "${sel.id}" — never guess by name alone.]\n\n${userText}`;
        }
      }
      return userText;
    },
    [scope, targetNode, parentCap, selectedNodeId, capabilities]
  );

  const sendMessage = useCallback(
    async (text: string, explicitMode?: "command" | "suggest" | "chat") => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      if (scope === "node" && !targetNode) return;

      setInputText("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      const now = new Date().toISOString();
      setMessages((prev) => [...prev, { role: "user", text: trimmed, ts: now }]);
      setIsLoading(true);

      const mode = explicitMode ?? (isInfoPrompt(trimmed) ? "chat" : isSuggestionPrompt(trimmed) ? "suggest" : "command");

      // Save user message to DB
      saveMessagesToDB(catalogId, [{ role: "user", text: trimmed }]);

      try {
        // Build history — for proposal messages, include what was accepted/declined
        const history = messages.flatMap((m, idx) => {
          if (m.role === "user") return [{ role: "user" as const, content: m.text }];
          if (m.proposals && m.proposals.length > 0) {
            const pState = proposalStates[idx] ?? {};
            const lines: string[] = [];
            m.proposals.forEach((p) => {
              const status = pState[p.id] ?? "pending";
              if (status === "accepted") lines.push(`[APPLIED] ${p.description}`);
              else if (status === "declined") lines.push(`[DECLINED] ${p.description}`);
            });
            const content = lines.length > 0 ? lines.join("\n") : m.text;
            return [{ role: "assistant" as const, content }];
          }
          return [{ role: "assistant" as const, content: m.text }];
        });

        const controller = new AbortController();
        // Allow up to 60 seconds for rate-limit retries (5s + 10s + 20s + call time)
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const res = await fetch("/api/transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          // Always read capabilities from the store at call-time so renamed/added nodes are fresh
          body: JSON.stringify({ prompt: buildPrompt(trimmed), capabilities: useCatalogStore.getState().capabilities, nodeStyles, history, mode, legend: useCatalogStore.getState().legend }),
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (!res.ok) {
          const isRateLimit = data.error?.includes("rate limit");
          const errText = isRateLimit
            ? "⏳ AI rate limit reached. Please wait a moment and try again."
            : `Error: ${data.error || "Something went wrong."}`;
          setMessages((prev) => [...prev, { role: "ai", text: errText, ts: new Date().toISOString() }]);
          saveMessagesToDB(catalogId, [{ role: "ai", text: errText }]);
          return;
        }

        if (mode === "chat") {
          const aiText = data.reply || "No information found.";
          setMessages((prev) => [...prev, { role: "ai", text: aiText, ts: new Date().toISOString() }]);
          saveMessagesToDB(catalogId, [{ role: "ai", text: aiText }]);
        } else if (mode === "suggest") {
          const proposals: Proposal[] = Array.isArray(data.proposals) ? data.proposals : [];
          const newMsg: ChatMessage = { role: "ai", text: data.summary || "Here are my suggestions:", ts: new Date().toISOString(), proposals };
          setMessages((prev) => {
            const next = [...prev, newMsg];
            // Initialise all proposals as pending
            const msgIdx = next.length - 1;
            if (proposals.length > 0) {
              setProposalStates((ps) => ({
                ...ps,
                [msgIdx]: Object.fromEntries(proposals.map((p) => [p.id, "pending" as const])),
              }));
            }
            return next;
          });
          saveMessagesToDB(catalogId, [{ role: "ai", text: data.summary || "Here are my suggestions:" }]);
        } else {
          if (Array.isArray(data.commands) && data.commands.length > 0) {
            const execErrors = onAICommands(data.commands);
            // Record commit
            const stats = summarizeCommands(data.commands);
            const commit: CommitEntry = {
              prompt: trimmed,
              summary: data.summary || "Applied changes",
              ...stats,
              ts: new Date().toISOString(),
            };
            setCommits((prev) => [...prev, commit]);
            saveCommitToDB(catalogId, commit);
            if (execErrors.length > 0) {
              const errText = `⚠️ Some commands could not be applied:\n${execErrors.map((e) => `• ${e}`).join("\n")}`;
              setMessages((prev) => [...prev, { role: "ai", text: errText, ts: new Date().toISOString() }]);
              saveMessagesToDB(catalogId, [{ role: "ai", text: errText }]);
              return;
            }
          }
          const aiText = data.summary || "Done.";
          setMessages((prev) => [...prev, { role: "ai", text: aiText, ts: new Date().toISOString() }]);
          saveMessagesToDB(catalogId, [{ role: "ai", text: aiText }]);
        }
      } catch (err) {
        const errText = err instanceof DOMException && err.name === "AbortError"
          ? "⏳ Request timed out — the AI is busy. Please wait a moment and try again."
          : "Network error. Please try again.";
        setMessages((prev) => [...prev, { role: "ai", text: errText, ts: new Date().toISOString() }]);
        saveMessagesToDB(catalogId, [{ role: "ai", text: errText }]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, scope, targetNode, buildPrompt, capabilities, nodeStyles, onAICommands, messages, proposalStates]
  );

  if (!open) return null;

  const inputDisabled = isLoading || (scope === "node" && !targetNode);

  // Valid parents for the Add form: level one above selected addLevel
  const addFormParents = capabilities.filter((c) => c.level === addLevel - 1);

  const submitAddForm = () => {
    if (!addName.trim()) return;
    const parentCap = addFormParents.find((c) => c.id === addParentId);
    const parentLabel = parentCap ? `under '${parentCap.name}'` : "(no parent — L0)";
    onAICommands([{
      type: "ADD_NODE",
      tempId: makeUUID(),
      parentId: addLevel === 0 ? null : (addParentId || null),
      level: addLevel as 0 | 1 | 2 | 3,
      name: addName.trim(),
    }]);
    setMessages((prev) => [...prev, { role: "user", text: `Added L${addLevel} node: '${addName.trim()}' ${parentLabel}` }, { role: "ai", text: `Node '${addName.trim()}' added.` }]);
    showToast.success(`Node '${addName.trim()}' added`);
    // Record commit
    const commit: CommitEntry = { prompt: `Add L${addLevel} node: ${addName.trim()}`, summary: `Added '${addName.trim()}' ${parentLabel}`, adds: 1, deletes: 0, renames: 0, styles: 0, ts: new Date().toISOString() };
    setCommits((prev) => [...prev, commit]);
    saveCommitToDB(catalogId, commit);
    setActiveForm(null);
    setAddName(""); setAddLevel(1); setAddParentId("");
  };

  const submitDeleteForm = () => {
    if (!deleteNodeId) return;
    const node = capabilities.find((c) => c.id === deleteNodeId);
    if (!node) return;
    onAICommands([{ type: "DELETE_NODE", nodeId: node.id }]);
    setMessages((prev) => [...prev, { role: "user", text: `Delete node: '${node.name}'` }, { role: "ai", text: `Node '${node.name}' deleted.` }]);
    showToast.success(`Node '${node.name}' deleted`);
    // Record commit
    const childCount = capabilities.filter((c) => c.parent_id === node.id).length;
    const commit: CommitEntry = { prompt: `Delete node: ${node.name}`, summary: `Deleted '${node.name}'${childCount > 0 ? ` and ${childCount} children` : ''}`, adds: 0, deletes: 1 + childCount, renames: 0, styles: 0, ts: new Date().toISOString() };
    setCommits((prev) => [...prev, commit]);
    saveCommitToDB(catalogId, commit);
    setActiveForm(null);
    setDeleteNodeId("");
  };

  const ScopeToggle = null;

  const ChatSection = (
    <>
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10">
        {messages.length === 0 && scope === "map" && !activeForm && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[13px] leading-relaxed text-slate-300">
            I have full context of your {capabilities.length}-node capability map. Ask me to restructure, find gaps, add nodes, rename sections, or analyse coverage.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-0.5 ${msg.role === "user" ? "text-blue-400" : "text-slate-400"}`}>
              {msg.role === "user" ? "You" : "Map AI"}
            </span>
            {/* Only show text bubble when there are no proposals (avoid duplicate/verbose message) */}
            {!(msg.role === "ai" && msg.proposals && msg.proposals.length > 0) && (
              <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "rounded-br-sm bg-blue-500 text-white"
                  : "rounded-bl-sm border border-white/10 bg-white/5 text-slate-200"
              }`}>
                {msg.text}
              </div>
            )}
            {/* Proposal cards */}
            {msg.role === "ai" && msg.proposals && msg.proposals.length > 0 && (() => {
              const pState = proposalStates[i] ?? {};
              return (
                <div className="w-full space-y-2 mt-1">
                  {msg.proposals.map((proposal) => {
                    const status = pState[proposal.id] ?? "pending";
                    return (
                      <div
                        key={proposal.id}
                        className={`rounded-xl border px-3 py-2.5 text-[12px] transition ${
                          status === "accepted"
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : status === "declined"
                            ? "border-red-500/20 bg-red-500/5 opacity-50"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <p className="leading-relaxed text-slate-200">{proposal.description}</p>
                        {status === "pending" && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => {
                                // Apply immediately on accept
                                onAICommands([proposal.command]);
                                // Auto-decline only OTHER proposals that target the SAME node
                                // (e.g. competing renames for one node). Proposals for different
                                // nodes remain independently actionable.
                                const acceptedNodeId = (proposal.command as { nodeId?: string }).nodeId;
                                const siblings = msg.proposals ?? [];
                                setProposalStates((ps) => {
                                  const current = { ...(ps[i] ?? {}) };
                                  siblings.forEach((p) => {
                                    if (p.id === proposal.id) {
                                      current[p.id] = "accepted";
                                    } else if (
                                      acceptedNodeId &&
                                      (p.command as { nodeId?: string }).nodeId === acceptedNodeId &&
                                      current[p.id] !== "accepted" &&
                                      current[p.id] !== "declined"
                                    ) {
                                      current[p.id] = "declined";
                                    }
                                  });
                                  return { ...ps, [i]: current };
                                });
                                // Record commit for accepted proposal
                                const stats = summarizeCommands([proposal.command]);
                                const commit: CommitEntry = {
                                  prompt: proposal.description,
                                  summary: "Accepted suggestion",
                                  ...stats,
                                  ts: new Date().toISOString(),
                                };
                                setCommits((prev) => [...prev, commit]);
                                saveCommitToDB(catalogId, commit);
                              }}
                              className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                setProposalStates((ps) => ({
                                  ...ps,
                                  [i]: { ...(ps[i] ?? {}), [proposal.id]: "declined" },
                                }))
                              }
                              className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              Decline
                            </button>
                          </div>
                        )}
                        {status === "accepted" && (
                          <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Accepted
                          </p>
                        )}
                        {status === "declined" && (
                          <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-red-400">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            Declined
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-[10px] font-semibold uppercase tracking-widest px-0.5 text-slate-400">Map AI</span>
            <div className="flex items-center gap-1 rounded-xl rounded-bl-sm border border-white/10 bg-white/5 px-3 py-2.5">
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />

        {/* Add form — appears at bottom after messages */}
        {activeForm === "add" && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Add a node</p>
            <div>
              <label className="text-[10px] text-slate-500">Node name</label>
              <input
                type="text"
                autoFocus
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-blue-400"
                placeholder="e.g. Performance Reporting"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAddForm(); }}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Level</label>
              <div className="mt-1 flex gap-1">
                {[0, 1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => { setAddLevel(lvl); setAddParentId(""); }}
                    className={`flex-1 rounded-md border py-1 text-[11px] font-bold transition ${
                      addLevel === lvl
                        ? "border-blue-400 bg-blue-500/20 text-white"
                        : "border-white/15 bg-white/5 text-slate-400 hover:border-blue-400 hover:text-white"
                    }`}
                  >L{lvl}</button>
                ))}
              </div>
            </div>
            {addLevel > 0 && (
              <div>
                <label className="text-[10px] text-slate-500">Parent — L{addLevel - 1} node</label>
                <select
                  className="mt-1 w-full rounded-md border border-white/15 bg-[#0f1b2d] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-400"
                  value={addParentId}
                  onChange={(e) => setAddParentId(e.target.value)}
                >
                  <option value="">— select parent —</option>
                  {addFormParents.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={submitAddForm}
                disabled={!addName.trim() || (addLevel > 0 && !addParentId)}
                className="flex-1 rounded-lg bg-blue-500 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40"
              >Add →</button>
              <button
                onClick={() => { setActiveForm(null); setAddName(""); setAddParentId(""); }}
                className="flex-1 rounded-lg border border-white/15 py-1.5 text-xs text-slate-400 transition hover:border-white/30 hover:text-white"
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Delete form — appears at bottom after messages */}
        {activeForm === "delete" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Delete a node</p>
            <div>
              <label className="text-[10px] text-slate-500">Select node to delete</label>
              <select
                className="mt-1 w-full rounded-md border border-white/15 bg-[#0f1b2d] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-red-400"
                value={deleteNodeId}
                onChange={(e) => setDeleteNodeId(e.target.value)}
              >
                <option value="">— select node —</option>
                {[0, 1, 2, 3].map((lvl) => {
                  const lvlNodes = capabilities.filter((c) => c.level === lvl);
                  if (!lvlNodes.length) return null;
                  return (
                    <optgroup key={lvl} label={`L${lvl} nodes`}>
                      {lvlNodes.map((n) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {deleteNodeId && (() => {
                const childCount = capabilities.filter((c) => c.parent_id === deleteNodeId).length;
                return childCount > 0 ? (
                  <p className="mt-1.5 text-[10px] text-amber-400">⚠ This node has {childCount} child{childCount > 1 ? "ren" : ""} that will also be deleted.</p>
                ) : null;
              })()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitDeleteForm}
                disabled={!deleteNodeId}
                className="flex-1 rounded-lg bg-red-500/80 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
              >Delete →</button>
              <button
                onClick={() => { setActiveForm(null); setDeleteNodeId(""); }}
                className="flex-1 rounded-lg border border-white/15 py-1.5 text-xs text-slate-400 transition hover:border-white/30 hover:text-white"
              >Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 border-t border-white/10 px-4 py-3">
        {scope === "node" && !targetNode && (
          <p className="mb-2 text-center text-[11px] text-amber-400">Select a node on the canvas first</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 disabled:opacity-40"
            rows={1}
            placeholder="Ask anything about the map…"
            value={inputText}
            disabled={inputDisabled}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
            }}
          />
          <button
            onClick={() => sendMessage(inputText)}
            disabled={inputDisabled || !inputText.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-[340px] flex-col border-l border-slate-700 bg-[#0f1b2d] shadow-2xl">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">✦</span>
          <span className="text-sm font-semibold text-white">AI map editor</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              title="Start new chat (archives current)"
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-white/10 hover:text-blue-400"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear all chat history"
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-white/10 hover:text-red-400"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab toggle: Chat / History */}
      <div className="flex flex-shrink-0 border-b border-white/10">
        <button
          onClick={() => { setActiveTab("chat"); setViewingSession(null); }}
          className={`flex-1 py-2 text-xs font-semibold tracking-wide transition ${
            activeTab === "chat"
              ? "border-b-2 border-blue-400 text-blue-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-xs font-semibold tracking-wide transition ${
            activeTab === "history"
              ? "border-b-2 border-blue-400 text-blue-400"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          History
        </button>
      </div>

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (() => {
        const allSessions = [...sessions].reverse(); // newest first
        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Past Chats
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                {allSessions.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10">
              {allSessions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <svg className="mx-auto mb-2 h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                  <p className="text-xs text-slate-500">No past chats</p>
                  <p className="mt-1 text-[10px] text-slate-600">Click &quot;New&quot; to archive the current chat and start fresh</p>
                </div>
              ) : (
                <div>
                  {allSessions.map((s, idx) => {
                    const msgCount = s.messages.length;
                    const commitCount = s.commits.length;
                    const totalAdds = s.commits.reduce((n, c) => n + (c.adds || 0), 0);
                    const totalDeletes = s.commits.reduce((n, c) => n + (c.deletes || 0), 0);
                    return (
                      <SessionRow key={idx} session={s} msgCount={msgCount} commitCount={commitCount} totalAdds={totalAdds} totalDeletes={totalDeletes} onOpen={() => { setViewingSession(s); setActiveTab("chat"); }} />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CHAT TAB ── */}
      {activeTab === "chat" && (
        <>
      {/* ── READ-ONLY SESSION VIEW ── */}
      {viewingSession && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Back header */}
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <button
              onClick={() => { setViewingSession(null); setActiveTab("history"); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              History
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{viewingSession.name}</p>
              <p className="text-[10px] text-slate-500">{viewingSession.messages.length} messages · {timeAgo(viewingSession.ts)}</p>
            </div>
          </div>

          {/* Session messages */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-3 px-4 py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10">
            {viewingSession.messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <span className={`text-[10px] font-semibold uppercase tracking-widest px-0.5 ${msg.role === "user" ? "text-blue-400" : "text-slate-400"}`}>
                  {msg.role === "user" ? "You" : "Map AI"}
                </span>
                <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-blue-500/80 text-white"
                    : "rounded-bl-sm border border-white/10 bg-white/5 text-slate-200"
                }`}>
                  {msg.text}
                </div>
                {msg.ts && (
                  <span className="px-0.5 text-[9px] text-slate-600">{timeAgo(msg.ts)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Input box — continue from this session */}
          <div className="flex-shrink-0 border-t border-white/10 px-4 py-3">
            <p className="mb-2 text-center text-[10px] text-slate-500">Type to continue this conversation</p>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="flex-1 resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 disabled:opacity-40"
                rows={1}
                placeholder="Continue this chat…"
                value={inputText}
                disabled={isLoading}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    // Restore session messages into active chat, then send
                    const restored = viewingSession.messages.map(m => ({ role: m.role as "user" | "ai", text: m.text, ts: m.ts }));
                    setMessages(restored);
                    setCommits(viewingSession.commits ?? []);
                    setViewingSession(null);
                    // Send after state update
                    setTimeout(() => sendMessage(inputText), 0);
                  }
                }}
              />
              <button
                onClick={() => {
                  const restored = viewingSession.messages.map(m => ({ role: m.role as "user" | "ai", text: m.text, ts: m.ts }));
                  setMessages(restored);
                  setCommits(viewingSession.commits ?? []);
                  setViewingSession(null);
                  setTimeout(() => sendMessage(inputText), 0);
                }}
                disabled={isLoading || !inputText.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENTIRE MAP SCOPE */}
      {!viewingSession && scope === "map" && (
        <>
          {ScopeToggle}

          {/* Stats bar */}
          <div className="flex flex-shrink-0 border-b border-white/10 px-4 py-3">
            {[
              { value: capabilities.length, label: "nodes" },
              { value: new Set(capabilities.map((c) => c.level)).size, label: "layers" },
            ].map((stat, i, arr) => (
              <div key={stat.label} className="flex flex-1 flex-col items-center">
                <span className="text-lg font-bold text-white">{stat.value}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400">{stat.label}</span>
                {i < arr.length - 1 && <div className="absolute mx-[84px] h-8 w-px bg-white/10" />}
              </div>
            ))}
          </div>

          {/* Quick actions — 2x2 grid */}
          <div className="flex-shrink-0 grid grid-cols-2 gap-1.5 border-b border-white/10 px-4 py-2.5">
            <button
              onClick={() => { setActiveForm(activeForm === "add" ? null : "add"); }}
              disabled={isLoading}
              className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                activeForm === "add"
                  ? "border-blue-400 bg-blue-500/20 text-white"
                  : "border-white/15 bg-white/5 text-slate-200 hover:border-blue-400 hover:bg-blue-500/10 hover:text-white"
              } disabled:opacity-40`}
            >
              <span className="font-bold">+</span> Add node
            </button>
            <button
              onClick={() => { setActiveForm(activeForm === "delete" ? null : "delete"); setDeleteNodeId(""); }}
              disabled={isLoading}
              className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                activeForm === "delete"
                  ? "border-red-400 bg-red-500/20 text-red-300"
                  : "border-white/15 bg-white/5 text-slate-200 hover:border-red-400 hover:bg-red-500/10 hover:text-red-300"
              } disabled:opacity-40`}
            >
              <span className="font-bold">×</span> Delete node
            </button>
            {AI_QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => { setActiveForm(null); sendMessage(action.prompt, action.mode); }}
                disabled={isLoading}
                className="flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-400 hover:bg-blue-500/10 hover:text-white disabled:opacity-40"
              >
                <span className="font-bold">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>

          {/* Legend command reference — collapsible */}
          <LegendCommandRef />

          {ChatSection}
        </>
      )}

      {/* SINGLE NODE SCOPE */}
      {!viewingSession && scope === "node" && (
        <>
          {ScopeToggle}

          {/* Node picker — canvas click */}
          <div className="flex-shrink-0 border-b border-white/10 px-4 py-3">
            {!targetNode ? (
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-amber-400" />
                <span className="text-xs text-slate-300">Click any node on the canvas to select it</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    targetNode.level === 0 ? "bg-slate-700 text-slate-300" :
                    targetNode.level === 1 ? "bg-blue-700 text-blue-200" :
                    targetNode.level === 2 ? "bg-blue-500/30 text-blue-300" :
                    "bg-white/10 text-slate-300"
                  }`}>L{targetNode.level}</span>
                  <span className="truncate text-xs font-semibold text-white">{targetNode.name}</span>
                </div>
                <button
                  onClick={() => onPickNode?.("")}
                  className="flex-shrink-0 rounded px-2 py-1 text-[10px] text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {targetNode && (
            <div
              className="flex-shrink-0 overflow-y-auto border-b border-white/10 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10"
              style={{ maxHeight: "52%" }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
                <span className="break-words text-sm font-semibold text-white">{targetNode.name}</span>
                <span className="flex-shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                  {LEVEL_LABELS[targetNode.level] ?? `L${targetNode.level}`}
                </span>
              </div>

              <div className="space-y-3 px-4 py-3">
                {grandparentCap && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Grandparent</p>
                    <p className="mt-0.5 text-xs text-slate-300">{grandparentCap.name}</p>
                  </div>
                )}

                {targetNode.level > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Parent</p>
                    {validParents.length > 0 ? (
                      <select
                        className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-400"
                        value={targetNode.parent_id ?? ""}
                        onChange={(e) => onUpdateNode?.(targetNode.id, { parent_id: e.target.value } as Partial<CapabilityNodeData & NodeStylePatch>)}
                      >
                        {validParents.map((p) => (
                          <option key={p.id} value={p.id} className="bg-[#0f1b2d]">{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-300">{parentCap?.name ?? "—"}</p>
                    )}
                  </div>
                )}

                <div className="h-px bg-white/10" />

                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Background</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        className="h-7 w-10 cursor-pointer rounded border border-white/15 bg-transparent p-0"
                        value={currentStyle.fill ?? LEVEL_BG_DEFAULTS[targetNode.level] ?? "#ffffff"}
                        onChange={(e) => onUpdateNode?.(targetNode.id, { fill: e.target.value } as Partial<CapabilityNodeData & NodeStylePatch>)}
                      />
                      <span className="text-[10px] text-slate-400">{currentStyle.fill ?? "default"}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Border</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        className="h-7 w-10 cursor-pointer rounded border border-white/15 bg-transparent p-0"
                        value={currentStyle.border ?? LEVEL_BORDER_DEFAULTS[targetNode.level] ?? "#d1e3ff"}
                        onChange={(e) => onUpdateNode?.(targetNode.id, { border: e.target.value } as Partial<CapabilityNodeData & NodeStylePatch>)}
                      />
                      <span className="text-[10px] text-slate-400">{currentStyle.border ?? "default"}</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Note</p>
                  <textarea
                    className="mt-1 w-full resize-none rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-400"
                    rows={2}
                    placeholder="Add a note…"
                    value={currentStyle.note ?? ""}
                    onChange={(e) => onUpdateNode?.(targetNode.id, { note: e.target.value } as Partial<CapabilityNodeData & NodeStylePatch>)}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Description</p>
                  <textarea
                    className="mt-1 w-full resize-none rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-400"
                    rows={3}
                    placeholder="Add a description…"
                    value={targetNode.description ?? ""}
                    onChange={(e) => onUpdateNode?.(targetNode.id, { description: e.target.value } as Partial<CapabilityNodeData & NodeStylePatch>)}
                  />
                </div>
              </div>
            </div>
          )}

          {targetNode && ChatSection}
        </>
      )}
      </>
      )}
    </div>
  );
}
