-- ══════════════════════════════════════════════════════════════
-- Visual Placemat — Client Folder Management Migration
-- Run AFTER schema.sql in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. clients table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  industry    text,
  description text,
  logo_url    text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);

-- ── 2. client_members table ────────────────────────────────
CREATE TABLE IF NOT EXISTS client_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_members_user   ON client_members(user_id);
CREATE INDEX IF NOT EXISTS idx_client_members_client ON client_members(client_id);

-- ── 3. Add client_id to capability_catalogs ────────────────
ALTER TABLE capability_catalogs
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalogs_client ON capability_catalogs(client_id);

-- ── 4. Auto-admin trigger ──────────────────────────────────
-- When a user creates a client, they automatically become admin
CREATE OR REPLACE FUNCTION add_client_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO client_members (client_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS client_auto_admin ON clients;
CREATE TRIGGER client_auto_admin
  AFTER INSERT ON clients
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION add_client_creator_as_admin();

-- ── 5. Helper function: write permission check ─────────────
CREATE OR REPLACE FUNCTION user_can_write_client(p_client_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_members
    WHERE client_id = p_client_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── 6. Updated_at trigger for clients ──────────────────────
DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_members ENABLE ROW LEVEL SECURITY;

-- ── clients RLS ────────────────────────────────────────────

-- SELECT: only visible to members
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (
    id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
  );

-- INSERT: any authenticated user can create a client
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: admin only
CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (
    id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- DELETE: admin only
CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (
    id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ── client_members RLS ─────────────────────────────────────

-- SELECT: members can see other members of their clients
CREATE POLICY "client_members_select" ON client_members
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
  );

-- INSERT: admin only
CREATE POLICY "client_members_insert" ON client_members
  FOR INSERT WITH CHECK (
    client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- UPDATE: admin only (changing roles)
CREATE POLICY "client_members_update" ON client_members
  FOR UPDATE USING (
    client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- DELETE: admin can remove anyone, user can remove themselves
CREATE POLICY "client_members_delete" ON client_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ── Updated capability_catalogs RLS ────────────────────────
-- Drop existing policy and replace with client-aware version
DROP POLICY IF EXISTS "access_catalogs" ON capability_catalogs;

CREATE POLICY "access_catalogs" ON capability_catalogs
  FOR ALL USING (
    user_id = auth.uid()
    OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
    OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
  );

-- ── Updated capabilities RLS ───────────────────────────────
DROP POLICY IF EXISTS "access_capabilities" ON capabilities;

CREATE POLICY "access_capabilities" ON capabilities
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
      OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
    )
  );

-- ── Updated visual_maps RLS ────────────────────────────────
DROP POLICY IF EXISTS "access_visual_maps" ON visual_maps;

CREATE POLICY "access_visual_maps" ON visual_maps
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR id IN (SELECT catalog_id FROM catalog_shares WHERE user_id = auth.uid())
      OR client_id IN (SELECT client_id FROM client_members WHERE user_id = auth.uid())
    )
  );

-- ── Updated diff_history RLS ───────────────────────────────
DROP POLICY IF EXISTS "access_diff_history" ON diff_history;

CREATE POLICY "access_diff_history" ON diff_history
  FOR ALL USING (
    catalog_id IN (
      SELECT id FROM capability_catalogs
      WHERE user_id = auth.uid()
      OR client_id IN (
        SELECT client_id FROM client_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- DATA MIGRATION: Link existing catalogs to client folders
-- ══════════════════════════════════════════════════════════════

-- Auto-create client folders from existing catalog client_name values
INSERT INTO clients (name, industry, created_by)
SELECT DISTINCT client_name, industry, user_id
FROM capability_catalogs
WHERE client_name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Link catalogs to their client folders
UPDATE capability_catalogs
SET client_id = (
  SELECT id FROM clients WHERE name = capability_catalogs.client_name LIMIT 1
)
WHERE client_name IS NOT NULL AND client_id IS NULL;

-- Add catalog owners as client admins
INSERT INTO client_members (client_id, user_id, role, invited_by)
SELECT DISTINCT c.client_id, c.user_id, 'admin', c.user_id
FROM capability_catalogs c
WHERE c.client_id IS NOT NULL AND c.user_id IS NOT NULL
ON CONFLICT (client_id, user_id) DO NOTHING;
