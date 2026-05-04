"use client";

/**
 * ClientFolders — home page workspace browser.
 *
 * DB model this maps to:
 *
 *   clients (id, name, color, owner_session_id, created_at)
 *     └─ capability_catalogs (id, client_id FK nullable, name, industry,
 *                             node_count, updated_at, session_id)
 *
 *   client_access (client_id, session_id) → grants read/write to all
 *   catalogs under that client + "My Diagrams" are always visible.
 *
 * For MVP the data below is static mock data.
 * Replace `MOCK_CLIENTS` and `MOCK_MY_DIAGRAMS` with a fetch from
 *   GET /api/clients?sessionId=<id>
 *   GET /api/catalogs?sessionId=<id>&clientId=<id>
 * once the API layer is wired.
 */

import { useState } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type Diagram = {
  id: string;
  name: string;
  industry: string;
  nodes: number;
  updatedAt: string;
  catalogId: string;
};

type Client = {
  id: string;
  name: string;
  /** Short acronym shown in the folder avatar */
  initials: string;
  /** Tailwind bg class for the avatar */
  avatarColor: string;
  diagrams: Diagram[];
};

// ─── Mock data ───────────────────────────────────────────────────────────────
// Swap these out for real API data in v2.

const MOCK_MY_DIAGRAMS: Diagram[] = [
  {
    id: "my-1",
    name: "Capability Map v2",
    industry: "Technology",
    nodes: 48,
    updatedAt: "2 days ago",
    catalogId: "mock-my-1",
  },
  {
    id: "my-2",
    name: "IT Architecture Draft",
    industry: "Technology",
    nodes: 31,
    updatedAt: "5 days ago",
    catalogId: "mock-my-2",
  },
];

const MOCK_CLIENTS: Client[] = [
  {
    id: "amex",
    name: "American Express (Amex)",
    initials: "AX",
    avatarColor: "bg-blue-600",
    diagrams: [
      {
        id: "amex-1",
        name: "SPM Banking Map",
        industry: "Banking",
        nodes: 64,
        updatedAt: "1 day ago",
        catalogId: "mock-amex-1",
      },
      {
        id: "amex-2",
        name: "Risk Management v3",
        industry: "Banking",
        nodes: 42,
        updatedAt: "3 days ago",
        catalogId: "mock-amex-2",
      },
      {
        id: "amex-3",
        name: "Loyalty Program Capabilities",
        industry: "Banking",
        nodes: 28,
        updatedAt: "1 week ago",
        catalogId: "mock-amex-3",
      },
    ],
  },
  {
    id: "swa",
    name: "Southwest Airlines (SWA)",
    initials: "SW",
    avatarColor: "bg-amber-500",
    diagrams: [
      {
        id: "swa-1",
        name: "SPM Airline Map",
        industry: "Airline / Retail",
        nodes: 55,
        updatedAt: "2 days ago",
        catalogId: "mock-swa-1",
      },
      {
        id: "swa-2",
        name: "Customer Experience Map",
        industry: "Airline / Retail",
        nodes: 37,
        updatedAt: "4 days ago",
        catalogId: "mock-swa-2",
      },
    ],
  },
  {
    id: "takeda",
    name: "Takeda Pharma",
    initials: "TK",
    avatarColor: "bg-emerald-600",
    diagrams: [
      {
        id: "takeda-1",
        name: "Clinical Operations Map",
        industry: "Healthcare",
        nodes: 72,
        updatedAt: "3 days ago",
        catalogId: "mock-takeda-1",
      },
      {
        id: "takeda-2",
        name: "R&D Capability Map",
        industry: "Healthcare",
        nodes: 58,
        updatedAt: "1 week ago",
        catalogId: "mock-takeda-2",
      },
      {
        id: "takeda-3",
        name: "Supply Chain Capabilities",
        industry: "Healthcare",
        nodes: 33,
        updatedAt: "2 weeks ago",
        catalogId: "mock-takeda-3",
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DiagramCard({ diagram }: { diagram: Diagram }) {
  return (
    <Link
      href={`/dashboard?catalogId=${encodeURIComponent(diagram.catalogId)}`}
      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-150 hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
    >
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">
          {diagram.name}
        </span>
        <span className="block text-xs text-slate-400">
          {diagram.industry} · {diagram.nodes} nodes · {diagram.updatedAt}
        </span>
      </div>
      <svg
        className="ml-3 h-4 w-4 flex-shrink-0 text-slate-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-brand-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

function ClientFolder({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Folder header — click to collapse/expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        {/* Client avatar */}
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${client.avatarColor}`}
        >
          {client.initials}
        </span>

        {/* Name + count */}
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">
            {client.name}
          </span>
          <span className="block text-xs text-slate-400">
            {client.diagrams.length} diagram{client.diagrams.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Diagrams list — only when expanded */}
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {client.diagrams.map((d) => (
            <DiagramCard key={d.id} diagram={d} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function ClientFolders() {
  return (
    <section className="w-full space-y-8">
      {/* ── My Diagrams ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">My Diagrams</h2>
          <Link
            href="/documents"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            + New diagram
          </Link>
        </div>
        <div className="space-y-2">
          {MOCK_MY_DIAGRAMS.map((d) => (
            <DiagramCard key={d.id} diagram={d} />
          ))}
        </div>
      </div>

      {/* ── Client Folders ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">Client Folders</h2>
          <button className="text-xs font-medium text-brand-600 hover:underline">
            + New client
          </button>
        </div>
        <div className="space-y-3">
          {MOCK_CLIENTS.map((client) => (
            <ClientFolder key={client.id} client={client} />
          ))}
        </div>
      </div>
    </section>
  );
}
