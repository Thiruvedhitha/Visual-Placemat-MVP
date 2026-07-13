"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Client, CapabilityCatalog } from "@/types/capability";
import { useCatalogStore } from "@/stores/catalogStore";

interface ClientDetail extends Client {
  role: "admin" | "editor" | "viewer";
  catalogs: CapabilityCatalog[];
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  nodeCount: number;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [instantiating, setInstantiating] = useState(false);

  // Folder actions state
  const [showRename, setShowRename] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  async function fetchClient() {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) {
        setError(res.status === 403 ? "Access denied" : "Failed to load client");
        return;
      }
      setClient(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function openTemplatePicker() {
    setShowTemplatePicker(true);
    setNewMapName("");
    setSelectedTemplate(null);
    if (templates.length === 0) {
      setLoadingTemplates(true);
      try {
        const res = await fetch("/api/catalogs/templates");
        const data = await res.json();
        if (data.templates) setTemplates(data.templates);
      } finally {
        setLoadingTemplates(false);
      }
    }
  }

  async function handleInstantiate() {
    if (!newMapName.trim()) return;
    setInstantiating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/catalogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMapName.trim(),
          templateId: selectedTemplate || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowTemplatePicker(false);
        // Clear Zustand store so dashboard fetches fresh from DB
        useCatalogStore.getState().clear();
        // Navigate to canvas with the new catalog
        router.push(`/dashboard?catalogId=${data.catalogId}`);
      }
    } finally {
      setInstantiating(false);
    }
  }

  async function handleRename() {
    if (!renameName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      if (res.ok) {
        setShowRename(false);
        fetchClient();
      }
    } finally {
      setRenaming(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this client folder? All maps will be hidden but not deleted.")) return;
    // Archive all catalogs in this folder
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: `[ARCHIVED] ${client?.description || ""}` }),
    });
    if (res.ok) router.push("/clients");
  }

  async function handleExportAll() {
    // Trigger download of all catalog names as a summary
    if (!client) return;
    const summary = client.catalogs.map(c => `${c.name} (${c.status}) — Updated: ${new Date(c.updated_at).toLocaleDateString()}`).join("\n");
    const blob = new Blob([`Client: ${client.name}\nIndustry: ${client.industry || "N/A"}\n\nCapability Maps:\n${summary}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${client.name}_maps_summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error || "Client not found"}</p>
          <a href="/clients" className="text-brand-500 text-sm mt-2 hover:underline">
            ← Back to clients
          </a>
        </div>
      </div>
    );
  }

  const canEdit = client.role === "admin" || client.role === "editor";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <a href="/clients" className="text-sm text-brand-500 hover:underline">
            ← All Clients
          </a>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full font-medium capitalize">
                {client.role}
              </span>
            </div>
            {client.industry && (
              <p className="text-sm text-gray-500 mt-1">{client.industry}</p>
            )}
            {client.description && (
              <p className="text-sm text-gray-600 mt-2">{client.description}</p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {/* Folder actions dropdown */}
            {client.role === "admin" && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
                  title="Folder actions"
                >
                  ⋯
                </button>
                {showActions && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-20">
                    <button
                      onClick={() => { setShowActions(false); setRenameName(client.name); setShowRename(true); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-t-lg"
                    >
                      Rename Folder
                    </button>
                    <button
                      onClick={() => { setShowActions(false); handleArchive(); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-amber-600"
                    >
                      Archive Folder
                    </button>
                    <button
                      onClick={() => { setShowActions(false); handleExportAll(); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-b-lg"
                    >
                      Export All Maps
                    </button>
                  </div>
                )}
              </div>
            )}
            {client.role === "admin" && (
              <a
                href={`/clients/${clientId}/members`}
                className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Manage Members
              </a>
            )}
            {canEdit && (
              <button
                onClick={openTemplatePicker}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                + Instantiate Template
              </button>
            )}
          </div>
        </div>

        {/* Rename Modal */}
        {showRename && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Rename Client Folder</h2>
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowRename(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                <button
                  onClick={handleRename}
                  disabled={renaming || !renameName.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
                >
                  {renaming ? "Saving..." : "Rename"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Picker Modal */}
        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
              <h2 className="text-lg font-semibold mb-1">Instantiate Template</h2>
              <p className="text-sm text-gray-500 mb-4">
                Create a new capability map inside <strong>{client.name}</strong>
              </p>

              {/* Map name */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Map Name *</label>
              <input
                type="text"
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                placeholder={`e.g., ${client.name} SPM Capability`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                autoFocus
              />

              {/* Template selection */}
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4">
                {/* Blank option */}
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${
                    selectedTemplate === null ? "bg-brand-50 border-l-4 border-brand-500" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800">Blank Map</p>
                  <p className="text-xs text-gray-500">Start from scratch</p>
                </button>

                {loadingTemplates ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">Loading templates...</div>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${
                        selectedTemplate === t.id ? "bg-brand-50 border-l-4 border-brand-500" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.category} · {t.nodeCount} capabilities</p>
                    </button>
                  ))
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTemplatePicker(false)} className="px-4 py-2 text-gray-600">
                  Cancel
                </button>
                <button
                  onClick={handleInstantiate}
                  disabled={instantiating || !newMapName.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
                >
                  {instantiating ? "Creating..." : "Create Map"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Catalogs List */}
        {client.catalogs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-700">No capability maps yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Click "Instantiate Template" to create the first capability map for this client
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Map Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Last Modified</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {client.catalogs.map((catalog) => (
                  <tr key={catalog.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <a
                        href={`/dashboard?catalogId=${catalog.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-brand-600"
                      >
                        {catalog.name}
                      </a>
                      {catalog.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{catalog.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          catalog.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {catalog.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(catalog.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/dashboard?catalogId=${catalog.id}`}
                        className="text-sm text-brand-600 hover:text-brand-800 font-medium"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
