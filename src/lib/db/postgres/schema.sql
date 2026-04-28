-- ══════════════════════════════════════════════════════════════
-- Visual Placemat — Supabase Schema (MVP v3 — Multi-user)
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ══════════════════════════════════════════════════════════════

-- Prerequisite: enable pgvector for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ── DROP old tables (order matters due to FK constraints) ───
-- Drop policies only on tables that previously existed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'capability_catalogs') THEN
    DROP POLICY IF EXISTS "access_catalogs" ON capability_catalogs;
    DROP POLICY IF EXISTS "Allow all for authenticated" ON capability_catalogs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'capabilities') THEN
    DROP POLICY IF EXISTS "access_capabilities" ON capabilities;
    DROP POLICY IF EXISTS "Allow all for authenticated" ON capabilities;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'visual_maps') THEN
    DROP POLICY IF EXISTS "access_visual_maps" ON visual_maps;
    DROP POLICY IF EXISTS "Allow all for authenticated" ON visual_maps;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'diff_history') THEN
    DROP POLICY IF EXISTS "access_diff_history" ON diff_history;
    DROP POLICY IF EXISTS "Allow all for authenticated" ON diff_history;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'prompt_sessions') THEN
    DROP POLICY IF EXISTS "access_prompt_sessions" ON prompt_sessions;
  END IF;
END $$;

DROP TABLE IF EXISTS catalog_shares CASCADE;
DROP TABLE IF EXISTS prompt_sessions CASCADE;
DROP TABLE IF EXISTS capability_chunks CASCADE;
DROP TABLE IF EXISTS diff_history CASCADE;
DROP TABLE IF EXISTS visual_maps CASCADE;
DROP TABLE IF EXISTS capabilities CASCADE;
DROP TABLE IF EXISTS capability_catalogs CASCADE;

-- ── 1. capability_catalogs ─────────────────────────────────
-- One row per uploaded Excel file, scoped to the user who uploaded it
CREATE TABLE IF NOT EXISTS capability_catalogs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,              -- "AMEX Capability Map v1"
  description  text,
  client_name  text,                       -- "AMEX" (display only, not used in RAG)
  industry     text,                       -- "Banking" — sent to RAG filter
  status       text DEFAULT 'active',      -- "active" | "archived"
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── 2. capabilities ────────────────────────────────────────
-- Hierarchical L0→L1→L2→L3, fully scoped to a catalog
CREATE TABLE IF NOT EXISTS capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  uuid NOT NULL REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES capabilities(id) ON DELETE SET NULL,
  level       smallint NOT NULL CHECK (level BETWEEN 0 AND 3),
  name        text NOT NULL,
  description text,
  sort_order  integer DEFAULT 0,
  source      text DEFAULT 'xlsx_import',  -- "xlsx_import" | "ai_generated" | "manual"
  is_deleted  boolean DEFAULT false,       -- soft delete for undo support
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capabilities_catalog      ON capabilities(catalog_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_parent       ON capabilities(parent_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_level        ON capabilities(catalog_id, level);
CREATE INDEX IF NOT EXISTS idx_capabilities_catalog_sort ON capabilities(catalog_id, sort_order);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS capabilities_updated_at ON capabilities;
CREATE TRIGGER capabilities_updated_at
  BEFORE UPDATE ON capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. visual_maps ─────────────────────────────────────────
-- Each "Apply Changes" inserts a new row (version), old rows set is_active=false
CREATE TABLE IF NOT EXISTS visual_maps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id     uuid NOT NULL REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  name           text NOT NULL,
  version_number integer DEFAULT 1,
  layout_data    jsonb,                    -- React Flow node/edge positions
  is_active      boolean DEFAULT true,
  thumbnail_url  text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visual_maps_active ON visual_maps(catalog_id, is_active);

-- ── 4. diff_history ────────────────────────────────────────
-- Audit log: which prompt caused which changes
CREATE TABLE IF NOT EXISTS diff_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    uuid REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  applied_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt_text   text NOT NULL,
  diff_payload  jsonb NOT NULL,            -- [{action, level, name, parent_id}...]
  status        text DEFAULT 'applied',    -- "applied" | "cancelled" | "rolled_back"
  model_used    text,                      -- "claude-sonnet-4" | "phi-3" etc.
  visual_map_id uuid REFERENCES visual_maps(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  applied_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_diff_history_catalog ON diff_history(catalog_id);
CREATE INDEX IF NOT EXISTS idx_diff_history_applied ON diff_history(applied_by);

-- ── 5. capability_chunks (RAG knowledge base) ──────────────
-- Shared across all users, filtered by industry tag at query time
CREATE TABLE IF NOT EXISTS capability_chunks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label             text NOT NULL,
  level             text NOT NULL,
  industry          text NOT NULL,         -- the isolation filter for RAG queries
  content           text NOT NULL,         -- readable text sent to Claude
  embedding         vector(1536),          -- pgvector column
  source            text NOT NULL,         -- "template" | "client_map"
  source_catalog_id uuid REFERENCES capability_catalogs(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON capability_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_industry ON capability_chunks(industry);

-- ── 6. prompt_sessions ─────────────────────────────────────
-- Tracks every AI prompt for observability and debugging
CREATE TABLE IF NOT EXISTS prompt_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id       uuid REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt           text NOT NULL,
  model_used       text,
  retry_count      smallint DEFAULT 0,
  validation_error text,
  latency_ms       integer,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prompt_sessions_catalog ON prompt_sessions(catalog_id);

-- ── 7. catalog_shares ──────────────────────────────────────
-- Enables controlled cross-user access (viewer/editor)
CREATE TABLE IF NOT EXISTS catalog_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text DEFAULT 'viewer',        -- "viewer" | "editor" | "owner"
  created_at timestamptz DEFAULT now(),
  UNIQUE(catalog_id, user_id)
);

-- ── RLS POLICIES ───────────────────────────────────────────
ALTER TABLE capability_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE capabilities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_maps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE diff_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_sessions     ENABLE ROW LEVEL SECURITY;
-- capability_chunks: NO RLS — shared knowledge base, filtered by industry

-- capability_catalogs: owner or shared
CREATE POLICY "access_catalogs" ON capability_catalogs
  FOR ALL USING (
    user_id = auth.uid() OR
    id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
  );

-- capabilities: scoped via catalog ownership
CREATE POLICY "access_capabilities" ON capabilities
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
    )
  );

-- visual_maps: same scoping as capabilities
CREATE POLICY "access_visual_maps" ON visual_maps
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
    )
  );

-- diff_history: owner only (no shared access to audit logs)
CREATE POLICY "access_diff_history" ON diff_history
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs WHERE user_id = auth.uid()
    )
  );

-- prompt_sessions: user sees only their own
CREATE POLICY "access_prompt_sessions" ON prompt_sessions
  FOR ALL USING (user_id = auth.uid());
