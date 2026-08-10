"use client";

import { useEffect, useState, useCallback } from "react";

type AuditRow = {
  id: string;
  actor_id: string;
  actorEmail: string;
  action: string;
  target_user_id: string | null;
  client_id: string | null;
  catalog_id: string | null;
  reason: string | null;
  new_value: object | null;
  previous_value: object | null;
  created_at: string;
};

export default function AdminAuditPage() {
  const [rows, setRows]   = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset]   = useState(0);
  const LIMIT = 50;

  const fetchLogs = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/audit?limit=${LIMIT}&offset=${offset}`)
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionBadge = (action: string) => {
    if (action.includes("archive")) return "bg-amber-100 text-amber-700";
    if (action.includes("restore") || action.includes("added") || action.includes("granted")) return "bg-emerald-100 text-emerald-700";
    if (action.includes("removed") || action.includes("revoke")) return "bg-red-100 text-red-700";
    if (action.includes("role_changed")) return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Audit Log</h1>

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Time", "Actor", "Action", "Target", "Reason"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[12rem] truncate">{r.actorEmail}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${actionBadge(r.action)}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-500 max-w-[14rem] truncate">
                      {r.client_id ?? r.catalog_id ?? r.target_user_id ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[14rem] truncate">{r.reason ?? "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">No audit records</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50">← Prev</button>
            <span className="text-xs text-slate-400">Showing {offset + 1}–{offset + rows.length}</span>
            <button disabled={rows.length < LIMIT} onClick={() => setOffset(offset + LIMIT)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50">Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
