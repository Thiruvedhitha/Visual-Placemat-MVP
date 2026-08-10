"use client";

import { useEffect, useState, useCallback } from "react";

type UserRow = {
  user_id: string;
  email: string;
  display_name: string;
  platform_role: string;
  created_at: string;
  memberships: { clientId: string; clientName: string; role: string }[];
};

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving]     = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const changePlatformRole = async (userId: string, role: string) => {
    if (!confirm(`Change platform role to "${role}"?`)) return;
    setSaving(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, platformRole: role }),
    });
    setSaving(null);
    fetchUsers();
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 flex-1">Users</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email…" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-56" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["User", "Platform Role", "Folders", "Joined", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <>
                  <tr key={u.user_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(expanded === u.user_id ? null : u.user_id)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{u.display_name || u.email}</p>
                      <p className="text-[11px] text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.platform_role === "admin" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {u.platform_role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.memberships.length}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          changePlatformRole(u.user_id, u.platform_role === "admin" ? "user" : "admin");
                        }}
                        disabled={saving === u.user_id}
                        className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-50"
                      >
                        {u.platform_role === "admin" ? "Revoke admin" : "Make admin"}
                      </button>
                    </td>
                  </tr>
                  {expanded === u.user_id && u.memberships.length > 0 && (
                    <tr key={`${u.user_id}-memberships`} className="bg-slate-50">
                      <td colSpan={5} className="px-8 py-3">
                        <div className="flex flex-wrap gap-2">
                          {u.memberships.map((m) => (
                            <span key={m.clientId} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px]">
                              {m.clientName} <span className="text-slate-400">({m.role})</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
