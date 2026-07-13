import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export interface RecentCommit {
  summary: string;
  adds: number;
  deletes: number;
  renames: number;
  styles: number;
  ts: string;
}

export interface ClientCatalogItem {
  id: string;
  name: string;
  industry: string | null;
  updated_at: string;
  capability_count: number;
  recent_commits: RecentCommit[];
}

export interface ClientFolder {
  client_name: string;
  catalogs: ClientCatalogItem[];
}

/**
 * GET /api/my-works
 * Returns the current user's catalogs grouped by client_name.
 * Personal diagrams (no client_name) are grouped under "My Diagrams".
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();

  // 1. Get user's own catalogs (My Diagrams)
  const { data, error } = await db
    .from("capability_catalogs")
    .select(
      `id, name, client_name, industry, updated_at, chat_history,
       capabilities(count)`
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Get client folders the user is a member of + their catalogs
  const { data: memberships } = await db
    .from("client_members")
    .select("client_id")
    .eq("user_id", user.id);

  const clientIds = (memberships ?? []).map((m) => m.client_id);

  let clientCatalogs: typeof data = [];
  if (clientIds.length > 0) {
    const { data: cCatalogs } = await db
      .from("capability_catalogs")
      .select(
        `id, name, client_name, client_id, industry, updated_at, chat_history,
         capabilities(count)`
      )
      .in("client_id", clientIds)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    clientCatalogs = cCatalogs ?? [];
  }

  // 3. Get client names for mapping
  let clientNameMap = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await db
      .from("clients")
      .select("id, name")
      .in("id", clientIds);

    for (const c of clients ?? []) {
      clientNameMap.set(c.id, c.name);
    }
  }

  // Group by client_name (null → "My Diagrams")
  const folderMap = new Map<string, ClientCatalogItem[]>();

  for (const row of data ?? []) {
    // Skip catalogs that belong to a client folder (they'll show under client)
    if ((row as Record<string, unknown>).client_id) continue;
    const key: string = row.client_name ?? "My Diagrams";
    if (!folderMap.has(key)) folderMap.set(key, []);

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
      capability_count: Number(
        (row.capabilities as unknown as { count: string }[])?.[0]?.count ?? 0
      ),
      recent_commits: recentCommits,
    });
  }

  // Also group client folder catalogs by client name
  for (const row of clientCatalogs) {
    const cId = (row as Record<string, unknown>).client_id as string;
    const key = clientNameMap.get(cId) || "Unknown Client";
    if (!folderMap.has(key)) folderMap.set(key, []);

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
