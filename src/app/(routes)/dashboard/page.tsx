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
} from "reactflow";
import "reactflow/dist/style.css";

import CapabilityNode from "@/components/canvas/CapabilityNode";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";
import DropContainerNode from "@/components/canvas/DropContainerNode";
import type { DropContainerNodeData } from "@/components/canvas/DropContainerNode";
import LeftSidebar from "@/components/canvas/LeftSidebar";
import RightSidebar from "@/components/canvas/RightSidebar";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import { handleNodeDragDrop } from "@/lib/canvas/dragDropHandler";
import type { Capability } from "@/types/capability";
import { useCatalogStore } from "@/stores/catalogStore";

const NODE_TYPES = { capability: CapabilityNode, dropContainer: DropContainerNode };

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
  const [nodes, setNodes] = useState<Node<CapabilityNodeData | DropContainerNodeData>[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visibleLevels, setVisibleLevels] = useState<Set<number>>(
    new Set([0, 1, 2, 3])
  );
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("select");
  const [dragMessage, setDragMessage] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [hoveredContainerNodeId, setHoveredContainerNodeId] = useState<string | null>(null);

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
    (_: React.MouseEvent, node: Node<CapabilityNodeData | DropContainerNodeData>) => {
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



  const findClosestAncestorAtLevel = useCallback(
    (startNode: Capability, targetLevel: 0 | 1 | 2 | 3) => {
      let current: Capability | undefined = startNode;

      while (current) {
        if (current.level === targetLevel) {
          return current;
        }
        current = current.parent_id
          ? capabilities.find((cap) => cap.id === current?.parent_id)
          : undefined;
      }

      return null;
    },
    [capabilities]
  );

  const findLastChildAtLevel = useCallback(
    (parentId: string, level: 0 | 1 | 2 | 3) => {
      const children = capabilities
        .filter((cap) => cap.parent_id === parentId && cap.level === level)
        .sort((a, b) => b.sort_order - a.sort_order);

      return children[0] ?? null;
    },
    [capabilities]
  );

  const findDescendantsAtLevel = useCallback(
    (startNodeId: string, level: 0 | 1 | 2 | 3) => {
      const queue = [startNodeId];
      const descendants: Capability[] = [];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = capabilities
          .filter((cap) => cap.parent_id === currentId)
          .sort((a, b) => a.sort_order - b.sort_order);

        for (const child of children) {
          if (child.level === level) {
            descendants.push(child);
          }
          queue.push(child.id);
        }
      }

      return descendants;
    },
    [capabilities]
  );

  const resolveDropPlacement = useCallback(
    (targetNode: Capability, selectedLevel: 0 | 1 | 2 | 3) => {
      if (selectedLevel === 0) {
        const rootTarget = findClosestAncestorAtLevel(targetNode, 0);
        return {
          newParentId: null,
          insertAfterNodeId: rootTarget?.id ?? targetNode.id,
        };
      }

      if (targetNode.level === selectedLevel) {
        return {
          newParentId: targetNode.parent_id,
          insertAfterNodeId: targetNode.id,
        };
      }

      if (selectedLevel === 1) {
        if (targetNode.level === 0) {
          const lastChild = findLastChildAtLevel(targetNode.id, 1);
          return {
            newParentId: targetNode.id,
            insertAfterNodeId: lastChild?.id ?? null,
          };
        }

        const l1Target = findClosestAncestorAtLevel(targetNode, 1);
        if (l1Target) {
          return {
            newParentId: l1Target.parent_id,
            insertAfterNodeId: l1Target.id,
          };
        }

        const rootTarget = findClosestAncestorAtLevel(targetNode, 0);
        if (rootTarget) {
          const lastChild = findLastChildAtLevel(rootTarget.id, 1);
          return {
            newParentId: rootTarget.id,
            insertAfterNodeId: lastChild?.id ?? null,
          };
        }
      }

      if (selectedLevel === 2) {
        if (targetNode.level === 1) {
          const lastChild = findLastChildAtLevel(targetNode.id, 2);
          return {
            newParentId: targetNode.id,
            insertAfterNodeId: lastChild?.id ?? null,
          };
        }

        const l2Target = findClosestAncestorAtLevel(targetNode, 2);
        if (l2Target) {
          return {
            newParentId: l2Target.parent_id,
            insertAfterNodeId: l2Target.id,
          };
        }

        const l1Container = targetNode.level < 1
          ? findDescendantsAtLevel(targetNode.id, 1).at(-1) ?? null
          : findClosestAncestorAtLevel(targetNode, 1);
        if (l1Container) {
          const lastChild = findLastChildAtLevel(l1Container.id, 2);
          return {
            newParentId: l1Container.id,
            insertAfterNodeId: lastChild?.id ?? null,
          };
        }
      }

      if (selectedLevel === 3) {
        if (targetNode.level === 2) {
          const lastChild = findLastChildAtLevel(targetNode.id, 3);
          return {
            newParentId: targetNode.id,
            insertAfterNodeId: lastChild?.id ?? null,
          };
        }

        const l3Target = findClosestAncestorAtLevel(targetNode, 3);
        if (l3Target) {
          return {
            newParentId: l3Target.parent_id,
            insertAfterNodeId: l3Target.id,
          };
        }

        const l2Container = targetNode.level < 2
          ? findDescendantsAtLevel(targetNode.id, 2).at(-1) ?? null
          : findClosestAncestorAtLevel(targetNode, 2);
        if (l2Container) {
          const lastChild = findLastChildAtLevel(l2Container.id, 3);
          return {
            newParentId: l2Container.id,
            insertAfterNodeId: lastChild?.id ?? null,
          };
        }
      }

      return null;
    },
    [findClosestAncestorAtLevel, findDescendantsAtLevel, findLastChildAtLevel]
  );

  const performDrop = useCallback(
    (draggedNodeId: string, targetNodeId: string, selectedLevel: 0 | 1 | 2 | 3, clientY?: number) => {
      const draggedNode = capabilities.find((c) => c.id === draggedNodeId);
      const targetNode = capabilities.find((c) => c.id === targetNodeId);

      if (!draggedNode || !targetNode) {
        return;
      }

      const placement = resolveDropPlacement(targetNode, selectedLevel);

      if (!placement) {
        setDragMessage(`❌ Cannot place this capability as L${selectedLevel} on the selected target`);
        setTimeout(() => setDragMessage(null), 3000);
        return;
      }

      // Skip if nothing actually changed (e.g. click without drag)
      if (
        draggedNode.parent_id === placement.newParentId &&
        draggedNode.level === selectedLevel
      ) {
        return;
      }

      // Find the nearest sibling above the drop Y for precise insertion position.
      // Falls back to placement.insertAfterNodeId (end of list) when Y is unavailable.
      let insertAfterNodeId = placement.insertAfterNodeId;
      if (clientY != null && placement.newParentId && typeof document !== "undefined") {
        const siblings = capabilities
          .filter((c) => c.parent_id === placement.newParentId && c.id !== draggedNodeId)
          .sort((a, b) => a.sort_order - b.sort_order);

        let bestId: string | null = null;
        let bestMidY = -Infinity;

        for (const sib of siblings) {
          const el = document.querySelector(`[data-capability-node-id="${sib.id}"]`);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const midY = (rect.top + rect.bottom) / 2;
          if (midY <= clientY && midY > bestMidY) {
            bestMidY = midY;
            bestId = sib.id;
          }
        }

        insertAfterNodeId = bestId as string | null; // null = insert at beginning of the list
      }

      const result = handleNodeDragDrop(
        draggedNodeId,
        placement.newParentId,
        insertAfterNodeId,
        capabilities
      );

      if (result.message.includes("Cannot")) {
        setDragMessage("❌ " + result.message);
        setTimeout(() => setDragMessage(null), 3000);
      } else if (result.message.includes("Moved")) {
        setCapabilities(result.updatedCapabilities);
        useCatalogStore.setState({
          capabilities: result.updatedCapabilities,
          isDirty: true,
        });

        // Keep the moved node selected so the user can see where it landed (orange ring)
        setSelectedNodeId(draggedNodeId);
        setDragMessage("✅ " + result.message);
        setTimeout(() => setDragMessage(null), 3000);
      }
    },
    [capabilities, resolveDropPlacement]
  );



  // Use bounding rect to find the most specific (smallest-area) container under the pointer.
  // When only the large L1 zone is hit, fall back to nearest L2 panel by X alignment.
  const getDropTargetFromPoint = useCallback((
    draggedId: string,
    clientX: number,
    clientY: number,
    draggedLevel?: number,
  ) => {
    if (typeof document === "undefined") return null;

    type Hit = { targetId: string; presetLevel: 1 | 2 | 3; containerNodeId: string; area: number };
    const containers = Array.from(document.querySelectorAll<HTMLElement>("[data-drop-container-node-id]"));
    let best: Hit | null = null;

    for (const el of containers) {
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;

      const containerNodeId = el.dataset.dropContainerNodeId!;
      const targetId = el.dataset.dropTargetId!;
      const rawLevel = el.dataset.dropTargetLevel!;
      if (!containerNodeId || !targetId || !rawLevel || targetId === draggedId) continue;

      const area = rect.width * rect.height;
      if (!best || area < best.area) {
        best = { targetId, presetLevel: Number(rawLevel) as 1 | 2 | 3, containerNodeId, area };
      }
    }

    // If only the large L1 zone was hit (drop in a gap between L2 panels or at top/bottom
    // of a column), find the nearest L2 panel by X alignment + Y proximity.
    if (best?.presetLevel === 1 && draggedLevel != null && draggedLevel >= 2) {
      let fallback: Hit | null = null;
      let closestDist = Infinity;

      for (const el of containers) {
        if (Number(el.dataset.dropTargetLevel) !== 2) continue;
        const rect = el.getBoundingClientRect();
        // Must be in the same horizontal sub-column
        if (clientX < rect.left || clientX > rect.right) continue;
        const targetId = el.dataset.dropTargetId!;
        if (!targetId || targetId === draggedId) continue;

        const centerY = (rect.top + rect.bottom) / 2;
        const dist = Math.abs(clientY - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          fallback = {
            targetId,
            presetLevel: 2,
            containerNodeId: el.dataset.dropContainerNodeId!,
            area: rect.width * rect.height,
          };
        }
      }

      if (fallback) best = fallback;
    }

    return best ? { targetId: best.targetId, presetLevel: best.presetLevel, containerNodeId: best.containerNodeId } : null;
  }, []);

  const onNodeDragStart: NodeDragHandler = useCallback(
    (_, node) => {
      // Auto-select the node being dragged — no separate click needed
      setSelectedNodeId(node.id);
      setDraggingNodeId(node.id);
    },
    []
  );

  const onNodeDrag: NodeDragHandler = useCallback(
    (event, node) => {
      const lvl = (node.data as CapabilityNodeData).level;
      const result = getDropTargetFromPoint(node.id, event.clientX, event.clientY, lvl);
      setHoveredContainerNodeId(result?.containerNodeId ?? null);
    },
    [getDropTargetFromPoint]
  );

  const rebuildInteractiveNodes = useCallback(() => {
    if (capabilities.length === 0) {
      setNodes([]);
      return;
    }

    const nextNodes = buildCanvasNodes(capabilities, visibleLevels).map((node) => ({
      ...node,
      draggable: node.type === "capability",
      // Give container nodes a CSS class so globals.css can strip RF's white wrapper
      className: node.type === "dropContainer" ? "drop-container-node" : undefined,
      // Containers keep their level-specific z-index: L1=-2, L2=-1, L3=0 → nested back-to-front.
      // Capability nodes always render above all containers.
      zIndex: node.type === "capability" ? 2 : (node.zIndex ?? 0),
      // Keep the selected node highlighted (orange ring) even after a drop
      selected: node.type === "capability" && node.id === selectedNodeId,
      data: {
        ...node.data,
        ...(node.type === "capability"
          ? {
              canDrag: true,
              isDragging: node.id === draggingNodeId,
              isDropTarget: false,
            }
          : {
              isActive: node.id === hoveredContainerNodeId,
            }),
      },
    }));

    setNodes(nextNodes);
  }, [capabilities, draggingNodeId, hoveredContainerNodeId, selectedNodeId, visibleLevels]);

  const onNodeDragStop: NodeDragHandler = useCallback(
    (event, node) => {
      const draggedCap = capabilities.find((c) => c.id === node.id);
      const result = getDropTargetFromPoint(node.id, event.clientX, event.clientY, draggedCap?.level);

      setDraggingNodeId(null);
      setHoveredContainerNodeId(null);

      if (result?.presetLevel != null && result.targetId) {
        const levelToUse = (draggedCap?.level ?? result.presetLevel) as 0 | 1 | 2 | 3;
        performDrop(node.id, result.targetId, levelToUse, event.clientY);
      } else {
        rebuildInteractiveNodes();
      }
    },
    [capabilities, getDropTargetFromPoint, performDrop, rebuildInteractiveNodes]
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
