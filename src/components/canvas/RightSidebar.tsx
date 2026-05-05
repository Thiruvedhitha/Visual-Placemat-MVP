"use client";

import { useState, useEffect, useRef } from "react";
import type { CapabilityNodeData } from "./CapabilityNode";
import type { Capability } from "@/types/capability";

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

interface RightSidebarProps {
  node: { id: string; data: CapabilityNodeData } | null;
  capabilities: Capability[];
  onUpdateNode?: (id: string, patch: Partial<CapabilityNodeData>) => void;
  /** Move a node to a different parent (hierarchy enforced in handler) */
  onReparent?: (nodeId: string, newParentId: string) => void;
  /** Detach a child from its current parent (sets parent_id to null) */
  onDetachChild?: (childId: string) => void;
  /** Permanently delete a node and cascade-remove all its descendants */
  onDeleteChild?: (childId: string) => void;
  /** Permanently delete the currently selected node (and all its descendants) */
  onDeleteNode?: (nodeId: string) => void;
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
  onUpdateNode,
  onReparent,
  onDetachChild,
  onDeleteChild,
  onDeleteNode,
}: RightSidebarProps) {
  // Track initial editable values when a node is first selected
  const [initialData, setInitialData] = useState<{
    fill?: string;
    border?: string;
    note?: string;
    description?: string;
  } | null>(null);

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
    // Only capture on node selection change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  if (!node) {
    return (
      <aside className="flex w-64 flex-shrink-0 flex-col border-l border-slate-200 bg-white p-5">
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

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-5">
      {/* ── Header with reset & delete buttons ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Node properties</h3>
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

      <div className="mt-4 space-y-4 text-sm">
        {/* ── Selected name ── */}
        <div>
          <span className="block text-xs text-slate-400">Selected</span>
          <span className="mt-0.5 block break-words font-medium text-slate-800">{data.label}</span>
        </div>

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
            <span
              className="mt-0.5 block break-words text-xs text-slate-600"
              title={grandparentCap?.name}
            >
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
                <option value="" disabled>
                  — no parent —
                </option>
              )}
              {validParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Divider ── */}
        <hr className="border-slate-100" />

        {/* ── Fill color (container/background) ── */}
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
    </aside>
  );
}

