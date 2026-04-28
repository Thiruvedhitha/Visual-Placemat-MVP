"use client";

const TEMPLATES = [
  { name: "Capability map", color: "#1545d8" },
  { name: "Org chart", color: "#22c55e" },
  { name: "BPMN flow", color: "#a855f7" },
  { name: "ER diagram", color: "#ef4444" },
];

const LAYERS = [
  { level: 0, label: "L0 — Domain", color: "#0f1b2d" },
  { level: 1, label: "L1 — Group", color: "#1545d8" },
  { level: 2, label: "L2 — Subgroup", color: "#599dff" },
  { level: 3, label: "L3 — Leaf", color: "#d1e3ff" },
];

interface LeftSidebarProps {
  visibleLevels: Set<number>;
  onToggleLevel: (level: number) => void;
}

export default function LeftSidebar({ visibleLevels, onToggleLevel }: LeftSidebarProps) {
  return (
    <aside className="flex w-52 flex-shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-4">
      {/* Templates */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Templates
        </h3>
        <ul className="space-y-1.5">
          {TEMPLATES.map((t) => (
            <li key={t.name} className="flex items-center gap-2 text-sm text-slate-700 cursor-default">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: t.color }}
              />
              {t.name}
            </li>
          ))}
        </ul>
      </div>

      {/* Layers */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Layers
        </h3>
        <ul className="space-y-1.5">
          {LAYERS.map((l) => (
            <li key={l.level} className="flex items-center gap-2">
              <button
                onClick={() => onToggleLevel(l.level)}
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full transition-opacity"
                  style={{
                    background: l.color,
                    opacity: visibleLevels.has(l.level) ? 1 : 0.3,
                  }}
                />
                <span style={{ opacity: visibleLevels.has(l.level) ? 1 : 0.5 }}>
                  {l.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
