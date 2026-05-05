"use client";

import { useState } from "react";
import Link from "next/link";

const cards = [
  {
    id: "upload",
    title: "Upload Excel / CSV",
    subtitle: "L0–L3 columns → auto diagram",
    href: "/documents",
    accent: true,
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="10" height="36" rx="2" fill="#22c55e" opacity={0.85} />
        <rect x="20" y="14" width="10" height="28" rx="2" fill="#3b82f6" opacity={0.85} />
        <rect x="32" y="22" width="10" height="20" rx="2" fill="#f59e0b" opacity={0.85} />
      </svg>
    ),
  },
  {
    id: "ai-prompt",
    title: "Start with AI prompt",
    subtitle: "Describe your diagram",
    href: "/dashboard",
    accent: false,
    icon: (
      <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
];

export default function EntryCards() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
      {cards.map((card) => {
        const isHovered = hoveredId === card.id;
        return (
          <Link
            key={card.id}
            href={card.href}
            onMouseEnter={() => setHoveredId(card.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`
              group relative flex flex-col items-center gap-3 rounded-2xl border-2 bg-white px-5 py-8 shadow-md
              transition-all duration-200 ease-out cursor-pointer
              ${card.accent
                ? "border-dashed border-brand-400 ring-1 ring-brand-200 hover:border-brand-500 hover:shadow-lg"
                : "border-transparent hover:border-brand-200 hover:shadow-lg"
              }
              ${isHovered ? "scale-[1.03] -translate-y-1" : "scale-100 translate-y-0"}
            `}
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-200 ${card.accent ? "bg-brand-50" : "bg-slate-50"} ${isHovered ? "scale-110" : ""}`}>
              {card.icon}
            </div>
            <div className="text-center">
              <span className="block text-sm font-semibold text-slate-800 group-hover:text-brand-700">
                {card.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {card.subtitle}
              </span>
            </div>
            <svg
              className={`absolute bottom-2.5 right-2.5 h-4 w-4 text-brand-400 transition-all duration-200 ${isHovered ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}
