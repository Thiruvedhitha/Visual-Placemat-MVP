"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Folder = {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  created_at: string;
  diagramCount: number;
  memberCount: number;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  email: string;
  display_name: string;
  created_at: string;
};

type Diagram = { id: string; name: string; status: string; updated_at: string };

type FolderDetail = { folder: Folder; members: Member[]; diagrams: Diagram[] };

export default function AdminFoldersPage() {
  const [folders, setFolders]   = useState<Folder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("active");
  const [q, setQ]               = useState("");
  const [detail, setDetail]     = useState<FolderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole]   = useState("viewer");
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const fetchFolders = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/folders?status=${status}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setFolders)
      .finally(() => setLoading(false));
  }, [status, q]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const openDetail = (id: string) => {
    setDetail(null);
    setDetailLoading(true);
    fetch(`/api/admin/folders/${id}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  };

  const changeRole = async (clientId: string, userId: string, role: string) => {
    await fetch(`/api/admin/folders/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    openDetail(clientId);
  };

  const removeMember = async (clientId: string, userId: string) => {
    if (!confirm("Remove this member?")) return;
    await fetch(`/api/admin/folders/${clientId}?userId=${userId}`, { method: "DELETE" });
    openDetail(clientId);
  };

  const toggleFolderStatus = async (clientId: string, currentStatus: string) => {
    const next = currentStatus === "active" ? "archived" : "active";
    if (!confirm(`${next === "archived" ? "Archive" : "Restore"} this folder?`)) return;
    await fetch(`/api/admin/folders/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    fetchFolders();
    if (detail?.folder.id === clientId) openDetail(clientId);
  };

  const addMember = async () => {
    if (!detail || !addEmail.trim()) return;
    setAddError(null);
    setSaving(true);
    // Resolve email → userId via admin users endpoint
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(addEmail.trim())}`);
    const users = await res.json();
    const found = users.find((u: { email: string; user_id: string }) => u.email.toLowerCase() === addEmail.trim().toLowerCase());
    if (!found) { setAddError("User not found. They must sign in at least once."); setSaving(false); return; }
    const addRes = await fetch(`/api/admin/folders/${detail.folder.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: found.user_id, role: addRole }),
    });
    if (!addRes.ok) { const d = await addRes.json(); setAddError(d.error); setSaving(false); return; }
    setAddEmail("");
    setSaving(false);
    openDetail(detail.folder.id);
  };

  return (
    <div className="flex gap-6">
      {/* Left: folder list */}
      <div className="flex-1 min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex-1">Client Folders</h1>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-40" />
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Folder", "Industry", "Diagrams", "Members", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {folders.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(f.id)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{f.name}</td>
                    <td className="px-4 py-3 text-slate-500">{f.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{f.diagramCount}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{f.memberCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFolderStatus(f.id, f.status); }}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        {f.status === "active" ? "Archive" : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
                {folders.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">No folders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: folder detail drawer */}
      {(detail || detailLoading) && (
        <div className="w-96 shrink-0 rounded-xl border border-slate-200 bg-white p-5 self-start sticky top-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">{detail?.folder.name ?? "Loading…"}</h2>
            <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>

          {detailLoading && <div className="h-32 animate-pulse rounded-lg bg-slate-100" />}

          {detail && (
            <>
              {/* Add member */}
              <div className="mb-4 rounded-lg bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Add member</p>
                {addError && <p className="text-xs text-red-600">{addError}</p>}
                <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                <div className="flex gap-2">
                  <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={addMember} disabled={saving || !addEmail.trim()} className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-brand-700">
                    {saving ? "…" : "Add"}
                  </button>
                </div>
              </div>

              {/* Members */}
              <p className="text-xs font-semibold text-slate-500 mb-2">Members ({detail.members.length})</p>
              <div className="space-y-1 mb-4 max-h-52 overflow-y-auto">
                {detail.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-slate-700">{m.display_name || m.email}</p>
                      <p className="truncate text-[10px] text-slate-400">{m.email}</p>
                    </div>
                    <select value={m.role} onChange={(e) => changeRole(detail.folder.id, m.user_id, e.target.value)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => removeMember(detail.folder.id, m.user_id)} className="text-xs text-red-400 hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>

              {/* Diagrams */}
              <p className="text-xs font-semibold text-slate-500 mb-2">Diagrams ({detail.diagrams.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {detail.diagrams.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50">
                    <Link href={`/dashboard?catalogId=${d.id}`} className="text-xs text-brand-600 hover:underline truncate">{d.name}</Link>
                    <span className={`text-[10px] ml-2 ${d.status === "archived" ? "text-amber-600" : "text-emerald-600"}`}>{d.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
