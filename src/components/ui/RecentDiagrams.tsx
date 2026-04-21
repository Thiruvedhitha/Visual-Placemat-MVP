"use client";

const recentDiagrams = [
  { id: "1", name: "Capability Map v2", updatedAt: "2 days ago", color: "bg-emerald-500" },
  { id: "2", name: "HR Org Chart", updatedAt: "5 days ago", color: "bg-blue-500" },
  { id: "3", name: "IT Architecture", updatedAt: "1 week ago", color: "bg-amber-500" },
];

export default function RecentDiagrams() {
  return (
    <section className="w-full">
      <h2 className="mb-4 text-lg font-semibold text-slate-700">
        Recent Works
      </h2>

      <div className="flex flex-wrap gap-3">
        {recentDiagrams.map((diagram) => (
          <button
            key={diagram.id}
            className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all duration-150 hover:border-brand-300 hover:shadow-md active:scale-[0.98]"
          >
            {/* Color dot */}
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${diagram.color}`} />

            {/* Info */}
            <div>
              <span className="block text-sm font-medium text-slate-800 group-hover:text-brand-700">
                {diagram.name}
              </span>
              <span className="block text-xs text-slate-400">
                {diagram.updatedAt}
              </span>
            </div>

            {/* Arrow */}
            <svg
              className="ml-2 h-4 w-4 text-slate-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ))}
      </div>
    </section>
  );
}
