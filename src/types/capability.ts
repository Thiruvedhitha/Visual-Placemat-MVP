export interface CapabilityCatalog {
  id: string;
  name: string;
  description: string | null;
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
  sort_order: number;
  created_at: string;
}

export interface VisualMap {
  id: string;
  catalog_id: string;
  name: string;
  layout_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Row shape coming out of the Excel parser (before DB insert) */
export interface ParsedCapabilityRow {
  l0: string | null;
  l1: string | null;
  l2: string | null;
  l3: string | null;
  description: string | null;
}
