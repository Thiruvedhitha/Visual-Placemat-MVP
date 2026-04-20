import EntryCards from "@/components/ui/EntryCards";
import RecentDiagrams from "@/components/ui/RecentDiagrams";
import HowItWorks from "@/components/ui/HowItWorks";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-slate-50 pb-24 pt-20 text-center sm:pt-28">
        {/* Decorative grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <span className="mb-4 inline-block rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-brand-300">
            AI Powered Visual Capability Map
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn your data into
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
              {" "}Visual Capability Maps
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            Upload a spreadsheet, pick a template, or just describe what you need.
            Visual Placemat builds ready-to-use visuals in minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#how-it-works" className="rounded-xl border border-slate-500 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white hover:text-white">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Get Started cards ── */}
      <section className="mx-auto -mt-12 max-w-5xl px-4 sm:px-6 lg:px-8">
        <EntryCards />
      </section>

      {/* ── Recent maps ── */}
      <section className="mx-auto max-w-5xl px-4 pt-16 sm:px-6 lg:px-8">
        <RecentDiagrams />
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
        <HowItWorks />
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-navy-950 py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to build your first diagram?
          </h2>
          <p className="mt-3 text-slate-400">
            Start creating in under a minute.
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}