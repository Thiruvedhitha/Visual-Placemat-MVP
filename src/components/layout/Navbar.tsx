"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-navy-800/20 bg-navy-950 shadow-lg">
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Left section */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white"
          >
            <svg
              className="h-8 w-8 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="headerGrad" x1="4" y1="3" x2="32" y2="3" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#60a5fa" />
                  <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              {/* Outer shell with gradient border */}
              <rect x="1.5" y="1.5" width="33" height="33" rx="5" fill="#0f172a" stroke="url(#logoGrad)" strokeWidth="1.8" />
              {/* L0 header bar — gradient */}
              <rect x="4" y="4" width="28" height="5.5" rx="2" fill="url(#headerGrad)" />
              {/* L1 left column */}
              <rect x="4" y="11.5" width="13" height="20" rx="2" fill="#1e40af" opacity="0.35" />
              {/* L1 right column */}
              <rect x="19" y="11.5" width="13" height="20" rx="2" fill="#1e40af" opacity="0.35" />
              {/* L2 left blocks */}
              <rect x="5.5" y="13" width="10" height="4.5" rx="1.2" fill="#3b82f6" />
              <rect x="5.5" y="19" width="10" height="4.5" rx="1.2" fill="#60a5fa" />
              <rect x="5.5" y="25" width="10" height="4.5" rx="1.2" fill="#22d3ee" opacity="0.7" />
              {/* L2 right blocks */}
              <rect x="20.5" y="13" width="10" height="6" rx="1.2" fill="#60a5fa" />
              <rect x="20.5" y="20.5" width="10" height="4" rx="1.2" fill="#22d3ee" opacity="0.7" />
              <rect x="20.5" y="26" width="10" height="3.5" rx="1.2" fill="#3b82f6" />
              {/* Sparkle accent dot */}
              <circle cx="31" cy="5" r="1.2" fill="#ffffff" opacity="0.8" />
            </svg>
            Visual Placemat
          </Link>

          {/* Desktop nav links */}
          <div className="ml-4 hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              className="rounded-full bg-brand-600 px-3.5 py-1 text-sm font-medium text-white hover:bg-brand-500"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full px-3.5 py-1 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              My Works
            </Link>
          </div>
        </div>

        {/* Right section */}
        <div className="hidden items-center gap-2 sm:flex">
          <button className="rounded-lg border border-slate-500 px-4 py-1.5 text-sm font-medium text-slate-200 hover:border-white hover:text-white">
            Sign in
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white sm:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-navy-800/40 bg-navy-950 px-4 pb-4 pt-2 sm:hidden">
          <div className="flex flex-col gap-2">
            <Link href="/" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
              Home
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
            >
              My Works
            </Link>
            <hr className="my-1 border-navy-800/40" />
            <button className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-medium text-slate-200 hover:border-white hover:text-white">
              Sign in
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
