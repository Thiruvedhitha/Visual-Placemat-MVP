"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Capability } from "@/types/capability";
import type { DiagramCommand, NodeStylePatch } from "@/lib/commands/index";
import type { CapabilityNodeData } from "./CapabilityNode";

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS = ["L0 domain", "L1 group", "L2 subgroup", "L3 leaf"];

const LEVEL_BG_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d", 1: "#2563eb", 2: "#599dff", 3: "#ffffff",
};
const LEVEL_BORDER_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d", 1: "#2563eb", 2: "#599dff", 3: "#d1e3ff",
};

type Scope = "map" | "node";
type ChatMessage = { role: "user" | "ai"; text: string };

const MAP_QUICK_ACTIONS = [
  { icon: "+", label: "Add node",          prompt: "Suggest a new capability node to add to this map. Specify the name, which level it should be (L0–L3), and which parent it should go under." },
  { icon: "✎", label: "Rename node",       prompt: "Suggest better names for any nodes in this map that are unclear, inconsistent, or could be improved." },
  { icon: "◐", label: "Modify properties", prompt: "Suggest property changes for nodes in this map — such as background color, border color, or reparenting to a better location in the hierarchy." },
  { icon: "×", label: "Delete node",       prompt: "Identify any nodes in this map that are redundant, duplicate, or should be removed, and explain why." },
];

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
  onAICommands: (commands: DiagramCommand[]) => void;
  onUpdateNode?: (id: string, patch: Partial<CapabilityNodeData & NodeStylePatch>) => void;
  onPickNode?: (id: string) => void;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (scope === "node") onEnterPickMode();
    else onExitPickMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    setMessages([]);
    setInputText("");
  }, [scope]);

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
      return userText;
    },
    [scope, targetNode, parentCap]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      if (scope === "node" && !targetNode) return;

      setInputText("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: buildPrompt(trimmed), capabilities, nodeStyles }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((prev) => [...prev, { role: "ai", text: `Error: ${data.error || "Something went wrong."}` }]);
          return;
        }
        if (Array.isArray(data.commands) && data.commands.length > 0) {
          onAICommands(data.commands);
        }
        setMessages((prev) => [...prev, { role: "ai", text: data.summary || "Done." }]);
      } catch {
        setMessages((prev) => [...prev, { role: "ai", text: "Network error. Please try again." }]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, scope, targetNode, buildPrompt, capabilities, nodeStyles, onAICommands]
  );

  if (!open) return null;

  const inputDisabled = isLoading || (scope === "node" && !targetNode);

  const ScopeToggle = (
    <div className="border-b border-white/10 px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Scope</p>
      <div className="flex rounded-lg border border-white/15 bg-white/5 p-0.5">
        <button
          onClick={() => setScope("map")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            scope === "map" ? "bg-blue-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Entire map
        </button>
        <button
          onClick={() => setScope("node")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            scope === "node" ? "bg-blue-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Single node
        </button>
      </div>
    </div>
  );

  const ChatSection = (
    <>
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10">
        {messages.length === 0 && scope === "map" && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[13px] leading-relaxed text-slate-300">
            I have full context of your {capabilities.length}-node capability map. Ask me to restructure, find gaps, add nodes, rename sections, or analyse coverage.
          </div>
        )}
        {messages.length === 0 && scope === "node" && targetNode && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[13px] leading-relaxed text-slate-300">
            Ask me anything about <span className="font-medium text-white">&quot;{targetNode.name}&quot;</span> — rename it, suggest sub-capabilities, restyle, or restructure it.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-0.5 ${msg.role === "user" ? "text-blue-400" : "text-slate-400"}`}>
              {msg.role === "user" ? "You" : "Map AI"}
            </span>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "rounded-br-sm bg-blue-500 text-white"
                : "rounded-bl-sm border border-white/10 bg-white/5 text-slate-200"
            }`}>
              {msg.text}
            </div>
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
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ENTIRE MAP SCOPE */}
      {scope === "map" && (
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

          {/* Quick actions */}
          <div className="flex flex-shrink-0 flex-wrap gap-2 border-b border-white/10 px-4 py-3">
            {MAP_QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading}
                className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-blue-400 hover:bg-blue-500/10 hover:text-white disabled:opacity-40"
              >
                <span className="font-bold">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>

          {ChatSection}
        </>
      )}

      {/* SINGLE NODE SCOPE */}
      {scope === "node" && (
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
    </div>
  );
}
