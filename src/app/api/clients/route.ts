import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

export interface RecentCommit {
  summary: string;
  adds: number;
  deletes: number;
  renames: number;
  styles: number;
  ts: string;
}

export interface ClientCatalog {
  id: string;
  name: string;
  industry: string | null;
  updated_at: string;
  capability_count: number;
  recent_commits: RecentCommit[];
}

export interface ClientFolder {
  client_name: string;
  catalogs: ClientCatalog[];
}

/**
 * GET /api/clients
 * Returns all active catalogs grouped by client_name.
 * Catalogs with no client_name are grouped under "My Diagrams".
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("capability_catalogs")
    .select(
      `id, name, client_name, industry, updated_at, chat_history,
       capabilities(count)`
    )
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by client_name (null → "My Diagrams")
  const folderMap = new Map<string, ClientCatalog[]>();

  for (const row of data ?? []) {
    const key: string = row.client_name ?? "My Diagrams";
    if (!folderMap.has(key)) folderMap.set(key, []);

    // Extract recent commits from chat_history
    type CommitEntry = { summary: string; adds: number; deletes: number; renames: number; styles: number; ts: string };
    type ChatHistory = { commits?: CommitEntry[] };
    const chatHistory = (row as Record<string, unknown>).chat_history as ChatHistory | null;
    const recentCommits: RecentCommit[] = (chatHistory?.commits ?? [])
      .slice(-5)
      .reverse()
      .map((c: CommitEntry) => ({
        summary: c.summary,
        adds: c.adds ?? 0,
        deletes: c.deletes ?? 0,
        renames: c.renames ?? 0,
        styles: c.styles ?? 0,
        ts: c.ts || row.updated_at,
      }));

    folderMap.get(key)!.push({
      id: row.id,
      name: row.name,
      industry: row.industry ?? null,
      updated_at: row.updated_at,
      // Supabase returns aggregate as [{count: "N"}]
      capability_count: Number(
        (row.capabilities as unknown as { count: string }[])?.[0]?.count ?? 0
      ),
      recent_commits: recentCommits,
    });
  }

  // Build ordered list: named clients alphabetically, "My Diagrams" last
  const folders: ClientFolder[] = [];

  Array.from(folderMap.entries())
    .sort(([a], [b]) => {
      if (a === "My Diagrams") return 1;
      if (b === "My Diagrams") return -1;
      return a.localeCompare(b);
    })
    .forEach(([client_name, catalogs]) => {
      folders.push({ client_name, catalogs });
    });

  return NextResponse.json(folders);
}
