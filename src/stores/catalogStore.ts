"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Capability } from "@/types/capability";

export interface CatalogState {
  /** null = never saved to DB */
  catalogId: string | null;
  catalogName: string;
  industry: string | null;
  capabilities: Capability[];
  isDirty: boolean;
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

  /** Replace capabilities array (e.g. after edit) */
  setCapabilities: (capabilities: Capability[]) => void;

  /** Rename a single capability in the store */
  renameCapability: (id: string, newName: string) => void;
}

const initialState: CatalogState = {
  catalogId: null,
  catalogName: "",
  industry: null,
  capabilities: [],
  isDirty: false,
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
          isDirty: true,
        }),

      loadFromDB: (catalogId, name, capabilities) =>
        set({
          catalogId,
          catalogName: name,
          capabilities,
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
    }),
    {
      name: "visual-placemat-catalog",
    }
  )
);
