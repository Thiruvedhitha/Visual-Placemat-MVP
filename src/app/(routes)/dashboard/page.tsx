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
  const catalogId = searchParams.get("catalogId");

  // Data
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas state
  const [nodes, setNodes] = useState<Node<CapabilityNodeData>[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visibleLevels, setVisibleLevels] = useState<Set<number>>(
    new Set([0, 1, 2, 3])
  );
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("select");

  // Fetch capabilities
  useEffect(() => {
    if (!catalogId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/capabilities?catalogId=${encodeURIComponent(catalogId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCapabilities(data);
        } else {
          setError(data.error || "Failed to load capabilities");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [catalogId]);

  // Rebuild nodes when capabilities or visible levels change
  useEffect(() => {
    if (capabilities.length > 0) {
      setNodes(buildCanvasNodes(capabilities, visibleLevels));
    }
  }, [capabilities, visibleLevels]);

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

  if (error || !catalogId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-sm text-red-500">{error || "No catalog selected"}</p>
        <Link href="/" className="text-sm text-brand-600 hover:underline">
          ← Back to Home
        </Link>
      </div>
    );
  }

  const exportHref = `/export?catalogId=${encodeURIComponent(catalogId)}`;

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
