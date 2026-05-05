"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientFolder } from "@/app/api/clients/route";

const LAYERS = [
  { level: 0, label: "L0 — Domain", color: "#0f1b2d" },
  { level: 1, label: "L1 — Group", color: "#1545d8" },
  { level: 2, label: "L2 — Subgroup", color: "#599dff" },
  { level: 3, label: "L3 — Leaf", color: "#d1e3ff" },
];

const FOLDER_DOT_COLORS = [
  "bg-blue-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-cyan-400",
];

interface LeftSidebarProps {
  visibleLevels: Set<number>;
  onToggleLevel: (level: number) => void;
}

export default function LeftSidebar({ visibleLevels, onToggleLevel }: LeftSidebarProps) {
  const [folders, setFolders] = useState<ClientFolder[]>([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data: ClientFolder[]) => {
        if (Array.isArray(data)) {
          setFolders(data);
          // Open first folder by default
          if (data.length > 0) {
            setOpenFolders(new Set([data[0].client_name]));
          }
        }
      })
      .catch(() => {/* silently ignore in sidebar */});
  }, []);

  const toggleFolder = (name: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <aside className="flex w-52 flex-shrink-0 flex-col gap-0 overflow-y-auto border-r border-slate-200 bg-white">

      {/* ── Client Folders ── */}
      <div className="border-b border-slate-100 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Client Diagrams
          </h3>
          <Link
            href="/"
            className="text-[10px] text-brand-500 hover:underline"
            title="View all"
          >
            All
          </Link>
        </div>

        {folders.length === 0 ? (
          <p className="text-[11px] text-slate-400">No diagrams yet</p>
        ) : (
          <ul className="space-y-0.5">
            {folders.map((folder, idx) => {
              const isOpen = openFolders.has(folder.client_name);
              const dotColor = FOLDER_DOT_COLORS[idx % FOLDER_DOT_COLORS.length];
              return (
                <li key={folder.client_name}>
                  {/* Folder row */}
                  <button
                    onClick={() => toggleFolder(folder.client_name)}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    <svg
                      className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                    <span className="flex-1 truncate font-medium">{folder.client_name}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{folder.catalogs.length}</span>
                  </button>

                  {/* Diagrams under this folder */}
                  {isOpen && folder.catalogs.length > 0 && (
                    <ul className="ml-5 mt-0.5 space-y-0.5">
                      {folder.catalogs.map((cat) => (
                        <li key={cat.id}>
                          <Link
                            href={`/dashboard?catalogId=${encodeURIComponent(cat.id)}`}
                            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                          >
                            <svg
                              className="h-3 w-3 shrink-0 text-slate-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                            </svg>
                            <span className="truncate">{cat.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Layers / Legend ── */}
      <div className="p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Layers
        </h3>
        <ul className="space-y-1.5">
          {LAYERS.map((l) => (
            <li key={l.level} className="flex items-center gap-2">
              <button
                onClick={() => onToggleLevel(l.level)}
                className="flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-brand-600"
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
    </aside>
  );
}

