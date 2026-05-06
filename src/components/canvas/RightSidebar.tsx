"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CapabilityNodeData } from "./CapabilityNode";
import type { Capability } from "@/types/capability";
import type { DiagramCommand, NodeStylePatch } from "@/lib/commands/index";

const LEVEL_LABELS = ["L0 domain", "L1 group", "L2 subgroup", "L3 leaf"];

// Default background colors per level (matches CapabilityNode LEVEL_COLORS)
const LEVEL_BG_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d",
  1: "#2563eb",
  2: "#599dff",
  3: "#ffffff",
};

// Default border colors per level
const LEVEL_BORDER_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d",
  1: "#2563eb",
  2: "#599dff",
  3: "#d1e3ff",
};

type ChatMessage = { role: "user" | "ai"; text: string };

interface RightSidebarProps {
  node: { id: string; data: CapabilityNodeData } | null;
  capabilities: Capability[];
  nodeStyles?: Record<string, NodeStylePatch>;
  onUpdateNode?: (id: string, patch: Partial<CapabilityNodeData>) => void;
  /** Move a node to a different parent (hierarchy enforced in handler) */
  onReparent?: (nodeId: string, newParentId: string) => void;
  /** Detach a child from its current parent (sets parent_id to null) */
  onDetachChild?: (childId: string) => void;
  /** Permanently delete a node and cascade-remove all its descendants */
  onDeleteChild?: (childId: string) => void;
  /** Permanently delete the currently selected node (and all its descendants) */
  onDeleteNode?: (nodeId: string) => void;
  /** Apply AI-generated diagram commands to local state */
  onAICommands?: (commands: DiagramCommand[]) => void;
}

// ── ChildrenPanel ────────────────────────────────────────────────────────────
// Chip-multiselect for direct children of a given level.
// Shows chips (with ×) for current children and a searchable + dropdown
// to attach any other node of that level.
interface ChildrenPanelProps {
  parentId: string;
  childLevel: 0 | 1 | 2 | 3;
  capabilities: Capability[];
  onAttach: (childId: string) => void;
  onDetach: (childId: string) => void;
  onDelete: (childId: string) => void;
}

