import type { DiagramCommand } from "./index";

export type StyleLegendEntry = { id: string; label: string; color: string };
export type StyleLegend = {
  fill: StyleLegendEntry[];
  border: StyleLegendEntry[];
  textColor: StyleLegendEntry[];
};

export type LegendCommand = Extract<DiagramCommand, { type: "SET_LEGEND" | "REMOVE_LEGEND" }>;

export function applyLegendCommands(
  commands: LegendCommand[],
  current?: Partial<StyleLegend> | null
): StyleLegend {
  const legend: StyleLegend = {
    fill: [...(current?.fill ?? [])],
    border: [...(current?.border ?? [])],
    textColor: [...(current?.textColor ?? [])],
  };

  for (const command of commands) {
    const entries = legend[command.slot];
    if (command.type === "REMOVE_LEGEND") {
      legend[command.slot] = entries.filter((entry) => entry.id !== command.entryId);
      continue;
    }
    const entry = { id: command.entryId, label: command.label, color: command.color };
    const existingIndex = entries.findIndex((item) => item.id === command.entryId);
    legend[command.slot] = existingIndex === -1
      ? [...entries, entry]
      : entries.map((item, index) => index === existingIndex ? entry : item);
  }

  return legend;
}