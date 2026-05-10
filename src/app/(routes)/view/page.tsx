"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactFlow, { ReactFlowProvider, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import CapabilityNode, { type CapabilityNodeData } from "@/components/canvas/CapabilityNode";
import LeftSidebar from "@/components/canvas/LeftSidebar";
import type { Capability } from "@/types/capability";

const NODE_TYPES = { capability: CapabilityNode };

const LEVEL_LABELS = ["L0 domain", "L1 group", "L2 subgroup", "L3 leaf"];

const LEVEL_BG_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d",
  1: "#2563eb",
  2: "#599dff",
  3: "#ffffff",
};

const LEVEL_BORDER_DEFAULTS: Record<number, string> = {
  0: "#0f1b2d",
  1: "#2563eb",
  2: "#599dff",
  3: "#d1e3ff",
};

export default function ViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading diagram...</p>
        </div>
      }
    >
      <ReactFlowProvider>
        <ViewContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

// ── Read-only Right Sidebar ──────────────────────────────────────────────────
function ReadOnlyRightSidebar({
  node,
  capabilities,
}: {
  node: { id: string; data: CapabilityNodeData } | null;
  capabilities: Capability[];
}) {
  if (!node) {
    return (
      <aside className="flex w-64 flex-shrink-0 flex-col border-l border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Node properties</h3>
        <p className="mt-4 text-xs text-slate-400">Click a node to inspect</p>
      </aside>
    );
  }

  const { data } = node;
  const cap = capabilities.find((c) => c.id === node.id);
  const parentCap = cap?.parent_id
    ? capabilities.find((c) => c.id === cap.parent_id)
    : null;
  const grandparentCap = parentCap?.parent_id
    ? capabilities.find((c) => c.id === parentCap.parent_id)
    : null;

  const childLevel = data.level === 1 ? 2 : data.level === 2 ? 3 : null;
  const children = childLevel !== null
    ? capabilities
        .filter((c) => c.parent_id === node.id && c.level === childLevel)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Node properties</h3>
        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          Read-only
        </span>
      </div>

      <div className="mt-4 space-y-4 text-sm">
        {/* Selected name */}
        <div>
          <span className="block text-xs text-slate-400">Selected</span>
          <span className="mt-0.5 block break-words font-medium text-slate-800">{data.label}</span>
        </div>

        {/* Level badge */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Level</span>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {LEVEL_LABELS[data.level]}
          </span>
        </div>

        {/* Grandparent */}
        {data.level >= 2 && (
          <div>
            <span className="block text-xs text-slate-400">Grandparent</span>
            <span className="mt-0.5 block break-words text-xs text-slate-600">
              {grandparentCap?.name ?? "—"}
            </span>
          </div>
        )}

        {/* Parent */}
        {data.level > 0 && (
          <div>
            <span className="block text-xs text-slate-400">Parent</span>
            <span className="mt-0.5 block break-words text-xs text-slate-600">
              {parentCap?.name ?? "—"}
            </span>
          </div>
        )}

        <hr className="border-slate-100" />

        {/* Background color */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Background</span>
          <span
            className="h-6 w-8 rounded border border-slate-200"
            style={{ backgroundColor: data.fill || LEVEL_BG_DEFAULTS[data.level] }}
          />
        </div>

        {/* Border color */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Border</span>
          <span
            className="h-6 w-8 rounded border border-slate-200"
            style={{ backgroundColor: data.border || LEVEL_BORDER_DEFAULTS[data.level] }}
          />
        </div>

        {/* Note */}
        {data.note && (
          <div>
            <span className="block text-xs text-slate-400">Note</span>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              {data.note}
            </p>
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div>
            <span className="block text-xs text-slate-400">Description</span>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              {data.description}
            </p>
          </div>
        )}

        {/* Children list */}
        {children.length > 0 && (
          <>
            <hr className="border-slate-100" />
            <div>
              <span className="block text-xs text-slate-400">
                {LEVEL_LABELS[childLevel!]} children
                <span className="ml-1 text-slate-300">({children.length})</span>
              </span>
              <ul className="mt-2 space-y-1">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 break-words"
                  >
                    {child.name}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function ViewContent() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get("catalogId");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [catalogName, setCatalogName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleLevels, setVisibleLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onToggleLevel = useCallback((level: number) => {
    setVisibleLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!catalogId) {
      setError("No catalog ID provided");
      setLoading(false);
      return;
    }

    async function loadCatalog() {
      try {
        const res = await fetch(`/api/catalogs/${encodeURIComponent(catalogId!)}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load catalog");
        }
        const data = await res.json();
        setCatalogName(data.catalog.name);
        setCapabilities(data.capabilities);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load catalog");
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [catalogId]);

  const nodes = useMemo(
    () => buildCanvasNodes(capabilities, visibleLevels),
    [capabilities, visibleLevels]
  );

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find((n) => n.id === selectedNodeId);
    if (!n) return null;
    return { id: n.id, data: n.data };
  }, [selectedNodeId, nodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<CapabilityNodeData>) => {
    setSelectedNodeId(node.id);
    setSidebarOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-sm text-red-500">{error}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">Read-Only View</span>
          </div>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-sm font-medium text-slate-700">{catalogName}</span>
          <span className="text-xs text-slate-400">
            ({capabilities.length} capabilities)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            View Only
          </span>
        </div>
      </header>

      {/* Body: left sidebar + canvas + right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar visibleLevels={visibleLevels} onToggleLevel={onToggleLevel} />

        {/* Canvas area */}
        <div className="relative flex-1 overflow-auto">
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={NODE_TYPES}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onNodeClick={onNodeClick}
            panOnDrag
            zoomOnScroll
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          />
        </div>

        {/* Read-only right sidebar with collapse arrow */}
        {sidebarOpen && selectedNode && (
          <div className="relative flex">
            <button
              onClick={() => {
                setSidebarOpen(false);
                setSelectedNodeId(null);
              }}
              className="absolute -left-5 top-3 z-10 flex h-8 w-5 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white text-slate-400 shadow-sm hover:text-slate-600"
              title="Close sidebar"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <ReadOnlyRightSidebar node={selectedNode} capabilities={capabilities} />
          </div>
        )}
      </div>
    </div>
  );
}
