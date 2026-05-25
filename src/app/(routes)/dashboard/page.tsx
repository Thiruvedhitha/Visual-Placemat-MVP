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
import AIMapEditor from "@/components/canvas/AIMapEditor";
import AddNodeWizard from "@/components/canvas/AddNodeWizard";
import { showToast } from "@/components/ui/Toast";
import VersionHistoryPanel from "@/components/canvas/VersionHistoryPanel";
import { buildCanvasNodes } from "@/lib/canvas/layoutEngine";
import { handleNodeDragDrop } from "@/lib/canvas/dragDropHandler";
import { executeCommands } from "@/lib/commands/executor";
import type { DiagramCommand, NodeStylePatch } from "@/lib/commands/index";
import type { Capability } from "@/types/capability";
import { useCatalogStore } from "@/stores/catalogStore";
import type { LegendEntry } from "@/stores/catalogStore";

const NODE_TYPES = { capability: CapabilityNode };

// ── MultiSelectColorPicker ──────────────────────────────────────────────────
// Matches the same legend-list format as the single-select Properties panel.
function MultiSelectColorPicker({
  label,
  type,
  selectedNodeIds,
  nodeStylesRef,
  pushUndoAndSet,
  capabilitiesRef,
}: {
  label: string;
  type: "fill" | "border";
  selectedNodeIds: Set<string>;
  nodeStylesRef: React.MutableRefObject<Record<string, NodeStylePatch>>;
  pushUndoAndSet: (caps: Capability[], styles: Record<string, NodeStylePatch>) => void;
  capabilitiesRef: React.MutableRefObject<Capability[]>;
}) {
  const legend = useCatalogStore((s) => s.legend);
  const setLegend = useCatalogStore((s) => s.setLegend);
  const entries = type === "fill" ? legend.fill : legend.border;

  const applyColor = (color: string) => {
    const next = { ...nodeStylesRef.current };
    selectedNodeIds.forEach((id) => { next[id] = { ...next[id], [type]: color }; });
    pushUndoAndSet(capabilitiesRef.current, next);
  };

  const updateEntryColor = (id: string, newColor: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, color: newColor } : e));
    if (type === "fill") setLegend({ ...legend, fill: updated });
    else setLegend({ ...legend, border: updated });
    applyColor(newColor);
  };

  const updateEntryLabel = (id: string, newLabel: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, label: newLabel } : e));
    if (type === "fill") setLegend({ ...legend, fill: updated });
    else setLegend({ ...legend, border: updated });
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} className="group flex items-center gap-2">
            <label className="relative cursor-pointer">
              <span
                className="block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-slate-200"
                style={{ background: e.color }}
              />
              <input
                type="color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={e.color}
                onChange={(ev) => updateEntryColor(e.id, ev.target.value)}
              />
            </label>
            {editingId === e.id ? (
              <input
                autoFocus
                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 text-[11px] text-slate-700 outline-none focus:border-brand-400"
                value={e.label}
                onChange={(ev) => updateEntryLabel(e.id, ev.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === "Escape") setEditingId(null); }}
              />
            ) : (
              <>
                <button
                  onClick={() => applyColor(e.color)}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-600 transition hover:text-brand-700"
                >
                  {e.label}
                </button>
                <button
                  onClick={() => setEditingId(e.id)}
                  className="hidden h-4 w-4 flex-shrink-0 items-center justify-center rounded text-slate-300 transition hover:text-slate-600 group-hover:flex"
                  title="Rename"
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
              </>
            )}
          </li>
        ))}
        {/* Custom color */}
        <li className="flex items-center gap-2">
          <label className="relative cursor-pointer">
            <span className="block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-dashed border-slate-300 bg-white" />
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              defaultValue={type === "fill" ? "#ffffff" : "#e2e8f0"}
              onChange={(ev) => applyColor(ev.target.value)}
            />
          </label>
          <span className="text-[11px] text-slate-500">Custom…</span>
        </li>
      </ul>
    </div>
  );
}

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

  // Local undo/redo stacks — in memory only, never saved to DB (max 10 steps)
  type UndoSnapshot = { capabilities: Capability[]; nodeStyles: Record<string, NodeStylePatch> };
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<UndoSnapshot[]>([]);
  // Refs so callbacks always see latest values without stale closures
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);
  const capabilitiesRef = useRef<Capability[]>([]);
  const nodeStylesRef = useRef<Record<string, NodeStylePatch>>({});
  // Debounce refs for text/color changes — captures "before" snapshot, pushes after idle
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceSnapshotRef = useRef<UndoSnapshot | null>(null);
  const undoLoadedRef = useRef(false);
  undoStackRef.current = undoStack;
  redoStackRef.current = redoStack;
  capabilitiesRef.current = capabilities;

  // Canvas state
  const [nodes, setNodes] = useState<Node<CapabilityNodeData>[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [visibleLevels, setVisibleLevels] = useState<Set<number>>(
    new Set([0, 1, 2, 3])
  );
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("select");
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [nodeStyles, setNodeStylesLocal] = useState<Record<string, NodeStylePatch>>(
    () => useCatalogStore.getState().nodeStyles
  );
  nodeStylesRef.current = nodeStyles;

  // Wrapper that syncs local state to Zustand store (does NOT push undo — use pushUndoAndSet for that)
  const setNodeStyles = useCallback((updater: Record<string, NodeStylePatch> | ((prev: Record<string, NodeStylePatch>) => Record<string, NodeStylePatch>)) => {
    setNodeStylesLocal((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      useCatalogStore.setState({ nodeStyles: next });
      return next;
    });
  }, []);
  // AI Map Editor panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPickMode, setAiPickMode] = useState(false);
  const [aiTargetNodeId, setAiTargetNodeId] = useState<string | null>(null);
  // Properties sidebar — independent of AI panel
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(false);
  // Version history panel
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0); // increment to force panel refresh
  const [dropIndicator, setDropIndicator] = useState<{ x: number; y: number; width: number; targetId: string; mode: "after" | "into"; insertAfterId: string | null; newParentId: string | null } | null>(null);
  const dropIndicatorRef = useRef(dropIndicator);
  dropIndicatorRef.current = dropIndicator;

  // Track L1 drag: move children along with parent
  const l1DragRef = useRef<{ startX: number; startY: number; childOffsets: { id: string; dx: number; dy: number }[] } | null>(null);

  const { getIntersectingNodes, getNode } = useReactFlow();
  const viewport = useViewport();

  // Load capabilities: Zustand first (if matching catalog), then DB fallback
  useEffect(() => {
    // If Zustand has capabilities for the same catalog, use those
    if (storeCapabilities.length > 0 && (!catalogIdParam || catalogIdParam === storeCatalogId)) {
      setCapabilities(storeCapabilities);
      setUndoStack([]);
      setRedoStack([]);
      setLoading(false);
      return;
    }

    // Otherwise, try to fetch from DB if catalogId is in the URL
    if (!catalogIdParam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/catalogs/${encodeURIComponent(catalogIdParam)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.catalog && Array.isArray(data.capabilities)) {
          setCapabilities(data.capabilities);
          setUndoStack([]);
          setRedoStack([]);
          loadFromDB(catalogIdParam, data.catalog.name || catalogIdParam, data.capabilities);
          // Load saved node styles from DB
          if (data.catalog.node_styles && typeof data.catalog.node_styles === "object") {
            setNodeStyles(data.catalog.node_styles);
          }
        } else {
          setError(data.error || "Failed to load capabilities");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [catalogIdParam, storeCapabilities, storeCatalogId, loadFromDB]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Load undo/redo stacks from localStorage (once per catalog)
  useEffect(() => {
    const key = storeCatalogId || catalogIdParam;
    if (!key || undoLoadedRef.current) return;
    undoLoadedRef.current = true;
    try {
      const saved = localStorage.getItem(`vp-undo-${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.undo) && parsed.undo.length > 0) setUndoStack(parsed.undo);
        if (Array.isArray(parsed.redo) && parsed.redo.length > 0) setRedoStack(parsed.redo);
      }
    } catch { /* ignore parse errors */ }
  }, [storeCatalogId, catalogIdParam]);

  // Persist undo/redo stacks to localStorage on every change
  useEffect(() => {
    const key = storeCatalogId || catalogIdParam;
    if (!key || !undoLoadedRef.current) return;
    try {
      localStorage.setItem(`vp-undo-${key}`, JSON.stringify({ undo: undoStack, redo: redoStack }));
    } catch { /* ignore quota errors */ }
  }, [undoStack, redoStack, storeCatalogId, catalogIdParam]);

  /**
   * Snapshot current state → undo stack (max 10), then apply new caps + styles.
   * Use for EVERY mutation: drag, rename, delete, reparent, color, border, AI apply.
   */
  const pushUndoAndSet = useCallback((newCaps: Capability[], newStyles?: Record<string, NodeStylePatch>) => {
    const snapshot = { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current };
    setUndoStack((prev) => [...prev.slice(-9), snapshot]); // keep last 10
    setRedoStack([]);
    setCapabilities(newCaps);
    const styles = newStyles ?? nodeStylesRef.current;
    setNodeStylesLocal(styles);
    useCatalogStore.setState({ capabilities: newCaps, nodeStyles: styles, isDirty: true });
  }, []);

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) — local in-memory undo/redo
  useEffect(() => {
    const applySnapshot = (snap: { capabilities: Capability[]; nodeStyles: Record<string, NodeStylePatch> }) => {
      setCapabilities(snap.capabilities);
      setNodeStylesLocal(snap.nodeStyles);
      useCatalogStore.setState({ capabilities: snap.capabilities, nodeStyles: snap.nodeStyles, isDirty: true });
    };

    const handler = (e: KeyboardEvent) => {
      // Allow Ctrl+Z / Ctrl+Y even when an input/textarea has focus
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const stack = undoStackRef.current;
        if (stack.length === 0) return;
        const prev = stack[stack.length - 1];
        setUndoStack(stack.slice(0, -1));
        setRedoStack((r) => [...r, { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current }]);
        applySnapshot(prev);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        const stack = redoStackRef.current;
        if (stack.length === 0) return;
        const next = stack[stack.length - 1];
        setRedoStack(stack.slice(0, -1));
        setUndoStack((u) => [...u, { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current }]);
        applySnapshot(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Handler functions - define before useEffect that uses them
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onNodeClick = useCallback(
    (evt: React.MouseEvent, node: Node<CapabilityNodeData>) => {
      if (node.type !== "capability") return;
      if (aiPickMode) {
        setAiTargetNodeId(node.id);
        return;
      }
      if (aiPanelOpen) return; // AI panel open in map mode: ignore clicks

      if (evt.ctrlKey) {
        // Ctrl+click: toggle node in/out of multi-selection
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          // Keep selectedNodeId as last single-selected node (for right sidebar)
          if (next.size === 1) setSelectedNodeId([...next][0]);
          else setSelectedNodeId(null);
          return next;
        });
      } else {
        // Plain click: single select
        setSelectedNodeId(node.id);
        setSelectedNodeIds(new Set([node.id]));
      }
    },
    [aiPickMode, aiPanelOpen]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
  }, []);

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
      const isSelected = selectedNodeIds.has(node.id);
      const isAiTarget = node.id === aiTargetNodeId;
      const level = node.data.level;
      return {
        ...node,
        data: { ...node.data, ...styles, isSelected, pickMode: aiPickMode, isAiTarget },
        draggable: aiPickMode ? false : level >= 1,
        selected: false, // ReactFlow selection disabled — we manage highlight via data.isSelected
        // In pick mode: flatten all z-index to 1 so every level is equally clickable
        zIndex: aiPickMode ? 1 : (level === 0 ? -1 : level === 1 ? 0 : level === 2 ? 1 : 1000),
      };
    });

    setNodes(nextNodes);
  }, [capabilities, selectedNodeIds, aiTargetNodeId, aiPickMode, visibleLevels, nodeStyles]);

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
        showToast.error(result.message);
        rebuildInteractiveNodes();
      } else {
        pushUndoAndSet(result.updatedCapabilities);
        setSelectedNodeId(node.id);
        setSelectedNodeIds(new Set([node.id]));
        showToast.success(result.message);
      }

      setDropIndicator(null);
    },
    [capabilities, rebuildInteractiveNodes]
  );

  const onUpdateNode = useCallback(
    (id: string, patch: Partial<CapabilityNodeData>) => {
      // Persist visual styles (fill, border) — debounced so rapid color-picker drags don't flood the stack
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
        // Capture the "before" state once at the start of a change sequence
        if (!debounceSnapshotRef.current) {
          debounceSnapshotRef.current = { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current };
        }
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        const newStyles = { ...nodeStylesRef.current, [id]: { ...nodeStylesRef.current[id], ...stylePatch } };
        // Apply immediately for visual feedback (no undo push yet)
        setNodeStylesLocal(newStyles);
        useCatalogStore.setState({ nodeStyles: newStyles, isDirty: true });
        const beforeSnap = debounceSnapshotRef.current;
        debounceTimerRef.current = setTimeout(() => {
          setUndoStack((prev) => [...prev.slice(-9), beforeSnap]);
          setRedoStack([]);
          debounceSnapshotRef.current = null;
        }, 400);
      }

      // Persist structural fields — debounced so typing doesn't create per-keystroke undo entries
      if ("label" in patch || "description" in patch || "note" in patch) {
        const current = capabilitiesRef.current;
        const updated = current.map((c) => {
          if (c.id !== id) return c;
          const changes: Partial<Capability> = {};
          if ("label" in patch) changes.name = patch.label || c.name;
          if ("description" in patch) changes.description = patch.description || "";
          if ("note" in patch) changes.note = patch.note || null;
          return { ...c, ...changes };
        });
        // Capture "before" state once at the start of a typing session
        if (!debounceSnapshotRef.current) {
          debounceSnapshotRef.current = { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current };
        }
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        // Apply immediately for visual feedback
        setCapabilities(updated);
        useCatalogStore.setState({ capabilities: updated, isDirty: true });
        const beforeSnap = debounceSnapshotRef.current;
        debounceTimerRef.current = setTimeout(() => {
          setUndoStack((prev) => [...prev.slice(-9), beforeSnap]);
          setRedoStack([]);
          debounceSnapshotRef.current = null;
        }, 600);
      }
    },
    []
  );

  const onReparent = useCallback(
    (nodeId: string, newParentId: string) => {
      const prev = capabilitiesRef.current;
      const node = prev.find((c) => c.id === nodeId);
      if (!node) return;
      const newParent = prev.find((c) => c.id === newParentId);
      if (!newParent) return;
      const newLevel = Math.min(newParent.level + 1, 3) as 0 | 1 | 2 | 3;
      const siblings = prev.filter((c) => c.parent_id === newParentId);
      const maxSort = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sort_order)) : -1;
      const updated = prev.map((c) =>
        c.id === nodeId
          ? { ...c, parent_id: newParentId, level: newLevel, sort_order: maxSort + 1 }
          : c
      );
      pushUndoAndSet(updated);
      showToast.success(`Moved '${node.name}' under '${newParent.name}'`);
    },
    [pushUndoAndSet]
  );

  const onDetachChild = useCallback(
    (childId: string) => {
      const node = capabilitiesRef.current.find((c) => c.id === childId);
      const updated = capabilitiesRef.current.map((c) =>
        c.id === childId ? { ...c, parent_id: null } : c
      );
      pushUndoAndSet(updated);
      if (node) showToast.success(`Detached '${node.name}'`);
    },
    [pushUndoAndSet]
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      const prev = capabilitiesRef.current;
      const target = prev.find((c) => c.id === nodeId);
      const toDelete = new Set<string>();
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        toDelete.add(current);
        prev.filter((c) => c.parent_id === current).forEach((c) => queue.push(c.id));
      }
      pushUndoAndSet(prev.filter((c) => !toDelete.has(c.id)));
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set());
      if (target) showToast.success(`Deleted '${target.name}'${toDelete.size > 1 ? ` (+${toDelete.size - 1} children)` : ""}`);
    },
    [pushUndoAndSet]
  );

  /** Apply AI-generated commands: runs locally, marks dirty, no DB write */
  const applyAICommands = useCallback(
    (commands: DiagramCommand[]): string[] => {
      // Handle SET_LEGEND / REMOVE_LEGEND commands before passing the rest to the executor
      const legendCmds = commands.filter((c) => c.type === "SET_LEGEND" || c.type === "REMOVE_LEGEND") as Extract<DiagramCommand, { type: "SET_LEGEND" | "REMOVE_LEGEND" }>[];
      const otherCmds = commands.filter((c) => c.type !== "SET_LEGEND" && c.type !== "REMOVE_LEGEND");

      if (legendCmds.length > 0) {
        const { legend, setLegend } = useCatalogStore.getState();
        let fill = [...legend.fill];
        let border = [...legend.border];
        for (const cmd of legendCmds) {
          if (cmd.type === "SET_LEGEND") {
            const entry = { id: cmd.entryId, label: cmd.label, color: cmd.color };
            if (cmd.slot === "fill") {
              const idx = fill.findIndex((e) => e.id === cmd.entryId);
              fill = idx === -1 ? [...fill, entry] : fill.map((e, i) => (i === idx ? entry : e));
            } else {
              const idx = border.findIndex((e) => e.id === cmd.entryId);
              border = idx === -1 ? [...border, entry] : border.map((e, i) => (i === idx ? entry : e));
            }
          } else if (cmd.type === "REMOVE_LEGEND") {
            if (cmd.slot === "fill") fill = fill.filter((e) => e.id !== cmd.entryId);
            else border = border.filter((e) => e.id !== cmd.entryId);
          }
        }
        setLegend({ fill, border });
      }

      let errors: string[] = [];
      const prevCaps = capabilitiesRef.current;
      const result = executeCommands(otherCmds, prevCaps, nodeStylesRef.current);
      errors = result.errors;
      pushUndoAndSet(result.capabilities, result.nodePatches);
      return errors;
    },
    [pushUndoAndSet]
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
          nodeStyles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error || "Save failed");
        return;
      }
      markSaved(data.catalogId);
      setHistoryKey((k) => k + 1); // refresh version history panel
    } catch {
      setApplyError("Network error. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  // Restore a historical version
  const handleRestore = useCallback(
    (restoredCapabilities: Capability[], restoredStyles: Record<string, NodeStylePatch>) => {
      setCapabilities(restoredCapabilities);
      setUndoStack([]);
      setRedoStack([]);
      setNodeStyles(restoredStyles);
      loadFromDB(storeCatalogId!, catalogName, restoredCapabilities);
      setApplyError(null);
    },
    [loadFromDB, storeCatalogId, catalogName, setNodeStyles]
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
    : "/export";

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
          {/* Undo / Redo buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const stack = undoStackRef.current;
                if (stack.length === 0) return;
                const prev = stack[stack.length - 1];
                setUndoStack(stack.slice(0, -1));
                setRedoStack((r) => [...r, { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current }]);
                setCapabilities(prev.capabilities);
                setNodeStylesLocal(prev.nodeStyles);
                useCatalogStore.setState({ capabilities: prev.capabilities, nodeStyles: prev.nodeStyles, isDirty: true });
              }}
              disabled={undoStack.length === 0}
              title={`Undo (Ctrl+Z)${undoStack.length > 0 ? ` · ${undoStack.length} step${undoStack.length > 1 ? "s" : ""}` : ""}`}
              className="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={() => {
                const stack = redoStackRef.current;
                if (stack.length === 0) return;
                const next = stack[stack.length - 1];
                setRedoStack(stack.slice(0, -1));
                setUndoStack((u) => [...u, { capabilities: capabilitiesRef.current, nodeStyles: nodeStylesRef.current }]);
                setCapabilities(next.capabilities);
                setNodeStylesLocal(next.nodeStyles);
                useCatalogStore.setState({ capabilities: next.capabilities, nodeStyles: next.nodeStyles, isDirty: true });
              }}
              disabled={redoStack.length === 0}
              title={`Redo (Ctrl+Y)${redoStack.length > 0 ? ` · ${redoStack.length} step${redoStack.length > 1 ? "s" : ""}` : ""}`}
              className="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
          </div>
          {applyError && (
            <p className="text-xs text-red-500">{applyError}</p>
          )}
          {/* AI map editor toggle */}
          <button
            onClick={() => {
              setAiPanelOpen((v) => {
                if (!v) { setSelectedNodeId(null); setSelectedNodeIds(new Set()); }
                setPropertiesPanelOpen(false);
                return !v;
              });
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
              aiPanelOpen
                ? "border-blue-500 bg-blue-500 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI map editor
          </button>
          {/* Properties panel toggle */}
          <button
            onClick={() => { setPropertiesPanelOpen((v) => !v); setAiPanelOpen(false); }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
              propertiesPanelOpen
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Properties
          </button>
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
          {/* Version history toggle — only shown after first save */}
          {storeCatalogId && (
            <button
              onClick={() => {
                setHistoryPanelOpen((v) => !v);
                setAiPanelOpen(false);
                setPropertiesPanelOpen(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                historyPanelOpen
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:text-violet-600"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
          )}
        </div>
      </header>

      {/* Body: left sidebar + canvas + right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar visibleLevels={visibleLevels} onToggleLevel={onToggleLevel} onAddNode={() => setAddNodeOpen(true)} />

        {/* Canvas area */}
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

          {/* Add Node wizard */}
          <AddNodeWizard
            open={addNodeOpen}
            onClose={() => setAddNodeOpen(false)}
            capabilities={capabilities}
            onApply={(cmds) => {
              applyAICommands(cmds);
              showToast.success(`Added ${cmds.length} node${cmds.length !== 1 ? "s" : ""}`);
            }}
          />

          {/* AI Map Editor panel — overlays the canvas from the right */}
          <AIMapEditor
            open={aiPanelOpen}
            onClose={() => {
              setAiPanelOpen(false);
              setAiPickMode(false);
              setAiTargetNodeId(null);
            }}
            capabilities={capabilities}
            nodeStyles={nodeStyles}
            selectedNodeId={aiTargetNodeId}
            pickMode={aiPickMode}
            onEnterPickMode={() => setAiPickMode(true)}
            onExitPickMode={() => {
              setAiPickMode(false);
              setAiTargetNodeId(null);
            }}
            onAICommands={applyAICommands}
            onUpdateNode={onUpdateNode}
            onPickNode={(id) => setAiTargetNodeId(id || null)}
          />
        </div>

        {/* Properties sidebar — single or multi-select */}
        {selectedNodeIds.size >= 1 && !aiPanelOpen && (
          <div className="relative flex flex-shrink-0">
            <button
              onClick={() => { setSelectedNodeId(null); setSelectedNodeIds(new Set()); }}
              title="Close sidebar"
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 flex h-8 w-4 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white shadow-sm transition hover:bg-slate-100"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Single-select: full RightSidebar */}
            {selectedNodeIds.size === 1 && selectedNodeId && (
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
              />
            )}

            {/* Multi-select: shared properties panel */}
            {selectedNodeIds.size > 1 && (
              <div className="flex w-72 flex-col gap-5 overflow-y-auto border-l border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">{selectedNodeIds.size} nodes selected</h2>
                  <button
                    onClick={() => { setSelectedNodeId(null); setSelectedNodeIds(new Set()); }}
                    className="rounded p-1 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Background colour */}
                <MultiSelectColorPicker
                  label="Background colour"
                  type="fill"
                  selectedNodeIds={selectedNodeIds}
                  nodeStylesRef={nodeStylesRef}
                  pushUndoAndSet={pushUndoAndSet}
                  capabilitiesRef={capabilitiesRef}
                />

                {/* Border colour */}
                <MultiSelectColorPicker
                  label="Border colour"
                  type="border"
                  selectedNodeIds={selectedNodeIds}
                  nodeStylesRef={nodeStylesRef}
                  pushUndoAndSet={pushUndoAndSet}
                  capabilitiesRef={capabilitiesRef}
                />

                {/* Parent */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Move all under parent</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const newParentId = e.target.value;
                      if (!newParentId) return;
                      selectedNodeIds.forEach((id) => onReparent(id, newParentId));
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">— select a parent —</option>
                    {capabilities
                      .filter((c) => !selectedNodeIds.has(c.id) && c.level < 3)
                      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {'\u00a0'.repeat(c.level * 2)}L{c.level} {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Delete all */}
                <button
                  onClick={() => {
                    const cmds: DiagramCommand[] = [...selectedNodeIds].map((id) => ({ type: "DELETE_NODE" as const, nodeId: id }));
                    applyAICommands(cmds);
                    setSelectedNodeIds(new Set());
                    setSelectedNodeId(null);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete all selected
                </button>
              </div>
            )}
          </div>
        )}

        {/* Version History sidebar */}
        {historyPanelOpen && (
          <aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
            <VersionHistoryPanel
              key={historyKey}
              catalogId={storeCatalogId}
              onRestore={handleRestore}
            />
          </aside>
        )}
      </div>


    </div>
  );
}
