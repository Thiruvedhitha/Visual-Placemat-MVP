"use client";

import { useState, useEffect } from "react";
import type { CapabilityNodeData } from "./CapabilityNode";
import type { Capability } from "@/types/capability";

const LEVEL_LABELS: Record<number, string> = {
  0: "L0 domain",
  1: "L1 group",
  2: "L2 subgroup",
  3: "L3 leaf",
};

interface RightSidebarProps {
  node: { id: string; data: CapabilityNodeData } | null;
  capabilities: Capability[];
  onUpdateNode: (id: string, patch: Partial<CapabilityNodeData>) => void;
  onReparent: (nodeId: string, newParentId: string) => void;
  onDeleteCascade: (nodeId: string) => void;
  onDetachChildren: (nodeId: string) => void;
  onRenameCapability: (nodeId: string, name: string) => void;
  onAddChild: (parentId: string, name: string) => void;
  onDetachChild: (childId: string) => void;
  onDeleteChild: (childId: string) => void;
}

export default function RightSidebar({
  node,
  capabilities,
  onUpdateNode,
  onReparent,
  onDeleteCascade,
  onDetachChildren,
  onRenameCapability,
  onAddChild,
  onDetachChild,
  onDeleteChild,
}: RightSidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildName, setEditingChildName] = useState("");

  // Reset local state whenever a different node is selected
  useEffect(() => {
    setDeleteConfirm(false);
    setNewChildName("");
    setEditingChildId(null);
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

  // Derive state from capabilities
  const capability    = capabilities.find((c) => c.id === node.id) ?? null;
  const parentCap     = capability?.parent_id ? capabilities.find((c) => c.id === capability.parent_id) ?? null : null;
  const grandparentCap = parentCap?.parent_id  ? capabilities.find((c) => c.id === parentCap.parent_id)  ?? null : null;
  const validParents  = capability ? capabilities.filter((c) => c.level === capability.level - 1) : [];
  const children      = capability ? capabilities.filter((c) => c.parent_id === capability.id) : [];

  // Count all descendants for delete warning
  const countDescendants = (id: string): number => {
    const direct = capabilities.filter((c) => c.parent_id === id);
    return direct.reduce((sum, c) => sum + 1 + countDescendants(c.id), 0);
  };
  const descendantCount = capability ? countDescendants(capability.id) : 0;

  const addChild = () => {
    const name = newChildName.trim();
    if (!name) return;
    onAddChild(node.id, name);
    setNewChildName("");
  };

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="flex flex-col gap-4 p-4">

        {/* ── Header: name + level badge ── */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Node properties</h3>
            <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
              {LEVEL_LABELS[data.level]}
            </span>
          </div>
          {/* Editable node name */}
          <input
            key={node.id}
            type="text"
            defaultValue={data.label}
            className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== data.label) {
                onUpdateNode(node.id, { label: val });
                onRenameCapability(node.id, val);
              }
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
        </div>

        <div className="border-t border-slate-100" />

        {/* ── Hierarchy ── */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hierarchy</h4>

          {/* Grandparent — read only context */}
          {grandparentCap && (
            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="text-slate-400">Grandparent</span>
              <span className="text-right font-medium text-slate-600">{grandparentCap.name}</span>
            </div>
          )}

          {/* Parent dropdown */}
          {capability && capability.level > 0 && (
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Parent ({LEVEL_LABELS[capability.level - 1]})
              </label>
              <select
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400"
                value={parentCap?.id ?? ""}
                onChange={(e) => { if (e.target.value) onReparent(node.id, e.target.value); }}
              >
                {!parentCap && <option value="">— unassigned —</option>}
                {validParents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* ── Children ── */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Children{children.length > 0 ? ` (${children.length})` : ""}
          </h4>

          {children.length > 0 && (
            <ul className="mb-2 space-y-1">
              {children.map((child) => (
                <li key={child.id} className="flex items-center gap-1">
                  {editingChildId === child.id ? (
                    <input
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-brand-300 px-1.5 py-1 text-xs text-slate-800 outline-none"
                      value={editingChildName}
                      onChange={(e) => setEditingChildName(e.target.value)}
                      onBlur={() => {
                        const val = editingChildName.trim();
                        if (val && val !== child.name) {
                          onRenameCapability(child.id, val);
                          onUpdateNode(child.id, { label: val });
                        }
                        setEditingChildId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingChildId(null);
                      }}
                    />
                  ) : (
                    <button
                      className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
                      title="Click to rename"
                      onClick={() => { setEditingChildId(child.id); setEditingChildName(child.name); }}
                    >
                      {child.name}
                    </button>
                  )}

                  {/* Detach individual child */}
                  <button
                    title="Detach (remove parent link)"
                    className="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-amber-50 hover:text-amber-500"
                    onClick={() => onDetachChild(child.id)}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5L21 3m0 0h-6m6 0v6M10.5 13.5L3 21m0 0h6m-6 0v-6" />
                    </svg>
                  </button>

                  {/* Delete individual child */}
                  <button
                    title="Delete"
                    className="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    onClick={() => onDeleteChild(child.id)}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add child — only if not L3 (leaf level) */}
          {data.level < 3 && (
            <div className="flex gap-1">
              <input
                type="text"
                placeholder={`+ Add ${LEVEL_LABELS[data.level + 1]}…`}
                className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-brand-400"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addChild(); }}
              />
              <button
                disabled={!newChildName.trim()}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-40"
                onClick={addChild}
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* ── Appearance ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Appearance</h4>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Background</span>
            <input
              type="color"
              className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
              value={data.fill || "#ffffff"}
              onChange={(e) => onUpdateNode(node.id, { fill: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Border</span>
            <input
              type="color"
              className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
              value={data.border || "#599dff"}
              onChange={(e) => onUpdateNode(node.id, { border: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* ── Note ── */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Note
          </label>
          <textarea
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            rows={2}
            placeholder="Add a note…"
            value={data.note || ""}
            onChange={(e) => onUpdateNode(node.id, { note: e.target.value })}
          />
        </div>

        {/* Description — read only */}
        {data.description && (
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Description
            </span>
            <p className="text-xs leading-relaxed text-slate-600">{data.description}</p>
          </div>
        )}

        {/* ── Danger zone ── */}
        <div className="border-t border-red-100" />
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
            Danger zone
          </h4>

          {deleteConfirm ? (
            /* Inline delete confirmation */
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">
                Delete &quot;{data.label}&quot;?
              </p>
              {descendantCount > 0 && (
                <p className="mt-0.5 text-xs text-red-500">
                  This will also delete {descendantCount} child node{descendantCount !== 1 ? "s" : ""}.
                </p>
              )}
              <div className="mt-2.5 flex gap-2">
                <button
                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  onClick={() => { onDeleteCascade(node.id); setDeleteConfirm(false); }}
                >
                  Delete all
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {children.length > 0 && (
                <button
                  className="w-full rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                  onClick={() => onDetachChildren(node.id)}
                >
                  Detach children ({children.length})
                </button>
              )}
              <button
                className="w-full rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                onClick={() => setDeleteConfirm(true)}
              >
                Delete node{descendantCount > 0 ? ` + ${descendantCount} children` : ""}
              </button>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}