function ChildrenPanel({
  parentId,
  childLevel,
  capabilities,
  onAttach,
  onDetach,
  onDelete,
}: ChildrenPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentChildren = capabilities
    .filter((c) => c.parent_id === parentId && c.level === childLevel)
    .sort((a, b) => a.sort_order - b.sort_order);

  // All nodes of childLevel not already parented here
  const available = capabilities
    .filter((c) => c.level === childLevel && c.parent_id !== parentId)
    .filter((c) =>
      search.trim() === "" ||
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // Close dropdown on outside click
  useEffect(() => {
    if (!addOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setAddOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addOpen]);

  const levelLabel = LEVEL_LABELS[childLevel];

  return (
    <div>
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-slate-400">
          {levelLabel} children
          <span className="ml-1 text-slate-300">({currentChildren.length})</span>
        </span>
      </div>

      {/* Current children as full-width rows */}
      {currentChildren.length === 0 ? (
        <p className="mb-2 text-xs text-slate-300">No children yet</p>
      ) : (
        <ul className="mb-2 space-y-1">
          {currentChildren.map((child) => (
            <li
              key={child.id}
              className="flex items-center justify-between gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
            >
              <span className="break-words leading-snug flex-1">{child.name}</span>
              {/* Detach — unparents but keeps the node */}
              <button
                onClick={() => onDetach(child.id)}
                title={`Detach "${child.name}" (keep node)`}
                className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-300 transition hover:bg-amber-100 hover:text-amber-600"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
              {/* Delete — removes node + descendants */}
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${child.name}" and all its children?`)) {
                    onDelete(child.id);
                  }
                }}
                title={`Delete "${child.name}" permanently`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 transition hover:bg-red-100 hover:text-red-500"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add button + searchable dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            setAddOpen((v) => !v);
            setSearch("");
          }}
          className="flex items-center gap-1 rounded border border-dashed border-brand-300 px-2 py-0.5 text-xs text-brand-600 transition hover:border-brand-500 hover:bg-brand-50"
        >
          <span className="text-sm font-bold leading-none">+</span>
          Add {levelLabel}
        </button>

        {addOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] rounded-md border border-slate-200 bg-white shadow-lg">
            {/* Search box */}
            <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
              <svg
                className="h-3 w-3 shrink-0 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
                />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder={`Search ${levelLabel}…`}
                className="w-full text-xs text-slate-700 outline-none placeholder:text-slate-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Results */}
            <ul className="max-h-44 overflow-y-auto py-1">
              {available.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-300">
                  {search ? "No matches" : "All nodes already attached"}
                </li>
              ) : (
                available.map((c) => {
                  const currentParent = c.parent_id
                    ? capabilities.find((p) => p.id === c.parent_id)
                    : null;
                  return (
                    <li
                      key={c.id}
                      className="cursor-pointer px-3 py-1.5 text-xs text-slate-700 hover:bg-brand-50"
                      onMouseDown={() => {
                        onAttach(c.id);
                        setAddOpen(false);
                        setSearch("");
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      {currentParent && (
                        <span className="ml-1 text-slate-300">
                          ← {currentParent.name}
                        </span>
                      )}
                      {!c.parent_id && (
                        <span className="ml-1 text-amber-400">(unattached)</span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export default function RightSidebar({
  node,
  capabilities,
  nodeStyles = {},
  onUpdateNode,
  onReparent,
  onDetachChild,
  onDeleteChild,
  onDeleteNode,
  onAICommands,
}: RightSidebarProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<"properties" | "chat">("properties");

  // Track initial editable values when a node is first selected (for reset)
  const [initialData, setInitialData] = useState<{
    fill?: string;
    border?: string;
    note?: string;
    description?: string;
  } | null>(null);

  // AI chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "Hi! I can help you edit, rename, restyle, or restructure this node. What would you like to do?",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset everything when a different node is selected
  useEffect(() => {
    if (node) {
      setInitialData({
        fill: node.data.fill,
        border: node.data.border,
        note: node.data.note,
        description: node.data.description,
      });
    } else {
      setInitialData(null);
    }
    setActiveTab("properties");
    setMessages([
      {
        role: "ai",
        text: "Hi! I can help you edit, rename, restyle, or restructure this node. What would you like to do?",
      },
    ]);
    setInputText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  // Auto-scroll chat messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isTyping || !node) return;

    const userText = inputText.trim();
    setInputText("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsTyping(true);

    try {
      let fullPrompt = userText;
      if (includeContext) {
        const cap = capabilities.find((c) => c.id === node.id);
        const parentCap = cap?.parent_id
          ? capabilities.find((c) => c.id === cap.parent_id)
          : null;
        fullPrompt = `[Context: the selected node is "${node.data.label}" (${LEVEL_LABELS[node.data.level]})${
          parentCap ? `, under "${parentCap.name}"` : ""
        }]\n\n${userText}`;
      }

      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          capabilities,
          nodeStyles,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: `Error: ${data.error || "Something went wrong"}` },
        ]);
        return;
      }

      if (Array.isArray(data.commands) && data.commands.length > 0) {
        onAICommands?.(data.commands);
      }

      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.summary || "Done!" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Network error. Please try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping, node, capabilities, nodeStyles, includeContext, onAICommands]);

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!node) {
    return (
      <aside className="flex w-80 flex-shrink-0 flex-col border-l border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Node properties</h3>
        <p className="mt-4 text-xs text-slate-400">Click a node to inspect</p>
      </aside>
    );
  }

  const { data } = node;

  const handleReset = () => {
    if (!initialData) return;
    onUpdateNode?.(node.id, {
      fill: initialData.fill,
      border: initialData.border,
      note: initialData.note,
      description: initialData.description,
    });
  };

  // Raw Capability for the selected node (gives us parent_id)
  const cap = capabilities.find((c) => c.id === node.id);

  // Parent / grandparent
  const parentCap = cap?.parent_id
    ? capabilities.find((c) => c.id === cap.parent_id)
    : null;
  const grandparentCap = parentCap?.parent_id
    ? capabilities.find((c) => c.id === parentCap.parent_id)
    : null;

  // Valid reparent candidates (one level above)
  const parentLevel = data.level - 1;
  const validParents =
    data.level > 0 ? capabilities.filter((c) => c.level === parentLevel) : [];

  const handleParentChange = (newParentId: string) => {
    if (newParentId && newParentId !== cap?.parent_id) {
      onReparent?.(node.id, newParentId);
    }
  };

  // Children section is shown for L1 (→ L2 children) and L2 (→ L3 children)
  const childLevel =
    data.level === 1 ? 2 : data.level === 2 ? 3 : null;

  // ── Tab styles ───────────────────────────────────────────────────────────────
  const tabBase =
    "flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors duration-150 cursor-pointer";
  const tabActive = "text-blue-400 border-blue-500";
  const tabInactive =
    "text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600";

  return (
    <aside className="flex w-80 flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      {/* ── Dark navy header ──────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-col bg-[#0f1b2d]">
        {/* Back label */}
        <div className="flex items-center gap-1.5 px-3.5 pt-2.5 pb-1">
          <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 12L6 8l4-4" />
          </svg>
          <span className="text-[11px] text-slate-400">Selected</span>
        </div>

        {/* Node name */}
        <p className="px-3.5 pb-1 text-[15px] font-medium leading-snug tracking-tight text-white break-words">
          {data.label}
        </p>

        {/* Tab row */}
        <div className="mt-1 flex border-t border-white/10">
          <button
            className={`${tabBase} ${activeTab === "properties" ? tabActive : tabInactive}`}
            onClick={() => setActiveTab("properties")}
          >
            Node properties
          </button>
          <button
            className={`${tabBase} ${activeTab === "chat" ? tabActive : tabInactive}`}
            onClick={() => setActiveTab("chat")}
          >
            AI chat
          </button>
        </div>
      </div>

      {/* ── Properties panel ──────────────────────────────────────────── */}
      {activeTab === "properties" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Header controls */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Properties</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReset}
                  title="Reset changes"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${data.label}" and all its children?`)) {
                      onDeleteNode?.(node.id);
                    }
                  }}
                  title={`Delete "${data.label}" permanently`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              {/* ── Level badge ── */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Level</span>
                <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {LEVEL_LABELS[data.level]}
                </span>
              </div>

              {/* ── Grandparent (read-only) ── */}
              {data.level >= 2 && (
                <div>
                  <span className="block text-xs text-slate-400">Grandparent</span>
                  <span className="mt-0.5 block break-words text-xs text-slate-600" title={grandparentCap?.name}>
                    {grandparentCap?.name ?? "—"}
                  </span>
                </div>
              )}

              {/* ── Parent dropdown ── */}
              {data.level > 0 && validParents.length > 0 && (
                <div>
                  <span className="mb-1 block text-slate-400">Parent</span>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                    value={cap?.parent_id ?? ""}
                    onChange={(e) => handleParentChange(e.target.value)}
                  >
                    {cap?.parent_id === null && (
                      <option value="" disabled>— no parent —</option>
                    )}
                    {validParents.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <hr className="border-slate-100" />

              {/* ── Fill color ── */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Background</span>
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
                  value={data.fill || LEVEL_BG_DEFAULTS[data.level]}
                  onChange={(e) => onUpdateNode?.(node.id, { fill: e.target.value })}
                />
              </div>

              {/* ── Border color ── */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Border</span>
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
                  value={data.border || LEVEL_BORDER_DEFAULTS[data.level]}
                  onChange={(e) => onUpdateNode?.(node.id, { border: e.target.value })}
                />
              </div>

              {/* ── Note ── */}
              <div>
                <span className="block text-slate-400">Note</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                  rows={2}
                  placeholder="Add a note…"
                  value={data.note || ""}
                  onChange={(e) => onUpdateNode?.(node.id, { note: e.target.value })}
                />
              </div>

              {/* ── Description ── */}
              <div>
                <span className="block text-slate-400">Description</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
                  rows={3}
                  placeholder="Add a description…"
                  value={data.description || ""}
                  onChange={(e) => onUpdateNode?.(node.id, { description: e.target.value })}
                />
              </div>

              {/* ── Children multiselect (L1 → L2, L2 → L3) ── */}
              {childLevel !== null && (
                <>
                  <hr className="border-slate-100" />
                  <ChildrenPanel
                    parentId={node.id}
                    childLevel={childLevel as 0 | 1 | 2 | 3}
                    capabilities={capabilities}
                    onAttach={(childId) => onReparent?.(childId, node.id)}
                    onDetach={(childId) => onDetachChild?.(childId)}
                    onDelete={(childId) => onDeleteChild?.(childId)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AI chat panel ─────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-200">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-widest px-0.5 ${
                    msg.role === "user" ? "text-blue-400" : "text-slate-400"
                  }`}
                >
                  {msg.role === "user" ? "You" : "AI"}
                </span>
                {/* Context pill for AI messages when context is on */}
                {msg.role === "ai" && includeContext && i > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="2" y="2" width="12" height="12" rx="2" />
                      <path d="M5 8h6M5 5h6M5 11h4" />
                    </svg>
                    {data.label}
                  </div>
                )}
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-blue-500 text-white"
                      : "rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[10px] font-semibold uppercase tracking-widest px-0.5 text-slate-400">AI</span>
                <div className="flex items-center gap-1 rounded-xl rounded-bl-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-slate-200 bg-white p-3 space-y-2.5">
            {/* Context toggle */}
            <button
              className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
              onClick={() => setIncludeContext((v) => !v)}
            >
              {/* Toggle track */}
              <span
                className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full transition-colors duration-200 ${
                  includeContext ? "bg-blue-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200 ${
                    includeContext ? "left-3.5" : "left-0.5"
                  }`}
                />
              </span>
              Include selected node context
            </button>

            {/* Input row */}
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 [&::-webkit-scrollbar]:w-1"
                rows={1}
                placeholder="Ask about this node…"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  // Auto-grow up to 4 rows
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={isTyping || !inputText.trim()}
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
    </aside>
  );
}

