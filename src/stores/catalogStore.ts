"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Capability, CapabilityStyleCategory } from "@/types/capability";
import type { NodeStylePatch } from "@/lib/commands/index";

export interface LegendEntry {
  id: string;
  label: string;
  color: string; // hex
}

export interface LegendConfig {
  fill: LegendEntry[];
  border: LegendEntry[];
  textColor: LegendEntry[];
}

const DEFAULT_LEGEND: LegendConfig = {
  fill: [],
  border: [],
  textColor: [],
};

export interface CatalogState {
  /** null = never saved to DB */
  catalogId: string | null;
  catalogName: string;
  industry: string | null;
  capabilities: Capability[];
  isDirty: boolean;
  /** Per-node visual overrides (fill, border) — keyed by node ID */
  nodeStyles: Record<string, NodeStylePatch>;
  /** Catalog-owned categories referenced by capabilities */
  styleCategories: CapabilityStyleCategory[];
  /** Color legend — fill and border category definitions */
  legend: LegendConfig;
}

export interface CatalogActions {
  /** Load parsed capabilities from a fresh upload (no DB yet) */
  setCatalog: (
    name: string,
    capabilities: Capability[],
    industry?: string | null
  ) => void;

  /** Load an existing catalog from DB (e.g. re-open) */
  loadFromDB: (catalogId: string, name: string, capabilities: Capability[]) => void;

  /** After Apply succeeds: store the real catalogId, clear dirty flag */
  markSaved: (catalogId: string) => void;

  /** Reset store (e.g. user starts over) */
  clear: () => void;

  /** Mark store as dirty (after any local edit) */
  markDirty: () => void;

  /** Sync capabilities from the canvas (no undo tracking — managed locally in dashboard) */
  setCapabilities: (capabilities: Capability[]) => void;

  /** Rename a single capability in the store */
  renameCapability: (id: string, newName: string) => void;

  /** Update or merge node styles */
  setNodeStyles: (styles: Record<string, NodeStylePatch>) => void;

  /** Patch a single node's styles */
  patchNodeStyle: (id: string, patch: Partial<NodeStylePatch>) => void;

  /** Replace categories loaded for the current catalog */
  setStyleCategories: (categories: CapabilityStyleCategory[]) => void;

  /** Replace the entire legend config */
  setLegend: (legend: LegendConfig) => void;
}

const initialState: CatalogState = {
  catalogId: null,
  catalogName: "",
  industry: null,
  capabilities: [],
  isDirty: false,
  nodeStyles: {},
  styleCategories: [],
  legend: DEFAULT_LEGEND,
};

export const useCatalogStore = create<CatalogState & CatalogActions>()(
  persist(
    (set) => ({
      ...initialState,

      setCatalog: (name, capabilities, industry = null) =>
        set({
          catalogId: null,
          catalogName: name,
          industry,
          capabilities,
          styleCategories: [],
          isDirty: true,
        }),

      loadFromDB: (catalogId, name, capabilities) =>
        set({
          catalogId,
          catalogName: name,
          capabilities,
          styleCategories: [],
          isDirty: false,
        }),

      markSaved: (catalogId) =>
        set({ catalogId, isDirty: false }),

      clear: () => set({ ...initialState }),

      markDirty: () => set({ isDirty: true }),

      setCapabilities: (capabilities) =>
        set({ capabilities, isDirty: true }),

      renameCapability: (id, newName) =>
        set((state) => ({
          capabilities: state.capabilities.map((c) =>
            c.id === id ? { ...c, name: newName } : c
          ),
          isDirty: true,
        })),
      setNodeStyles: (styles) =>
        set({ nodeStyles: styles, isDirty: true }),

      patchNodeStyle: (id, patch) =>
        set((state) => ({
          nodeStyles: {
            ...state.nodeStyles,
            [id]: { ...state.nodeStyles[id], ...patch },
          },
          isDirty: true,
        })),

      setStyleCategories: (styleCategories) => set({ styleCategories }),

      setLegend: (legend) => set({ legend }),
    }),
    {
      name: "visual-placemat-catalog",
      version: 3,
      migrate: (persisted: unknown, version) => {
        // v1 → v2: clear pre-defined legend defaults so legend starts blank
        const state = persisted as Partial<CatalogState>;
        return {
          ...state,
          ...(version < 2 ? { legend: DEFAULT_LEGEND } : {}),
          styleCategories: state.styleCategories ?? [],
        };
      },
    }
  )
);
