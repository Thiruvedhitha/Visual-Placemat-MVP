import type { SupabaseClient } from "@supabase/supabase-js";
import type { NodeStylePatch } from "@/lib/commands";
import type {
  CapabilityStyleCategory,
  CapabilityStyleSlot,
  CapabilityStyleSource,
} from "@/types/capability";

type LegendEntry = { id: string; label: string; color: string };
export type StyleLegend = {
  fill: LegendEntry[];
  border: LegendEntry[];
  textColor: LegendEntry[];
};

export type CapabilityCategoryAssignment = {
  fill_category_id: string | null;
  border_category_id: string | null;
  text_category_id: string | null;
};

const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const SLOT_CONFIG = [
  { slot: "fill", styleKey: "fill", capabilityKey: "fill_category_id" },
  { slot: "border", styleKey: "border", capabilityKey: "border_category_id" },
  { slot: "textColor", styleKey: "textColor", capabilityKey: "text_category_id" },
] as const;

function normalizeColor(color: string): string {
  return color.toLowerCase();
}

function normalizeLegend(legend?: Partial<StyleLegend> | null): StyleLegend {
  return {
    fill: Array.isArray(legend?.fill) ? legend.fill : [],
    border: Array.isArray(legend?.border) ? legend.border : [],
    textColor: Array.isArray(legend?.textColor) ? legend.textColor : [],
  };
}

