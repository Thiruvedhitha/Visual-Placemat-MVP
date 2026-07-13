"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

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
              href="/works"
              className="rounded-full px-3.5 py-1 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              My Works
            </Link>
          </div>
        </div>

        {/* Right section */}
        <div className="hidden items-center gap-2 sm:flex">
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                title={user.email ?? "Profile"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-700 bg-navy-900 p-4 shadow-xl z-50">
                  <p className="text-sm font-medium text-white truncate">
                    {user.user_metadata?.full_name || "User"}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {user.email}
                  </p>
                  <hr className="my-3 border-slate-700" />
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-md px-3 py-1.5 text-left text-sm text-red-400 hover:bg-white/10 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-slate-500 px-4 py-1.5 text-sm font-medium text-slate-200 hover:border-white hover:text-white"
            >
              Sign in
            </Link>
          )}
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
            {user ? (
              <>
                <p className="px-3 py-1 text-xs text-slate-400 truncate">{user.email}</p>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 hover:bg-white/10"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-medium text-slate-200 hover:border-white hover:text-white"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
