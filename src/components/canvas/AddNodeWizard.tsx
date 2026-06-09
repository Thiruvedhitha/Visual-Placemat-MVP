"use client";

import { useState, useMemo } from "react";
import type { Capability } from "@/types/capability";
import type { DiagramCommand } from "@/lib/commands/index";

function makeUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type PendingNode = {
  tempId: string;
  name: string;
  level: 0 | 1 | 2 | 3;
  parentTempId: string | null;
  parentRealId: string | null;
};

type Step = "root" | "children" | "grandchildren" | "summary";

interface Props {
  open: boolean;
  onClose: () => void;
  capabilities: Capability[];
  onApply: (commands: DiagramCommand[]) => void;
}

export default function AddNodeWizard({ open, onClose, capabilities, onApply }: Props) {
  const [step, setStep] = useState<Step>("root");
  const [rootName, setRootName] = useState("");
  const [rootLevel, setRootLevel] = useState<0 | 1 | 2 | 3>(1);
  const [rootParentId, setRootParentId] = useState<string>("");
  const [rootTempId, setRootTempId] = useState<string>("");

  // L2 children when root is L1 (entered as comma-separated names per L2)
  const [childInputs, setChildInputs] = useState<{ tempId: string; name: string }[]>([{ tempId: makeUUID(), name: "" }]);
  // L3 grandchildren — keyed by parent L2 tempId
  const [grandchildInputs, setGrandchildInputs] = useState<Record<string, { tempId: string; name: string }[]>>({});

  const rootParents = useMemo(
    () => capabilities.filter((c) => c.level === rootLevel - 1),
    [capabilities, rootLevel]
  );

  const reset = () => {
    setStep("root");
    setRootName("");
    setRootLevel(1);
    setRootParentId("");
    setRootTempId("");
    setChildInputs([{ tempId: makeUUID(), name: "" }]);
    setGrandchildInputs({});
  };

  const close = () => { reset(); onClose(); };

  const nextFromRoot = () => {
    if (!rootName.trim()) return;
    if (rootLevel !== 0 && !rootParentId) return;
    const newId = makeUUID();
    setRootTempId(newId);
    // L0 / L3 can skip straight to summary, L1 → children, L2 → children (L3s)
    if (rootLevel === 3 || rootLevel === 0) setStep("summary");
    else setStep("children");
  };

  const setChildName = (idx: number, name: string) => {
    setChildInputs((prev) => prev.map((c, i) => (i === idx ? { ...c, name } : c)));
  };
  const addChildRow = () => setChildInputs((prev) => [...prev, { tempId: makeUUID(), name: "" }]);
  const removeChildRow = (idx: number) => setChildInputs((prev) => prev.filter((_, i) => i !== idx));

  const nextFromChildren = () => {
    // Only carry children with non-empty names
    const cleanChildren = childInputs.filter((c) => c.name.trim());
    setChildInputs(cleanChildren.length > 0 ? cleanChildren : []);
    // If root is L1, ask for grandchildren (L3 under each L2)
    if (rootLevel === 1 && cleanChildren.length > 0) {
      const initial: Record<string, { tempId: string; name: string }[]> = {};
      cleanChildren.forEach((c) => { initial[c.tempId] = grandchildInputs[c.tempId] ?? [{ tempId: makeUUID(), name: "" }]; });
      setGrandchildInputs(initial);
      setStep("grandchildren");
    } else {
      setStep("summary");
    }
  };

  const setGrandchildName = (parentTempId: string, idx: number, name: string) => {
    setGrandchildInputs((prev) => ({
      ...prev,
      [parentTempId]: prev[parentTempId].map((g, i) => (i === idx ? { ...g, name } : g)),
    }));
  };
  const addGrandchildRow = (parentTempId: string) => {
    setGrandchildInputs((prev) => ({
      ...prev,
      [parentTempId]: [...(prev[parentTempId] ?? []), { tempId: makeUUID(), name: "" }],
    }));
  };
  const removeGrandchildRow = (parentTempId: string, idx: number) => {
    setGrandchildInputs((prev) => ({
      ...prev,
      [parentTempId]: prev[parentTempId].filter((_, i) => i !== idx),
    }));
  };

  // Build the list of pending nodes (for summary + apply)
  const pendingNodes = useMemo<PendingNode[]>(() => {
    const out: PendingNode[] = [];
    if (!rootTempId || !rootName.trim()) return out;
    out.push({
      tempId: rootTempId,
      name: rootName.trim(),
      level: rootLevel,
      parentTempId: null,
      parentRealId: rootLevel === 0 ? null : rootParentId || null,
    });
    if (rootLevel === 1 || rootLevel === 2) {
      const childLevel = (rootLevel + 1) as 2 | 3;
      childInputs
        .filter((c) => c.name.trim())
        .forEach((c) => {
          out.push({
            tempId: c.tempId,
            name: c.name.trim(),
            level: childLevel,
            parentTempId: rootTempId,
            parentRealId: null,
          });
          if (rootLevel === 1) {
            (grandchildInputs[c.tempId] ?? [])
              .filter((g) => g.name.trim())
              .forEach((g) => {
                out.push({
                  tempId: g.tempId,
                  name: g.name.trim(),
                  level: 3,
                  parentTempId: c.tempId,
                  parentRealId: null,
                });
              });
          }
        });
    }
    return out;
  }, [rootTempId, rootName, rootLevel, rootParentId, childInputs, grandchildInputs]);

  const apply = () => {
    const commands: DiagramCommand[] = pendingNodes.map((n) => ({
      type: "ADD_NODE",
      tempId: n.tempId,
      parentId: n.parentTempId ?? n.parentRealId,
      level: n.level,
      name: n.name,
    }));
    onApply(commands);
    close();
  };

  const rootParentName = rootParents.find((p) => p.id === rootParentId)?.name;

  if (!open) return null;

  return (
    <div className="absolute bottom-16 left-4 z-40 w-[340px] rounded-2xl border border-white/10 bg-[#0f1b2d] text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Add a node</p>
          <p className="text-[11px] text-slate-500">
            {step === "root" && "Step 1 — node details"}
            {step === "children" && `Step 2 — L${rootLevel + 1} children`}
            {step === "grandchildren" && "Step 3 — L3 grandchildren"}
            {step === "summary" && "Review & confirm"}
          </p>
        </div>
        <button onClick={close} className="rounded p-1 text-slate-400 hover:text-slate-200">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
        {/* Step 1: root */}
        {step === "root" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Node name</label>
              <input
                autoFocus
                value={rootName}
                onChange={(e) => setRootName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") nextFromRoot(); }}
                placeholder="e.g. Performance Reporting"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Level</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => { setRootLevel(lvl); setRootParentId(""); }}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                      rootLevel === lvl
                        ? "border-blue-500 bg-blue-500/20 text-blue-300"
                        : "border-white/10 bg-white/5 text-slate-400 hover:border-blue-400/40"
                    }`}
                  >
                    L{lvl}
                  </button>
                ))}
              </div>
            </div>
            {rootLevel !== 0 && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Parent — L{rootLevel - 1} node</label>
                <select
                  value={rootParentId}
                  onChange={(e) => setRootParentId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">— select parent —</option>
                  {rootParents.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0f1b2d]">{p.name}</option>
                  ))}
                </select>
                {rootParents.length === 0 && (
                  <p className="mt-1 text-[10px] text-amber-400">No L{rootLevel - 1} nodes exist yet — create one first.</p>
                )}
              </div>
            )}
            <button
              onClick={nextFromRoot}
              disabled={!rootName.trim() || (rootLevel !== 0 && !rootParentId)}
              className="mt-1 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              {rootLevel === 0 || rootLevel === 3 ? "Review" : "Next →"}
            </button>
          </div>
        )}

        {/* Step 2: children */}
        {step === "children" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              Add L{rootLevel + 1} children under <span className="font-semibold text-slate-200">&apos;{rootName}&apos;</span>. <span className="font-semibold text-rose-400">Leave blank to skip.</span>
            </p>
            <div className="space-y-2">
              {childInputs.map((c, idx) => (
                <div key={c.tempId} className="flex items-center gap-1.5">
                  <input
                    value={c.name}
                    onChange={(e) => setChildName(idx, e.target.value)}
                    placeholder={`L${rootLevel + 1} child ${idx + 1}`}
                    className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-400 focus:outline-none"
                  />
                  {childInputs.length > 1 && (
                    <button onClick={() => removeChildRow(idx)} className="rounded p-1 text-slate-500 hover:text-red-400">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addChildRow} className="text-[11px] font-semibold text-blue-400 hover:text-blue-300">+ Add another</button>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep("root")} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">← Back</button>
              <button onClick={nextFromChildren} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: grandchildren */}
        {step === "grandchildren" && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-400">Add L3 children under each L2 <span className="font-semibold text-rose-400">(optional — leave blank to skip)</span>.</p>
            {childInputs.map((c) => (
              <div key={c.tempId} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-slate-200">L2 — {c.name}</p>
                <div className="space-y-1.5">
                  {(grandchildInputs[c.tempId] ?? []).map((g, idx) => (
                    <div key={g.tempId} className="flex items-center gap-1.5">
                      <input
                        value={g.name}
                        onChange={(e) => setGrandchildName(c.tempId, idx, e.target.value)}
                        placeholder={`L3 child ${idx + 1}`}
                        className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:border-blue-400 focus:outline-none"
                      />
                      {(grandchildInputs[c.tempId]?.length ?? 0) > 1 && (
                        <button onClick={() => removeGrandchildRow(c.tempId, idx)} className="rounded p-0.5 text-slate-500 hover:text-red-400">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addGrandchildRow(c.tempId)} className="text-[10px] font-semibold text-blue-400 hover:text-blue-300">+ Add L3</button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep("children")} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">← Back</button>
              <button onClick={() => setStep("summary")} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Review →</button>
            </div>
          </div>
        )}

        {/* Step 4: summary */}
        {step === "summary" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              {pendingNodes.length} node{pendingNodes.length !== 1 ? "s" : ""} will be added{rootParentName ? ` under '${rootParentName}'` : ""}.
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2.5 text-[11px]">
              {pendingNodes.map((n) => {
                const indent = n.parentTempId ? (pendingNodes.find((p) => p.tempId === n.parentTempId)?.parentTempId ? 4 : 2) : 0;
                return (
                  <div key={n.tempId} className="flex items-center gap-2" style={{ paddingLeft: `${indent * 8}px` }}>
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">L{n.level}</span>
                    <span className="text-slate-200">{n.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(rootLevel === 1 ? "grandchildren" : rootLevel === 2 ? "children" : "root")}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                ✕ Decline
              </button>
              <button
                onClick={apply}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                ✓ Accept &amp; create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
