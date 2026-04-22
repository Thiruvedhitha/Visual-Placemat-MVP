"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function DashboardCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const catalogId = searchParams.get("catalogId");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50">
        <svg className="h-10 w-10 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">Canvas</h1>
        <p className="mt-2 text-sm text-slate-500">Yet to be implemented</p>
        {catalogId && (
          <p className="mt-1 text-xs text-slate-400">
            Catalog ID: <span className="font-mono">{catalogId}</span>
          </p>
        )}
      </div>
      <Link
        href="/"
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md active:scale-95"
      >
        &larr; Back to Home
      </Link>
    </div>
  );
}
