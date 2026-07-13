"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  // Hide the global navbar on this page
  useEffect(() => {
    const nav = document.querySelector("nav");
    if (nav) nav.style.display = "none";
    return () => { if (nav) nav.style.display = ""; };
  }, []);

  const handleSignIn = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email profile openid User.Read",
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-6">
          <span className="text-3xl font-bold tracking-tight">
            <span className="text-red-500">c</span>
            <span className="text-gray-800">prime</span>
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center leading-tight mb-1">
          Welcome to Visual
        </h1>
        <h1 className="text-2xl font-bold text-gray-900 text-center leading-tight mb-2">
          Placemat
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 text-center mb-8">
          Sign in with your Cprime Microsoft account
        </p>

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-[#2f2f2f] hover:bg-[#1a1a1a] text-white font-medium py-3 px-6 rounded-md transition-colors cursor-pointer"
        >
          {/* Microsoft logo */}
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="0" y="0" width="10" height="10" fill="#F25022" />
            <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
            <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
            <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
          </svg>
          Sign in with Microsoft
        </button>

        {/* Note box */}
        <div className="mt-8 w-full border border-gray-200 rounded-md p-4 bg-gray-50">
          <p className="text-sm text-gray-600 whitespace-nowrap">
            <span className="font-semibold text-gray-700">Note:</span>{" "}
            Use your @cprime.com email address to sign in.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-400 text-center">
          Secure authentication powered by Microsoft Azure AD
        </p>
      </div>
    </div>
  );
}
