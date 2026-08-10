"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ClientMember } from "@/types/capability";

type MemberWithProfile = ClientMember & { email: string; display_name: string };

export default function MembersPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [members, setMembers]   = useState<MemberWithProfile[]>([]);
  const [myRole, setMyRole]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState<"editor" | "viewer">("viewer");
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [clientId]);

  async function fetchData() {
    const [memberRes, clientRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/members`),
      fetch(`/api/clients/${clientId}`),
    ]);
    if (memberRes.ok) setMembers(await memberRes.json());
    if (clientRes.ok) {
      const data = await clientRes.json();
      setMyRole(data.role ?? null);
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Failed"); return; }
      setEmail("");
      setShowAdd(false);
      fetchData();
    } finally { setAdding(false); }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await fetch(`/api/clients/${clientId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    fetchData();
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this member? They will lose access to all diagrams in this folder.")) return;
    await fetch(`/api/clients/${clientId}/members?user_id=${userId}`, { method: "DELETE" });
    fetchData();
  }

  const isAdmin = myRole === "admin";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading members…</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6"><a href={`/clients/${clientId}`} className="text-sm text-brand-500 hover:underline">← Back to client</a></div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            <p className="text-sm text-gray-500 mt-1">{members.length} member{members.length !== 1 ? "s" : ""} · your role: <strong>{myRole}</strong></p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAdd(true)} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">+ Add Member</button>
          )}
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Add Team Member</h2>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                    <option value="viewer">Viewer — view maps only</option>
                    <option value="editor">Editor — create & edit maps</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => { setShowAdd(false); setError(null); }} className="px-4 py-2 text-gray-600">Cancel</button>
                <button type="submit" disabled={adding || !email.trim()} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium">{adding ? "Adding…" : "Add Member"}</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                {isAdmin && <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{member.display_name || member.email}</p>
                    <p className="text-xs text-gray-400">{member.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {isAdmin ? (
                      <select value={member.role} onChange={(e) => handleRoleChange(member.user_id, e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1">
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="capitalize text-sm text-gray-700">{member.role}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(member.created_at).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleRemove(member.user_id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Role Permissions</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="font-medium text-gray-800">Admin</p><p className="text-gray-500">Full access: manage members, edit, archive diagrams</p></div>
            <div><p className="font-medium text-gray-800">Editor</p><p className="text-gray-500">Create & edit diagrams</p></div>
            <div><p className="font-medium text-gray-800">Viewer</p><p className="text-gray-500">View & export only</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
