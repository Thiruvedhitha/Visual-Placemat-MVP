-- =============================================================================
-- Migration: Archive support + user profiles + audit log
-- Date:      2026-08-06
-- Run after migration_clients.sql
-- =============================================================================

-- ── 1. Archive columns on capability_catalogs ─────────────────────────────────
ALTER TABLE capability_catalogs
  ADD COLUMN IF NOT EXISTS archived_at   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- ── 2. Archive/status columns on clients ─────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 3. user_profiles table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  platform_role text NOT NULL DEFAULT 'user'
                CHECK (platform_role IN ('user', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email         ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform_role ON user_profiles(platform_role)
  WHERE platform_role = 'admin';

-- Sync trigger: keep profile in step with auth.users
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, '')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email        = EXCLUDED.email,
        display_name = CASE
          WHEN public.user_profiles.display_name = '' THEN EXCLUDED.display_name
          ELSE public.user_profiles.display_name
        END,
        updated_at   = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_profile();

-- Backfill existing users
INSERT INTO user_profiles (user_id, email, display_name)
SELECT
  id,
  COALESCE(email, ''),
  COALESCE(raw_user_meta_data->>'full_name', email, '')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ── 4. access_audit_log table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  target_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id      uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  catalog_id     uuid        REFERENCES public.capability_catalogs(id) ON DELETE SET NULL,
  previous_value jsonb,
  new_value      jsonb,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON access_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON access_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_client  ON access_audit_log(client_id)  WHERE client_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_catalog ON access_audit_log(catalog_id) WHERE catalog_id IS NOT NULL;

ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;
-- Only service role (backend) can read/write audit logs
CREATE POLICY "audit_no_direct_access" ON access_audit_log FOR ALL USING (false);

-- =============================================================================
-- Rollback (copy-paste to revert):
--   DROP TABLE IF EXISTS access_audit_log;
--   DROP TABLE IF EXISTS user_profiles;
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--   DROP FUNCTION IF EXISTS sync_user_profile();
--   ALTER TABLE clients DROP COLUMN IF EXISTS archived_by, DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS status;
--   ALTER TABLE capability_catalogs DROP COLUMN IF EXISTS archive_reason, DROP COLUMN IF EXISTS archived_by, DROP COLUMN IF EXISTS archived_at;
-- =============================================================================
