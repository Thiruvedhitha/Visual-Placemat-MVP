import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

export interface ClientCatalog {
  id: string;
  name: string;
  industry: string | null;
  updated_at: string;
  capability_count: number;
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
      `id, name, client_name, industry, updated_at,
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

    folderMap.get(key)!.push({
      id: row.id,
      name: row.name,
      industry: row.industry ?? null,
      updated_at: row.updated_at,
      // Supabase returns aggregate as [{count: "N"}]
      capability_count: Number(
        (row.capabilities as unknown as { count: string }[])?.[0]?.count ?? 0
      ),
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
