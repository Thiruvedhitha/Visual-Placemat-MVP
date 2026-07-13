"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/types/capability";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), industry: newIndustry.trim() || undefined }),
      });
      if (res.ok) {
        setNewName("");
        setNewIndustry("");
        setShowCreate(false);
        fetchClients();
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Folders</h1>
            <p className="text-sm text-gray-500 mt-1">
              Select a client to view their capability maps
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Client
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <form
              onSubmit={handleCreate}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
            >
              <h2 className="text-lg font-semibold mb-4">Create Client Folder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., AMEX"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="e.g., Banking"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Client Grid */}
        {clients.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-700">No client folders yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create a new client folder to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <a
                key={client.id}
                href={`/clients/${client.id}`}
                className="group bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-brand-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 font-bold text-lg">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  {client.industry && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {client.industry}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                  {client.name}
                </h3>
                {client.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {client.description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  Created {new Date(client.created_at).toLocaleDateString()}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
