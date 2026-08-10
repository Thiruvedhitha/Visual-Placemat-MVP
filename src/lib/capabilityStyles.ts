import type { NodeStylePatch } from "@/lib/commands";
import type { Capability, CapabilityStyleCategory } from "@/types/capability";
import type { LegendConfig, LegendEntry } from "@/stores/catalogStore";

export function mergeNodeStyleMaps(
  fallback: Record<string, NodeStylePatch>,
  overrides: Record<string, NodeStylePatch>
): Record<string, NodeStylePatch> {
  const merged: Record<string, NodeStylePatch> = {};
  const nodeIds = new Set([...Object.keys(fallback), ...Object.keys(overrides)]);
  for (const nodeId of nodeIds) {
    merged[nodeId] = { ...(fallback[nodeId] ?? {}), ...(overrides[nodeId] ?? {}) };
  }
  return merged;
}

export function resolveCapabilityCategoryStyles(
  capabilities: Capability[],
  categories: CapabilityStyleCategory[]
): Record<string, NodeStylePatch> {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const styles: Record<string, NodeStylePatch> = {};

  for (const capability of capabilities) {
    const fill = capability.fill_category_id
      ? categoriesById.get(capability.fill_category_id)
      : undefined;
    const border = capability.border_category_id
      ? categoriesById.get(capability.border_category_id)
      : undefined;
    const text = capability.text_category_id
      ? categoriesById.get(capability.text_category_id)
      : undefined;

    const style: NodeStylePatch = {};
    if (fill?.slot === "fill") style.fill = fill.color;
    if (border?.slot === "border") style.border = border.color;
    if (text?.slot === "textColor") style.textColor = text.color;
    if (Object.keys(style).length > 0) styles[capability.id] = style;
  }

  return styles;
}

export function mergeStyleCategoryLegend(
  legacy: LegendConfig,
  categories: CapabilityStyleCategory[]
): LegendConfig {
  const mergeSlot = (
    entries: LegendEntry[],
    slot: CapabilityStyleCategory["slot"]
  ): LegendEntry[] => {
    const merged = new Map(entries.map((entry) => [entry.id, entry]));
    for (const category of categories) {
      if (category.slot !== slot) continue;
      merged.set(category.entry_key, {
        id: category.entry_key,
        label: category.label,
        color: category.color,
      });
    }
    return [...merged.values()];
  };

  return {
    fill: mergeSlot(legacy.fill ?? [], "fill"),
    border: mergeSlot(legacy.border ?? [], "border"),
    textColor: mergeSlot(legacy.textColor ?? [], "textColor"),
  };
}