"use client";

import ClientFolders from "@/components/ui/ClientFolders";

export default function WorksPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-2xl font-bold text-slate-800">My Works</h1>
        <ClientFolders />
      </div>
    </div>
  );
}
