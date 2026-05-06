"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  useViewport,
} from "reactflow";
import "reactflow/dist/style.css";

import CapabilityNode from "@/components/canvas/CapabilityNode";
import type { CapabilityNodeData } from "@/components/canvas/CapabilityNode";
import LeftSidebar from "@/components/canvas/LeftSidebar";
import RightSidebar from "@/components/canvas/RightSidebar";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import { handleNodeDragDrop } from "@/lib/canvas/dragDropHandler";
import { executeCommands } from "@/lib/commands/executor";
import type { DiagramCommand, NodeStylePatch } from "@/lib/commands/index";
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
  const [nodeStyles, setNodeStyles] = useState<Record<string, NodeStylePatch>>({});
  const [dropIndicator, setDropIndicator] = useState<{ x: number; y: number; width: number; targetId: string; mode: "after" | "into"; insertAfterId: string | null; newParentId: string | null } | null>(null);
  const dropIndicatorRef = useRef(dropIndicator);
  dropIndicatorRef.current = dropIndicator;

  // Track L1 drag: move children along with parent
  const l1DragRef = useRef<{ startX: number; startY: number; childOffsets: { id: string; dx: number; dy: number }[] } | null>(null);

  const { getIntersectingNodes, getNode } = useReactFlow();
  const viewport = useViewport();

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

    const nextNodes = buildCanvasNodes(capabilities, visibleLevels).map((node) => {
      const styles = nodeStyles[node.id];
      const isSelected = node.id === selectedNodeId;
      const level = node.data.level;
      return {
        ...node,
        data: { ...node.data, ...styles, isSelected },
        draggable: level >= 1,
        // Only mark L3 as selected in ReactFlow (L1/L2 use data.isSelected for styling to avoid z-index override)
        selected: level === 3 ? isSelected : false,
        zIndex: level === 0 ? -1 : level === 1 ? 0 : level === 2 ? 1 : 1000,
      };
    });

    setNodes(nextNodes);
  }, [capabilities, selectedNodeId, visibleLevels, nodeStyles]);

  const onNodeDragStart: NodeDragHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);

    const level = (node.data as CapabilityNodeData).level;

    // If dragging L1 or L2, capture child offsets so we can move them together
    if (level === 1 || level === 2) {
      const childIds = capabilities
        .filter((c) => c.parent_id === node.id)
        .map((c) => c.id);
      // Also include grandchildren (L3 under L2s that are under this L1)
      const grandchildIds = level === 1
        ? capabilities
            .filter((c) => c.parent_id && childIds.includes(c.parent_id))
            .map((c) => c.id)
        : [];
      const allChildIds = [...childIds, ...grandchildIds];

      const childOffsets: { id: string; dx: number; dy: number }[] = [];
      setNodes((nds) => {
        for (const n of nds) {
          if (allChildIds.includes(n.id)) {
            childOffsets.push({
              id: n.id,
              dx: n.position.x - node.position.x,
              dy: n.position.y - node.position.y,
            });
          }
        }
        return nds;
      });

      l1DragRef.current = {
        startX: node.position.x,
        startY: node.position.y,
        childOffsets,
      };
    } else {
      l1DragRef.current = null;
    }
  }, [capabilities]);

  const onNodeDrag: NodeDragHandler = useCallback(
    (_, node) => {
      // If dragging L1 or L2, move children along
      const dragNodeLevel = (node.data as CapabilityNodeData).level;
      if (l1DragRef.current && (dragNodeLevel === 1 || dragNodeLevel === 2)) {
        const { childOffsets } = l1DragRef.current;
        setNodes((nds) =>
          nds.map((n) => {
            const offset = childOffsets.find((o) => o.id === n.id);
            if (offset) {
              return {
                ...n,
                position: {
                  x: node.position.x + offset.dx,
                  y: node.position.y + offset.dy,
                },
              };
            }
            return n;
          })
        );
      }

      const dragLevel = (node.data as CapabilityNodeData).level;
      const intersecting = getIntersectingNodes(node);

      // Exclude children of dragged node (especially when L1 drags its L2/L3 along)
      const draggedChildIds = new Set(
        capabilities
          .filter((c) => c.parent_id === node.id)
          .flatMap((c) => [c.id, ...capabilities.filter((gc) => gc.parent_id === c.id).map((gc) => gc.id)])
      );

      // Find best target: same level first, then parent level, then grandparent (for level promotion)
      let target = intersecting.find(
        (n) => n.id !== node.id && !draggedChildIds.has(n.id) && (n.data as CapabilityNodeData).level === dragLevel
      );
      let mode: "after" | "into" = "after";

      // Check for promotion first: if dragged onto L0 header area, promote to L1
      if (!target && dragLevel > 1) {
        const grandparentTarget = intersecting.find(
          (n) => n.id !== node.id && !draggedChildIds.has(n.id) && (n.data as CapabilityNodeData).level === dragLevel - 2
        );
        if (grandparentTarget) {
          const gpNode = getNode(grandparentTarget.id);
          if (gpNode) {
            const gpBandH = (gpNode.data as CapabilityNodeData).nodeHeight ?? 50;
            // If node center is within the L0 header band, promote
            const dragCenterY = node.position.y + ((node.data as CapabilityNodeData).nodeHeight ?? 36) / 2;
            if (dragCenterY < gpNode.position.y + gpBandH + 10) {
              target = grandparentTarget;
              mode = "into";
            }
          }
        }
      }

      if (!target && dragLevel > 0) {
        target = intersecting.find(
          (n) => n.id !== node.id && !draggedChildIds.has(n.id) && (n.data as CapabilityNodeData).level === dragLevel - 1
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
            // "into" mode: find the exact position among children based on drag position
            const children = capabilities
              .filter((c) => c.parent_id === target!.id && c.id !== node.id)
              .sort((a, b) => a.sort_order - b.sort_order);

            const dragCenterY = node.position.y + ((node.data as CapabilityNodeData).nodeHeight ?? 36) / 2;
            const dragCenterX = node.position.x + ((node.data as CapabilityNodeData).nodeWidth ?? 200) / 2;

            const targetLevel = (targetNode.data as CapabilityNodeData).level;

            // If target is L0, children (L1s) are arranged horizontally — use X position
            if (targetLevel === 0) {
              let insertAfterId: string | null = null;
              let indicatorX = targetNode.position.x;
              let indicatorY = targetNode.position.y + (tData.nodeHeight ?? 50) + 8; // below L0 header
              const indicatorW = 4; // vertical line width
              const indicatorH = 60; // visual height of vertical indicator

              for (const child of children) {
                const childNode = getNode(child.id);
                if (childNode) {
                  const childW = (childNode.data as CapabilityNodeData).nodeWidth ?? 280;
                  const childCenterX = childNode.position.x + childW / 2;
                  if (dragCenterX > childCenterX) {
                    insertAfterId = child.id;
                    indicatorX = childNode.position.x + childW + 8; // right side of child
                  } else {
                    indicatorX = childNode.position.x - 8;
                    break;
                  }
                }
              }

              if (children.length === 0) {
                indicatorX = targetNode.position.x + 10;
              }

              setDropIndicator({
                x: indicatorX,
                y: indicatorY,
                width: indicatorW,
                targetId: target.id,
                mode: "after",
                insertAfterId,
                newParentId: target.id,
              });
            } else {
              // Target is L1 or L2 — children are stacked vertically, use Y position

              // Collect all descendant nodes inside this container for position tracking
              const allDescendants = capabilities
                .filter((c) => {
                  if (c.id === node.id) return false;
                  if (c.parent_id === target!.id) return true;
                  const parent = capabilities.find((p) => p.id === c.parent_id);
                  return parent && parent.parent_id === target!.id;
                })
                .sort((a, b) => a.sort_order - b.sort_order);

              let insertAfterId: string | null = null;
              let indicatorY = targetNode.position.y + 48;
              let indicatorX = targetNode.position.x + 10;
              const innerW = (tData.nodeWidth ?? tW) - 20;

              for (const child of children) {
                const childNode = getNode(child.id);
                if (childNode) {
                  const childH = (childNode.data as CapabilityNodeData).nodeHeight ?? 36;
                  const childCenterY = childNode.position.y + childH / 2;
                  if (dragCenterY > childCenterY) {
                    insertAfterId = child.id;
                    const l3Children = allDescendants.filter((d) => d.parent_id === child.id);
                    if (l3Children.length > 0) {
                      const lastL3 = l3Children[l3Children.length - 1];
                      const lastL3Node = getNode(lastL3.id);
                      if (lastL3Node) {
                        const l3H = (lastL3Node.data as CapabilityNodeData).nodeHeight ?? 36;
                        indicatorY = lastL3Node.position.y + l3H;
                        indicatorX = lastL3Node.position.x;
                      } else {
                        indicatorY = childNode.position.y + childH;
                        indicatorX = childNode.position.x;
                      }
                    } else {
                      indicatorY = childNode.position.y + childH;
                      indicatorX = childNode.position.x;
                    }
                  } else {
                    indicatorY = childNode.position.y;
                    indicatorX = childNode.position.x;
                    break;
                  }
                }
              }

              if (children.length === 0) {
                indicatorY = targetNode.position.y + 48;
                indicatorX = targetNode.position.x + 10;
              }

              setDropIndicator({
                x: indicatorX,
                y: indicatorY,
                width: innerW,
                targetId: target.id,
                mode: "after",
                insertAfterId,
                newParentId: target.id,
              });
            }
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

      // Use ref to get the latest drop indicator (avoids stale closure)
      const indicator = dropIndicatorRef.current;
      if (!indicator) {
        rebuildInteractiveNodes();
        return;
      }

      const newParentId = indicator.newParentId;
      const insertAfterId = indicator.insertAfterId;

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
    [capabilities, rebuildInteractiveNodes]
  );

  const onUpdateNode = useCallback(
    (id: string, patch: Partial<CapabilityNodeData>) => {
      // Persist visual styles (fill, border) in nodeStyles map
      const visualKeys = ["fill", "border"] as const;
      const stylePatch: Record<string, string | undefined> = {};
      let hasStyle = false;
      for (const k of visualKeys) {
        if (k in patch) {
          stylePatch[k] = patch[k];
          hasStyle = true;
        }
      }
      if (hasStyle) {
        setNodeStyles((prev) => ({
          ...prev,
          [id]: { ...prev[id], ...stylePatch },
        }));
        useCatalogStore.setState({ isDirty: true });
      }

      // Persist structural fields to capabilities store
      if ("label" in patch || "description" in patch || "note" in patch) {
        setCapabilities((prev) => {
          const updated = prev.map((c) => {
            if (c.id !== id) return c;
            const changes: Partial<Capability> = {};
            if ("label" in patch) changes.name = patch.label || c.name;
            if ("description" in patch) changes.description = patch.description || "";
            if ("note" in patch) changes.note = patch.note || null;
            return { ...c, ...changes };
          });
          useCatalogStore.setState({ capabilities: updated, isDirty: true });
          return updated;
        });
      }
    },
    []
  );

  const onReparent = useCallback(
    (nodeId: string, newParentId: string) => {
      setCapabilities((prev) => {
        const node = prev.find((c) => c.id === nodeId);
        if (!node) return prev;
        const newParent = prev.find((c) => c.id === newParentId);
        if (!newParent) return prev;
        const newLevel = Math.min(newParent.level + 1, 3) as 0 | 1 | 2 | 3;
        const siblings = prev.filter((c) => c.parent_id === newParentId);
        const maxSort = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sort_order)) : -1;
        const updated = prev.map((c) =>
          c.id === nodeId
            ? { ...c, parent_id: newParentId, level: newLevel, sort_order: maxSort + 1 }
            : c
        );
        useCatalogStore.setState({ capabilities: updated, isDirty: true });
        return updated;
      });
    },
    []
  );

  const onDetachChild = useCallback(
    (childId: string) => {
      setCapabilities((prev) => {
        const updated = prev.map((c) =>
          c.id === childId ? { ...c, parent_id: null } : c
        );
        useCatalogStore.setState({ capabilities: updated, isDirty: true });
        return updated;
      });
    },
    []
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setCapabilities((prev) => {
        // Collect all descendants
        const toDelete = new Set<string>();
        const queue = [nodeId];
        while (queue.length > 0) {
          const current = queue.shift()!;
          toDelete.add(current);
          prev.filter((c) => c.parent_id === current).forEach((c) => queue.push(c.id));
        }
        const updated = prev.filter((c) => !toDelete.has(c.id));
        useCatalogStore.setState({ capabilities: updated, isDirty: true });
        return updated;
      });
      setSelectedNodeId(null);
    },
    []
  );

  /** Apply AI-generated commands: runs locally, marks dirty, no DB write */
  const applyAICommands = useCallback(
    (commands: DiagramCommand[]) => {
      setCapabilities((prevCaps) => {
        setNodeStyles((prevStyles: Record<string, NodeStylePatch>) => {
          const result = executeCommands(commands, prevCaps, prevStyles);
          useCatalogStore.setState({ capabilities: result.capabilities, isDirty: true });
          setTimeout(() => setNodeStyles(result.nodePatches), 0);
          return prevStyles;
        });
        return prevCaps;
      });
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
                  transform: `translate(${dropIndicator.x * viewport.zoom + viewport.x}px, ${dropIndicator.y * viewport.zoom + viewport.y}px) scale(${viewport.zoom})`,
                  transformOrigin: "0 0",
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

        {selectedNodeId && (
          <div className="relative flex flex-shrink-0">
            {/* Collapse arrow button */}
            <button
              onClick={() => setSelectedNodeId(null)}
              title="Close sidebar"
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 flex h-8 w-4 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white shadow-sm transition hover:bg-slate-100"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <RightSidebar
              node={
                selectedNode && selectedNode.type === "capability"
                  ? { id: selectedNode.id, data: selectedNode.data as import("@/components/canvas/CapabilityNode").CapabilityNodeData }
                  : null
              }
              capabilities={capabilities}
              nodeStyles={nodeStyles}
              onUpdateNode={onUpdateNode}
              onReparent={onReparent}
              onDetachChild={onDetachChild}
              onDeleteChild={onDeleteNode}
              onDeleteNode={onDeleteNode}
              onAICommands={applyAICommands}
            />
          </div>
        )}
      </div>


    </div>
  );
}
