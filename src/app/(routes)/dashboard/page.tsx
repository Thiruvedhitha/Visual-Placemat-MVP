"use client";

import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ReactFlow, {
  Background,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import CapabilityNode from "@/components/canvas/CapabilityNode";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";
import LeftSidebar from "@/components/canvas/LeftSidebar";
import RightSidebar from "@/components/canvas/RightSidebar";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import { handleNodeDragDrop } from "@/lib/canvas/dragDropHandler";
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
  const [dragMessage, setDragMessage] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ x: number; y: number; width: number; targetId: string; mode: "after" | "into"; insertAfterId: string | null; newParentId: string | null } | null>(null);

  const { getIntersectingNodes, getNode } = useReactFlow();

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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Handler functions - define before useEffect that uses them
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<CapabilityNodeData>) => {
      if (node.type === "capability") {
        setSelectedNodeId(node.id);
      }
    },
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



  const rebuildInteractiveNodes = useCallback(() => {
    if (capabilities.length === 0) {
      setNodes([]);
      return;
    }

    const nextNodes = buildCanvasNodes(capabilities, visibleLevels).map((node) => ({
      ...node,
      draggable: node.data.level >= 1,
      selected: node.id === selectedNodeId,
      // L0 behind everything, L1 as container behind L2/L3
      zIndex: node.data.level === 0 ? -1 : node.data.level === 1 ? 0 : node.zIndex ?? node.data.level,
    }));

    setNodes(nextNodes);
  }, [capabilities, selectedNodeId, visibleLevels]);

  const onNodeDragStart: NodeDragHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onNodeDrag: NodeDragHandler = useCallback(
    (_, node) => {
      const dragLevel = (node.data as CapabilityNodeData).level;
      const intersecting = getIntersectingNodes(node);

      // Find best target: same level first, then parent level
      let target = intersecting.find(
        (n) => n.id !== node.id && (n.data as CapabilityNodeData).level === dragLevel
      );
      let mode: "after" | "into" = "after";

      if (!target && dragLevel > 0) {
        target = intersecting.find(
          (n) => n.id !== node.id && (n.data as CapabilityNodeData).level === dragLevel - 1
        );
        if (target) mode = "into";
      }

      if (target) {
        const targetNode = getNode(target.id);
        if (targetNode) {
          const tData = targetNode.data as CapabilityNodeData;
          const tW = tData.colWidth ?? tData.nodeWidth ?? 200;
          const tH = tData.nodeHeight ?? 36;

          if (mode === "after") {
            // Compare dragged node center Y vs target center Y to decide above/below
            const dragCenterY = node.position.y + ((node.data as CapabilityNodeData).nodeHeight ?? 36) / 2;
            const targetCenterY = targetNode.position.y + tH / 2;
            const isAbove = dragCenterY < targetCenterY;

            // Find the correct insertAfterId
            const targetCap = capabilities.find((c) => c.id === target!.id);
            let insertAfterId: string | null;
            let indicatorY: number;

            if (isAbove) {
              // Insert before target: find previous sibling
              if (targetCap) {
                const siblings = capabilities
                  .filter((c) => c.parent_id === targetCap.parent_id && c.level === targetCap.level && c.id !== node.id)
                  .sort((a, b) => a.sort_order - b.sort_order);
                const targetIdx = siblings.findIndex((s) => s.id === target!.id);
                insertAfterId = targetIdx > 0 ? siblings[targetIdx - 1].id : null;
              } else {
                insertAfterId = null;
              }
              indicatorY = targetNode.position.y; // line at top of target
            } else {
              // Insert after target
              insertAfterId = target!.id;
              indicatorY = targetNode.position.y + tH; // line at bottom of target
            }

            setDropIndicator({
              x: targetNode.position.x,
              y: indicatorY,
              width: tW,
              targetId: target.id,
              mode,
              insertAfterId,
              newParentId: targetCap?.parent_id ?? null,
            });
          } else {
            // "into" mode: highlight the container
            setDropIndicator({
              x: targetNode.position.x,
              y: targetNode.position.y,
              width: tW,
              targetId: target.id,
              mode,
              insertAfterId: null,
              newParentId: target.id,
            });
          }
        }
      } else {
        setDropIndicator(null);
      }
    },
    [getIntersectingNodes, getNode, capabilities]
  );

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node) => {
      const draggedCap = capabilities.find((c) => c.id === node.id);
      if (!draggedCap) {
        setDropIndicator(null);
        rebuildInteractiveNodes();
        return;
      }

      // Use the pre-computed drop indicator for exact placement
      if (!dropIndicator) {
        rebuildInteractiveNodes();
        return;
      }

      const newParentId = dropIndicator.newParentId;
      const insertAfterId = dropIndicator.insertAfterId;

      const result = handleNodeDragDrop(
        node.id,
        newParentId,
        insertAfterId,
        capabilities
      );

      if (result.message.includes("Cannot") || result.message.includes("not found")) {
        setDragMessage("❌ " + result.message);
        setTimeout(() => setDragMessage(null), 3000);
        rebuildInteractiveNodes();
      } else {
        setCapabilities(result.updatedCapabilities);
        useCatalogStore.setState({
          capabilities: result.updatedCapabilities,
          isDirty: true,
        });
        setSelectedNodeId(node.id);
        setDragMessage("✅ " + result.message);
        setTimeout(() => setDragMessage(null), 3000);
      }

      setDropIndicator(null);
    },
    [capabilities, dropIndicator, rebuildInteractiveNodes]
  );

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

  // Rebuild nodes when capabilities or visible levels change
  useEffect(() => {
    rebuildInteractiveNodes();
  }, [rebuildInteractiveNodes]);

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
    <div className="flex h-[calc(100vh-var(--navbar-height))] flex-col overflow-hidden bg-slate-50">
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
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onPaneClick={onPaneClick}
            nodesDraggable={true}
            panOnDrag={true}
            panOnScroll={true}
            panOnScrollMode={"free" as import("reactflow").PanOnScrollMode}
            zoomOnScroll={true}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#e2e8f0" />

            {/* Drop indicator */}
            {dropIndicator && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  pointerEvents: "none",
                  zIndex: 9999,
                  transform: `translate(${dropIndicator.x}px, ${dropIndicator.y}px)`,
                }}
              >
                {dropIndicator.mode === "after" ? (
                  // Horizontal insertion line
                  <div
                    style={{
                      width: `${dropIndicator.width}px`,
                      height: "3px",
                      background: "#f59e0b",
                      borderRadius: "2px",
                      boxShadow: "0 0 8px 2px rgba(245, 158, 11, 0.5)",
                      position: "relative",
                    }}
                  >
                    {/* Circle indicators at ends */}
                    <div style={{
                      position: "absolute", left: "-4px", top: "-3px",
                      width: "9px", height: "9px", borderRadius: "50%",
                      background: "#f59e0b", border: "2px solid #fff",
                    }} />
                    <div style={{
                      position: "absolute", right: "-4px", top: "-3px",
                      width: "9px", height: "9px", borderRadius: "50%",
                      background: "#f59e0b", border: "2px solid #fff",
                    }} />
                  </div>
                ) : (
                  // "Into" container highlight
                  <div
                    style={{
                      width: `${dropIndicator.width}px`,
                      height: "40px",
                      border: "2px dashed #f59e0b",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.08)",
                      boxShadow: "0 0 10px 2px rgba(245, 158, 11, 0.3)",
                    }}
                  />
                )}
              </div>
            )}
          </ReactFlow>
          {dragMessage && (
            <div className="absolute bottom-4 left-4 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white shadow-lg">
              {dragMessage}
            </div>
          )}
        </div>

        <RightSidebar
          node={
            selectedNode && selectedNode.type === "capability"
              ? { id: selectedNode.id, data: selectedNode.data as import("@/components/canvas/CapabilityNode").CapabilityNodeData }
              : null
          }
          onUpdateNode={onUpdateNode}
        />
      </div>


    </div>
  );
}
