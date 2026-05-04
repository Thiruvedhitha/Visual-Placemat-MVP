"use client";

import { useState } from "react";
import Link from "next/link";

const LAYERS = [
  { level: 0, label: "L0 — Domain", color: "#0f1b2d" },
  { level: 1, label: "L1 — Group", color: "#1545d8" },
  { level: 2, label: "L2 — Subgroup", color: "#599dff" },
  { level: 3, label: "L3 — Leaf", color: "#d1e3ff" },
];

// ─── Client folder data ───────────────────────────────────────────────────────
// Replace with real API data (GET /api/clients) in v2.
type Diagram = { id: string; name: string; catalogId: string };
type Client = { id: string; name: string; initials: string; color: string; diagrams: Diagram[] };

const MY_DIAGRAMS: Diagram[] = [
  { id: "my-1", name: "Capability Map v2",    catalogId: "mock-my-1" },
  { id: "my-2", name: "IT Architecture Draft", catalogId: "mock-my-2" },
];

const CLIENTS: Client[] = [
  {
    id: "amex", name: "Amex", initials: "AX", color: "bg-blue-600",
    diagrams: [
      { id: "a1", name: "SPM Banking Map",          catalogId: "mock-amex-1" },
      { id: "a2", name: "Risk Management v3",        catalogId: "mock-amex-2" },
      { id: "a3", name: "Loyalty Program",           catalogId: "mock-amex-3" },
    ],
  },
  {
    id: "swa", name: "SWA", initials: "SW", color: "bg-amber-500",
    diagrams: [
      { id: "s1", name: "SPM Airline Map",           catalogId: "mock-swa-1" },
      { id: "s2", name: "Customer Experience Map",   catalogId: "mock-swa-2" },
    ],
  },
  {
    id: "takeda", name: "Takeda", initials: "TK", color: "bg-emerald-600",
    diagrams: [
      { id: "t1", name: "Clinical Operations Map",   catalogId: "mock-takeda-1" },
      { id: "t2", name: "R&D Capability Map",        catalogId: "mock-takeda-2" },
      { id: "t3", name: "Supply Chain",              catalogId: "mock-takeda-3" },
    ],
  },
];

// ─── Collapsible client folder row ───────────────────────────────────────────
function ClientFolder({ client, activeCatalogId }: { client: Client; activeCatalogId?: string | null }) {
  const [open, setOpen] = useState(
    () => client.diagrams.some((d) => d.catalogId === activeCatalogId)
  );

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
      >
        <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${client.color}`}>
          {client.initials}
        </span>
        <span className="flex-1 truncate text-xs font-medium text-slate-700">{client.name}</span>
        <svg
          className={`h-3 w-3 flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {open && (
        <ul className="ml-7 mt-0.5 space-y-0.5">
          {client.diagrams.map((d) => (
            <li key={d.id}>
              <Link
                href={`/dashboard?catalogId=${encodeURIComponent(d.catalogId)}`}
                className={`block truncate rounded px-2 py-1 text-xs transition-colors hover:bg-brand-50 hover:text-brand-700 ${
                  d.catalogId === activeCatalogId
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-600"
                }`}
              >
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface LeftSidebarProps {
  visibleLevels: Set<number>;
  onToggleLevel: (level: number) => void;
  /** catalogId of the currently open diagram — used to auto-expand the right folder */
  activeCatalogId?: string | null;
}

export default function LeftSidebar({ visibleLevels, onToggleLevel, activeCatalogId }: LeftSidebarProps) {
  return (
    <aside className="flex w-52 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
      <div className="flex flex-col gap-5 p-4">

        {/* ── Layers ── */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Layers
          </h3>
          <ul className="space-y-1.5">
            {LAYERS.map((l) => (
              <li key={l.level} className="flex items-center gap-2">
                <button
                  onClick={() => onToggleLevel(l.level)}
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full transition-opacity"
                    style={{
                      background: l.color,
                      opacity: visibleLevels.has(l.level) ? 1 : 0.3,
                    }}
                  />
                  <span style={{ opacity: visibleLevels.has(l.level) ? 1 : 0.5 }}>
                    {l.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-slate-100" />

        {/* ── My Diagrams ── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">My Diagrams</h3>
            <Link href="/documents" className="text-[10px] font-medium text-brand-600 hover:underline">+ New</Link>
          </div>
          <ul className="space-y-0.5">
            {MY_DIAGRAMS.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard?catalogId=${encodeURIComponent(d.catalogId)}`}
                  className={`block truncate rounded px-2 py-1 text-xs transition-colors hover:bg-brand-50 hover:text-brand-700 ${
                    d.catalogId === activeCatalogId
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-slate-600"
                  }`}
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Client Folders ── */}
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Client Folders</h3>
          <div className="space-y-0.5">
            {CLIENTS.map((client) => (
              <ClientFolder key={client.id} client={client} activeCatalogId={activeCatalogId} />
            ))}
          </div>
        </div>

      </div>
    </aside>
  );
}
