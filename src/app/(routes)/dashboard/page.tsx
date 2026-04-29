"use client";

import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactFlow, {
  Background,
  type Node,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import CapabilityNode from "@/components/canvas/CapabilityNode";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";
import LeftSidebar from "@/components/canvas/LeftSidebar";
import RightSidebar from "@/components/canvas/RightSidebar";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import type { Capability } from "@/types/capability";
import { useCatalogStore } from "@/stores/catalogStore";

const NODE_TYPES = { capability: CapabilityNode };

export default function DashboardCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading canvas…</p>
        </div>
      }
    >
      <ReactFlowProvider>
        <DashboardContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const catalogIdParam = searchParams.get("catalogId");

  // Zustand store
  const storeCapabilities = useCatalogStore((s) => s.capabilities);
  const storeCatalogId = useCatalogStore((s) => s.catalogId);
  const catalogName = useCatalogStore((s) => s.catalogName);
  const isDirty = useCatalogStore((s) => s.isDirty);
  const loadFromDB = useCatalogStore((s) => s.loadFromDB);
  const markSaved = useCatalogStore((s) => s.markSaved);

  // Data
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Canvas state
  const [nodes, setNodes] = useState<Node<CapabilityNodeData>[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visibleLevels, setVisibleLevels] = useState<Set<number>>(
    new Set([0, 1, 2, 3])
  );
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("select");

  // Load capabilities: Zustand first, then DB fallback
  useEffect(() => {
    // If Zustand has capabilities, use those
    if (storeCapabilities.length > 0) {
      setCapabilities(storeCapabilities);
      setLoading(false);
      return;
    }

    // Otherwise, try to fetch from DB if catalogId is in the URL
    if (!catalogIdParam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/capabilities?catalogId=${encodeURIComponent(catalogIdParam)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCapabilities(data);
          // Also populate the Zustand store so edits stay local
          loadFromDB(catalogIdParam, catalogIdParam, data);
        } else {
          setError(data.error || "Failed to load capabilities");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [catalogIdParam, storeCapabilities, loadFromDB]);

  // Rebuild nodes when capabilities or visible levels change
  useEffect(() => {
    if (capabilities.length > 0) {
      setNodes(buildCanvasNodes(capabilities, visibleLevels));
    }
  }, [capabilities, visibleLevels]);

  // Apply: bulk save to Supabase
  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/catalogs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId: storeCatalogId,
          catalogName,
          capabilities,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error || "Save failed");
        return;
      }
      markSaved(data.catalogId);
    } catch {
      setApplyError("Network error. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  // Handlers
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<CapabilityNodeData>) =>
      setSelectedNodeId(node.id),
    []
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onToggleLevel = useCallback((level: number) => {
    setVisibleLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const onUpdateNode = useCallback(
    (id: string, patch: Partial<CapabilityNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        )
      );
    },
    []
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [selectedNodeId, nodes]
  );

  // Loading / error states
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading capabilities…</p>
      </div>
    );
  }

  if (error || (!catalogIdParam && capabilities.length === 0)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-sm text-red-500">{error || "No catalog loaded"}</p>
        <Link href="/documents" className="text-sm text-brand-600 hover:underline">
          ← Upload a file
        </Link>
      </div>
    );
  }

  const exportHref = storeCatalogId
    ? `/export?catalogId=${encodeURIComponent(storeCatalogId)}`
    : "#";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Top bar with toolbar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-brand-600 hover:underline">
            ← Home
          </Link>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-sm font-medium text-slate-700">
            Capability Canvas
          </span>
          <span className="text-xs text-slate-400">
            ({capabilities.length} capabilities)
          </span>
        </div>

        {/* Toolbar in header */}
        <div className="flex items-center gap-3">
          <CanvasToolbar
            interactionMode={interactionMode}
            onModeChange={setInteractionMode}
          />
          {applyError && (
            <p className="text-xs text-red-500">{applyError}</p>
          )}
          <button
            onClick={handleApply}
            disabled={applying || !isDirty}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm transition ${
              isDirty && !applying
                ? "bg-green-600 text-white hover:bg-green-700"
                : "cursor-not-allowed bg-slate-100 text-slate-300"
            }`}
          >
            {applying ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : isDirty ? (
              "Apply"
            ) : (
              "Saved"
            )}
          </button>
          <Link
            href={exportHref}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Export
          </Link>
        </div>
      </header>

      {/* Body: left sidebar + canvas + right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar visibleLevels={visibleLevels} onToggleLevel={onToggleLevel} />

        {/* Canvas area — full space, no overlapping toolbar */}
        <div className="relative flex-1 overflow-auto">
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodesDraggable={false}
            panOnDrag
            panOnScroll
            zoomOnScroll
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#e2e8f0" />
          </ReactFlow>
        </div>

        <RightSidebar
          node={selectedNode ? { id: selectedNode.id, data: selectedNode.data } : null}
          onUpdateNode={onUpdateNode}
        />
      </div>
    </div>
  );
}
