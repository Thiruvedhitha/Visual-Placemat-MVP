-- ═══════════════════════════════════════════════════════════
-- MVP SCHEMA MIGRATION — paste & run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── TABLE 1: capability_catalogs — add industry + status ──
ALTER TABLE capability_catalogs
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS status   text DEFAULT 'active';

-- ── TABLE 2: capabilities — add source + updated_at ───────
ALTER TABLE capabilities
  ADD COLUMN IF NOT EXISTS source     text DEFAULT 'xlsx_import',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS capabilities_updated_at ON capabilities;
CREATE TRIGGER capabilities_updated_at
  BEFORE UPDATE ON capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Extra index for ordered retrieval
CREATE INDEX IF NOT EXISTS capabilities_catalog_sort_idx
  ON capabilities(catalog_id, sort_order);

-- ── TABLE 3: visual_maps — add version_number + is_active ─
ALTER TABLE visual_maps
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active      boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS visual_maps_active_idx
  ON visual_maps(catalog_id, is_active);

-- ── TABLE 4: diff_history (NEW) ───────────────────────────
CREATE TABLE IF NOT EXISTS diff_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    uuid REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  prompt_text   text NOT NULL,
  diff_payload  jsonb NOT NULL,
  status        text DEFAULT 'applied',
  visual_map_id uuid REFERENCES visual_maps(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diff_history_catalog_idx ON diff_history(catalog_id);
CREATE INDEX IF NOT EXISTS diff_history_created_idx ON diff_history(created_at DESC);

-- RLS
ALTER TABLE diff_history ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- DONE — 3 tables modified + 1 new table created
-- ═══════════════════════════════════════════════════════════
