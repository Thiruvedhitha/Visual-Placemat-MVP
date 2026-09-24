-- =============================================================================
-- Migration: Diagram tags
-- Date:      2026-09-22
--
-- Adds:
--   1. tags column to capability_catalogs (e.g. "Capability", "Process" —
--      a single diagram can carry several tags at once)
--
-- SAFE TO RUN. Purely additive ALTER TABLE statement.
--
-- Rollback:
--   ALTER TABLE public.capability_catalogs DROP COLUMN IF EXISTS tags;
-- =============================================================================

ALTER TABLE public.capability_catalogs
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
