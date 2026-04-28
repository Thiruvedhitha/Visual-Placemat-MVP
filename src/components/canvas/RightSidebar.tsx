"use client";

import type { CapabilityNodeData } from "./CapabilityNode";

const LEVEL_LABELS = ["L0 domain", "L1 group", "L2 subgroup", "L3 leaf"];

interface RightSidebarProps {
  node: { id: string; data: CapabilityNodeData } | null;
  onUpdateNode?: (id: string, patch: Partial<CapabilityNodeData>) => void;
}

export default function RightSidebar({ node, onUpdateNode }: RightSidebarProps) {
  if (!node) {
    return (
      <aside className="flex w-64 flex-shrink-0 flex-col border-l border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Node properties</h3>
        <p className="mt-4 text-xs text-slate-400">Click a node to inspect</p>
      </aside>
    );
  }

  const { data } = node;

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-l border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">Node properties</h3>

      <div className="mt-4 space-y-3 text-sm">
        {/* Selected name */}
        <div>
          <span className="text-slate-400">Selected: </span>
          <span className="font-medium text-slate-800">{data.label}</span>
        </div>

        {/* Level */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Level</span>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {LEVEL_LABELS[data.level]}
          </span>
        </div>

        {/* Parent */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Parent</span>
          <span className="text-slate-700">{data.parentName || "—"}</span>
        </div>

        {/* Fill color */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Fill</span>
          <input
            type="color"
            className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
            value={data.fill || "#ffffff"}
            onChange={(e) => onUpdateNode?.(node.id, { fill: e.target.value })}
          />
        </div>

        {/* Border color */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Border</span>
          <input
            type="color"
            className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0"
            value={data.border || "#599dff"}
            onChange={(e) => onUpdateNode?.(node.id, { border: e.target.value })}
          />
        </div>

        {/* Note */}
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

        {/* Description */}
        {data.description && (
          <div>
            <span className="block text-slate-400">Description</span>
            <p className="mt-0.5 text-xs text-slate-600">{data.description}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
