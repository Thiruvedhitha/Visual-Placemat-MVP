"use client";

import { useEffect, useState } from "react";

type Stats = {
  users: number;
  folders: number;
  activeDiagrams: number;
  archivedDiagrams: number;
  memberships: number;
};

const STAT_TILES = [
  { key: "users",            label: "Users",              color: "bg-blue-50 text-blue-700" },
  { key: "folders",          label: "Client Folders",     color: "bg-violet-50 text-violet-700" },
  { key: "activeDiagrams",   label: "Active Diagrams",    color: "bg-emerald-50 text-emerald-700" },
  { key: "archivedDiagrams", label: "Archived Diagrams",  color: "bg-amber-50 text-amber-700" },
  { key: "memberships",      label: "Total Memberships",  color: "bg-slate-50 text-slate-700" },
] as const;

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Platform Overview</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {STAT_TILES.map((t) => (
            <div key={t.key} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {STAT_TILES.map((t) => (
            <div key={t.key} className={`rounded-xl border border-slate-200 p-5 ${t.color}`}>
              <p className="text-3xl font-bold">{stats?.[t.key] ?? 0}</p>
              <p className="mt-1 text-xs font-medium opacity-70">{t.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-700">
        <strong>How to seed the first platform admin:</strong> Run the following in the Supabase SQL editor after applying the 2026-08-06_archive_and_admin.sql migration:
        <pre className="mt-2 rounded bg-blue-100 px-3 py-2 text-xs">
          {`UPDATE user_profiles SET platform_role = 'admin' WHERE email = 'you@example.com';`}
        </pre>
      </div>
    </div>
  );
}