export async function ensureCapabilityStyleCategories(
  supabase: SupabaseClient,
  options: {
    catalogId: string;
    capabilityIds: string[];
    nodeStyles: Record<string, NodeStylePatch>;
    legend?: Partial<StyleLegend> | null;
    source: CapabilityStyleSource;
    sourceId?: string | null;
    currentAssignments?: Record<string, Partial<CapabilityCategoryAssignment>>;
  }
): Promise<{
  categories: CapabilityStyleCategory[];
  assignments: Record<string, CapabilityCategoryAssignment>;
  legend: StyleLegend;
}> {
  const legend = normalizeLegend(options.legend);
  const desired = new Map<string, {
    slot: CapabilityStyleSlot;
    entryKey: string;
    label: string;
    color: string;
  }>();
  const legendByColor = new Map<string, LegendEntry[]>();

  for (const { slot } of SLOT_CONFIG) {
    for (const entry of legend[slot]) {
      if (!entry?.id || !entry.label || !HEX_COLOR.test(entry.color)) continue;
      const color = normalizeColor(entry.color);
      desired.set(`${slot}:${entry.id}`, {
        slot,
        entryKey: entry.id,
        label: entry.label,
        color,
      });
      const colorKey = `${slot}:${color}`;
      legendByColor.set(colorKey, [...(legendByColor.get(colorKey) ?? []), entry]);
    }
  }

  const desiredKeyByNode = new Map<string, Partial<Record<CapabilityStyleSlot, string>>>();
  for (const nodeId of new Set([...options.capabilityIds, ...Object.keys(options.nodeStyles)])) {
    const style = options.nodeStyles[nodeId] ?? {};
    const keys: Partial<Record<CapabilityStyleSlot, string>> = {};
    for (const { slot, styleKey } of SLOT_CONFIG) {
      const rawColor = style?.[styleKey];
      if (typeof rawColor !== "string" || !HEX_COLOR.test(rawColor)) continue;
      const color = normalizeColor(rawColor);
      const matches = legendByColor.get(`${slot}:${color}`) ?? [];
      const entryKey = matches[0]?.id ?? `custom-color-${color.slice(1)}`;
      const desiredKey = `${slot}:${entryKey}`;
      keys[slot] = desiredKey;
      if (!desired.has(desiredKey)) {
        const slotLabel = slot === "textColor" ? "text" : slot;
        desired.set(desiredKey, {
          slot,
          entryKey,
          label: `Custom ${slotLabel} ${color.toUpperCase()}`,
          color,
        });
      }
    }
    desiredKeyByNode.set(nodeId, keys);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("capability_style_categories")
    .select("*")
    .eq("catalog_id", options.catalogId);
  if (existingError) throw new Error(`Failed to load style categories: ${existingError.message}`);

  const existing = (existingRows ?? []) as CapabilityStyleCategory[];
  const existingByKey = new Map(existing.map((category) => [
    `${category.slot}:${category.entry_key}`,
    category,
  ]));
  const existingById = new Map(existing.map((category) => [category.id, category]));

  for (const [nodeId, keys] of desiredKeyByNode) {
    const style = options.nodeStyles[nodeId];
    const current = options.currentAssignments?.[nodeId];
    if (!current) continue;
    for (const { slot, styleKey, capabilityKey } of SLOT_CONFIG) {
      const categoryId = current[capabilityKey];
      const category = categoryId ? existingById.get(categoryId) : undefined;
      const color = style?.[styleKey];
      const categoryKey = category ? `${slot}:${category.entry_key}` : null;
      const desiredCategory = categoryKey ? desired.get(categoryKey) : undefined;
      if (
        categoryKey
        && typeof color === "string"
        && normalizeColor(category!.color) === normalizeColor(color)
        && (!desiredCategory || desiredCategory.color === normalizeColor(color))
      ) {
        keys[slot] = categoryKey;
      }
    }
  }
  const missingRows: Array<Record<string, unknown>> = [];

  for (const [key, category] of desired) {
    const current = existingByKey.get(key);
    if (!current) {
      missingRows.push({
        catalog_id: options.catalogId,
        slot: category.slot,
        entry_key: category.entryKey,
        label: category.label,
        color: category.color,
        source: options.source,
        source_id: options.sourceId ?? null,
      });
      continue;
    }
    if (current.label !== category.label || normalizeColor(current.color) !== category.color) {
      const { error } = await supabase
        .from("capability_style_categories")
        .update({ label: category.label, color: category.color, updated_at: new Date().toISOString() })
        .eq("id", current.id);
      if (error) throw new Error(`Failed to update style category: ${error.message}`);
    }
  }

  if (missingRows.length > 0) {
    const { error } = await supabase.from("capability_style_categories").insert(missingRows);
    if (error) throw new Error(`Failed to create style categories: ${error.message}`);
  }

  const { data: finalRows, error: finalError } = await supabase
    .from("capability_style_categories")
    .select("*")
    .eq("catalog_id", options.catalogId)
    .order("created_at", { ascending: true });
  if (finalError) throw new Error(`Failed to reload style categories: ${finalError.message}`);

  const categories = (finalRows ?? []) as CapabilityStyleCategory[];
  const categoriesByKey = new Map(categories.map((category) => [
    `${category.slot}:${category.entry_key}`,
    category,
  ]));
  const assignments: Record<string, CapabilityCategoryAssignment> = {};

  for (const nodeId of new Set([...options.capabilityIds, ...Object.keys(options.nodeStyles)])) {
    const desiredKeys = desiredKeyByNode.get(nodeId) ?? {};
    const assignment: CapabilityCategoryAssignment = {
      fill_category_id: null,
      border_category_id: null,
      text_category_id: null,
    };
    for (const { slot, capabilityKey } of SLOT_CONFIG) {
      const desiredKey = desiredKeys[slot];
      if (desiredKey) assignment[capabilityKey] = categoriesByKey.get(desiredKey)?.id ?? null;
    }
    assignments[nodeId] = assignment;
  }

  return { categories, assignments, legend };
}

export async function persistCapabilityCategoryAssignments(
  supabase: SupabaseClient,
  catalogId: string,
  capabilityIds: string[],
  assignments: Record<string, CapabilityCategoryAssignment>
): Promise<void> {
  for (const { capabilityKey } of SLOT_CONFIG) {
    const groups = new Map<string, string[]>();
    for (const capabilityId of capabilityIds) {
      const categoryId = assignments[capabilityId]?.[capabilityKey] ?? null;
      const groupKey = categoryId ?? "__null__";
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), capabilityId]);
    }
    for (const [groupKey, ids] of groups) {
      for (let index = 0; index < ids.length; index += 250) {
        const { error } = await supabase
          .from("capabilities")
          .update({ [capabilityKey]: groupKey === "__null__" ? null : groupKey })
          .eq("catalog_id", catalogId)
          .in("id", ids.slice(index, index + 250));
        if (error) throw new Error(`Failed to persist ${capabilityKey}: ${error.message}`);
      }
    }
  }
}