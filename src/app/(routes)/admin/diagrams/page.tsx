"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type DiagramRow = {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  ownerEmail: string | null;
  updated_at: string;
  archived_at: string | null;
  archive_reason: string | null;
};

export default function AdminDiagramsPage() {
  const [diagrams, setDiagrams] = useState<DiagramRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("active");
  const [q, setQ]               = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason]     = useState("");
  const [acting, setActing]     = useState(false);

  const fetchDiagrams = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    fetch(`/api/admin/diagrams?status=${status}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setDiagrams)
      .finally(() => setLoading(false));
  }, [status, q]);

  useEffect(() => { fetchDiagrams(); }, [fetchDiagrams]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleAll = () =>
    setSelected(selected.size === diagrams.length ? new Set() : new Set(diagrams.map((d) => d.id)));

  const bulkAction = async (action: "archive" | "restore") => {
    if (selected.size === 0) return;
    if (!confirm(`${action === "archive" ? "Archive" : "Restore"} ${selected.size} diagram(s)?`)) return;
    setActing(true);
    await fetch("/api/admin/diagrams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, catalogIds: [...selected], reason: reason || undefined }),
    });
    setReason("");
    setActing(false);
    fetchDiagrams();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 flex-1">Diagrams</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-44" />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white">
          <span className="flex-1">{selected.size} selected</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white placeholder-slate-400 w-48" />
          {status === "active" && (
            <button onClick={() => bulkAction("archive")} disabled={acting} className="rounded bg-amber-500 px-3 py-1 text-xs font-medium disabled:opacity-50 hover:bg-amber-600">Archive</button>
          )}
          {status === "archived" && (
            <button onClick={() => bulkAction("restore")} disabled={acting} className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium disabled:opacity-50 hover:bg-emerald-600">Restore</button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8 px-4 py-2.5">
                  <input type="checkbox" checked={selected.size === diagrams.length && diagrams.length > 0} onChange={toggleAll} />
                </th>
                {["Diagram", "Folder", "Owner", "Last Updated", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diagrams.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="w-8 px-4 py-3">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard?catalogId=${d.id}`} className="font-medium text-brand-600 hover:underline">{d.name}</Link>
                    {d.archive_reason && <p className="text-[10px] text-amber-600">Reason: {d.archive_reason}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.clientName ?? "Personal"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{d.ownerEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(d.archived_at ?? d.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setSelected(new Set([d.id])); bulkAction(status === "active" ? "archive" : "restore"); }} className="text-xs text-slate-400 hover:text-slate-700">
                      {status === "active" ? "Archive" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
              {diagrams.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">No diagrams found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
