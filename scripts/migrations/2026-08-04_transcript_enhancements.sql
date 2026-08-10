-- =============================================================================
-- Migration: Transcript feature enhancements
-- Date:      2026-08-04
--
-- Adds:
--   1. context_prompt column to meeting_transcripts (user-provided specifications)
--   2. template_id column to meeting_transcripts (template selected for new_diagram)
--   3. notes column to capability_catalogs (freeform per-diagram notes)
--
-- SAFE TO RUN. Purely additive ALTER TABLE statements.
--
-- Rollback:
--   ALTER TABLE public.meeting_transcripts DROP COLUMN IF EXISTS context_prompt;
--   ALTER TABLE public.meeting_transcripts DROP COLUMN IF EXISTS template_id;
--   ALTER TABLE public.capability_catalogs DROP COLUMN IF EXISTS notes;
-- =============================================================================

-- 1. Context prompt — user-provided specifications alongside transcript
ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS context_prompt text;

-- 2. Template ID — when user picks a template to edit via transcript
--    References the catalog that serves as the template source.
ALTER TABLE public.meeting_transcripts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.capability_catalogs(id) ON DELETE SET NULL;

-- 3. Catalog-level notes — freeform text per diagram, editable by users
ALTER TABLE public.capability_catalogs
  ADD COLUMN IF NOT EXISTS notes text;
