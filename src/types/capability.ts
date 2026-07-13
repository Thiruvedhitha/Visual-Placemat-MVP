export interface Client {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  logo_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMember {
  id: string;
  client_id: string;
  user_id: string;
  role: "admin" | "editor" | "viewer";
  invited_by: string | null;
  created_at: string;
}

export interface CapabilityCatalog {
  id: string;
  user_id: string | null;
  client_id: string | null;
  name: string;
  description: string | null;
  client_name: string | null;
  industry: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Capability {
  id: string;
  catalog_id: string;
  parent_id: string | null;
  level: 0 | 1 | 2 | 3;
  name: string;
  description: string | null;
  note: string | null;
  sort_order: number;
  source: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisualMap {
  id: string;
  catalog_id: string;
  name: string;
  version_number: number;
  is_active: boolean;
  layout_data: Record<string, unknown> | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiffHistory {
  id: string;
  catalog_id: string;
  applied_by: string | null;
  prompt_text: string;
  diff_payload: Record<string, unknown>[];
  status: "applied" | "cancelled" | "rolled_back";
  model_used: string | null;
  visual_map_id: string | null;
  created_at: string;
  applied_at: string | null;
}

export interface CapabilityChunk {
  id: string;
  label: string;
  level: string;
  industry: string;
  content: string;
  embedding: number[] | null;
  source: "template" | "client_map";
  source_catalog_id: string | null;
  created_at: string;
}

export interface PromptSession {
  id: string;
  catalog_id: string;
  user_id: string | null;
  prompt: string;
  model_used: string | null;
  retry_count: number;
  validation_error: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface CatalogShare {
  id: string;
  catalog_id: string;
  user_id: string;
  role: "viewer" | "editor" | "owner";
  created_at: string;
}

/** Row shape coming out of the Excel parser (before DB insert) */
export interface ParsedCapabilityRow {
  l0: string | null;
  l1: string | null;
  l2: string | null;
  l3: string | null;
  description: string | null;
}

// ─── Legacy client folder types (used by LeftSidebar & ClientFolders UI) ────

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
