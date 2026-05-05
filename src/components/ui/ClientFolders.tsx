"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientFolder, ClientCatalog } from "@/app/api/clients/route";

// ── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const CLIENT_ACCENT: string[] = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

// ── DiagramRow ────────────────────────────────────────────────────────────────

function DiagramRow({ cat }: { cat: ClientCatalog }) {
  return (
    <Link
      href={`/dashboard?catalogId=${encodeURIComponent(cat.id)}`}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-slate-50"
    >
      {/* Diagram icon */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 transition group-hover:bg-brand-50 group-hover:text-brand-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375z" />
        </svg>
      </span>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">
          {cat.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {cat.industry && (
            <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
              {cat.industry}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {cat.capability_count} capabilities
          </span>
        </div>
      </div>

      {/* Time + arrow */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] text-slate-400">{timeAgo(cat.updated_at)}</span>
        <svg
          className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-400"
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}

// ── ClientAccordion ───────────────────────────────────────────────────────────

function ClientAccordion({
  folder,
  accentColor,
  defaultOpen,
}: {
  folder: ClientFolder;
  accentColor: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* Colored client dot / initial */}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${accentColor}`}>
          {folder.client_name.charAt(0).toUpperCase()}
        </span>

        {/* Client name */}
        <span className="flex-1 truncate text-sm font-semibold text-slate-700">
          {folder.client_name}
        </span>

        {/* Badge */}
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {folder.catalogs.length}
        </span>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Diagram list */}
      {open && (
        <div className="border-t border-slate-100 px-1 py-1">
          {folder.catalogs.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">No diagrams in this client folder yet.</p>
          ) : (
            folder.catalogs.map((cat) => <DiagramRow key={cat.id} cat={cat} />)
          )}
        </div>
      )}
    </div>
  );
}

// ── MyDiagramsSection ─────────────────────────────────────────────────────────

function MyDiagramsSection({ catalogs }: { catalogs: ClientCatalog[] }) {
  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </span>
        <h2 className="text-base font-bold text-slate-800">My Diagrams</h2>
        <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600">
          {catalogs.length}
        </span>
      </div>

      {catalogs.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-5 py-6">
          <svg className="h-8 w-8 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-500">No personal diagrams yet</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Upload a file or start with an AI prompt to create one.
            </p>
          </div>
          <Link href="/documents" className="ml-auto shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700">
            Upload
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {catalogs.map((cat) => (
              <div key={cat.id} className="px-1">
                <DiagramRow cat={cat} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ClientFolders() {
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFolders(data);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
        {error}
      </div>
    );
  }

  // Split "My Diagrams" from named client folders
  const myDiagrams = folders.find((f) => f.client_name === "My Diagrams");
  const clientFolders = folders.filter((f) => f.client_name !== "My Diagrams");

  return (
    <div>
      {/* ── My Diagrams ── */}
      <MyDiagramsSection catalogs={myDiagrams?.catalogs ?? []} />

      {/* ── Client Diagrams ── */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25A2.25 2.25 0 004.5 16.5h15a2.25 2.25 0 002.25-2.25V8.25A2.25 2.25 0 0019.5 6h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </span>
          <h2 className="text-base font-bold text-slate-800">Client Diagrams</h2>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {clientFolders.length} client{clientFolders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {clientFolders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-500">No client folders yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Upload a file and assign it a client name to create a client folder.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientFolders.map((folder, idx) => (
              <ClientAccordion
                key={folder.client_name}
                folder={folder}
                accentColor={CLIENT_ACCENT[idx % CLIENT_ACCENT.length]}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

