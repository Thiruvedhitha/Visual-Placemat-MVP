const steps = [
  {
    step: "01",
    title: "Upload or describe",
    description:
      "Drop an Excel / CSV containing your capability catalog with L0–L3 columns, pick a ready-made template, or describe your capability map in plain English.",
    color: "from-blue-500 to-cyan-400",
    bg: "bg-blue-50",
    ring: "ring-blue-100",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "AI builds the map",
    description:
      "Our AI parses columns, detects hierarchies, and generates a structured visual capability map automatically.",
    color: "from-violet-500 to-purple-400",
    bg: "bg-violet-50",
    ring: "ring-violet-100",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Edit via prompts",
    description:
      "Refine your map using natural language prompts — rearrange nodes, update labels, change colors and more. See changes instantly on the live canvas.",
    color: "from-emerald-500 to-teal-400",
    bg: "bg-emerald-50",
    ring: "ring-emerald-100",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Export & share",
    description:
      "Download as PNG, SVG, PDF or share a live link with your team.",
    color: "from-amber-500 to-orange-400",
    bg: "bg-amber-50",
    ring: "ring-amber-100",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <div>
      {/* Section header */}
      <div className="mb-14 text-center">
        <span className="mb-3 inline-block rounded-full bg-brand-50 px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand-600">
          How it works
        </span>
        <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          From data to visual map in <span className="text-brand-600">4 steps</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-slate-500">
          Upload your capability catalog and get a ready-to-use map in under a minute.
        </p>
      </div>

      {/* Steps grid with connector lines on desktop */}
      <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {/* Horizontal connector line (desktop only) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[12%] right-[12%] top-[52px] hidden h-[2px] bg-gradient-to-r from-blue-200 via-violet-200 via-50% to-amber-200 lg:block"
        />

        {steps.map((s, i) => (
          <div
            key={s.step}
            className="group relative flex flex-col items-start rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            {/* Step badge */}
            <div className="relative z-10 mb-5 flex items-center gap-3">
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${s.color} text-sm font-bold text-white shadow-md ring-4 ${s.ring} transition-transform duration-200 group-hover:scale-110`}
              >
                {s.step}
              </span>
              {/* Arrow between badge and next card (mobile / tablet) */}
              {i < steps.length - 1 && (
                <svg className="hidden h-4 w-4 text-slate-300 sm:block lg:hidden" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              )}
            </div>

            {/* Icon + Title */}
            <div className="mb-2 flex items-center gap-2.5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg} text-slate-700`}>
                {s.icon}
              </span>
              <h3 className="text-[15px] font-bold text-slate-800">{s.title}</h3>
            </div>

            {/* Description */}
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {s.description}
            </p>

            {/* Bottom accent bar on hover */}
            <div
              className={`absolute bottom-0 left-4 right-4 h-[3px] rounded-full bg-gradient-to-r ${s.color} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
