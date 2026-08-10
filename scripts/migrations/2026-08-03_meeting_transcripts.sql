-- =============================================================================
-- Migration: Meeting Transcript → Diagram feature
-- Date:      2026-08-03
-- Author:    Copilot planning
--
-- SAFE TO RUN. Purely ADDITIVE:
--   • Creates 2 new tables:  meeting_transcripts, transcript_proposals
--   • Creates supporting indexes
--   • Does NOT alter any existing tables (capability_catalogs, capabilities,
--     visual_maps, clients, auth.users)
--
-- Rollback:
--   DROP TABLE IF EXISTS public.transcript_proposals CASCADE;
--   DROP TABLE IF EXISTS public.meeting_transcripts CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. meeting_transcripts
--    One row per uploaded transcript. Stores raw + cleaned text, meeting
--    metadata, pipeline status/progress, and (once processed) the AI summary.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_transcripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- catalog_id is NULL when mode='new_diagram' AND the transcript hasn't been
  -- applied yet. Once applied, we backfill it with the newly-created catalog id.
  catalog_id    uuid REFERENCES public.capability_catalogs(id) ON DELETE SET NULL,

  mode          text NOT NULL CHECK (mode IN ('new_diagram', 'edit_diagram')),

  -- Meeting metadata
  title         text,
  meeting_date  date,

  -- Content
  raw_text      text NOT NULL,
  cleaned_text  text,
  summary       text,             -- AI-generated meeting summary (Pass 3 output)

  -- Pipeline state machine:
  -- uploaded → parsing → cleaning → filtering → extracting → resolving →
  -- ready_for_review → applying → completed | failed
  status        text NOT NULL DEFAULT 'uploaded',
  progress      int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step  text,
  error_message text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_transcripts_user_created
  ON public.meeting_transcripts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcripts_catalog
  ON public.meeting_transcripts (catalog_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_status
  ON public.meeting_transcripts (status);


-- -----------------------------------------------------------------------------
-- 2. transcript_proposals
--    One row per AI-proposed change. `kind` discriminates the payload shape:
--
--    kind='node'    → payload = { tempId, parentTempId, level, name, description }
--                      Used for mode='new_diagram' — one row per proposed node.
--
--    kind='command' → payload = DiagramCommand JSON (see src/lib/commands/index.ts)
--                      Used for mode='edit_diagram' — one row per proposed
--                      mutation to the existing tree.
--
--    kind='todo'    → payload = { text, targetNodeId?, priority, owner?, sourceQuote }
--                      Used in either mode — one row per action item extracted
--                      from the transcript.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcript_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id  uuid NOT NULL REFERENCES public.meeting_transcripts(id) ON DELETE CASCADE,

  kind           text NOT NULL CHECK (kind IN ('node', 'command', 'todo')),
  payload        jsonb NOT NULL,

  -- 0.00–1.00 confidence from the AI. UI pre-selects rows with confidence >= 0.7.
  confidence     numeric(3,2) NOT NULL DEFAULT 0.50
                 CHECK (confidence >= 0 AND confidence <= 1),

  -- Verbatim quote from the transcript that supports this proposal.
  -- Used in review UI so the user can verify the AI's reasoning.
  source_quote   text,

  -- User's checkbox state in the review modal.
  selected       boolean NOT NULL DEFAULT true,

  -- Lifecycle: pending → accepted | declined  → (on apply) applied | failed
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined', 'applied', 'failed')),

  -- If application fails at apply-time, record why (for retry / debugging).
  apply_error    text,

  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_transcript
  ON public.transcript_proposals (transcript_id);

CREATE INDEX IF NOT EXISTS idx_proposals_transcript_kind
  ON public.transcript_proposals (transcript_id, kind);

CREATE INDEX IF NOT EXISTS idx_proposals_selected
  ON public.transcript_proposals (transcript_id, selected)
  WHERE selected = true;


-- -----------------------------------------------------------------------------
-- 3. (Optional) Row Level Security
--    Uncomment if the rest of your tables use RLS. Otherwise leave commented —
--    the app already enforces user ownership via getSupabaseAdmin() + explicit
--    user_id checks in the route handlers.
-- -----------------------------------------------------------------------------
-- ALTER TABLE public.meeting_transcripts   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.transcript_proposals  ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "transcripts_owner_all" ON public.meeting_transcripts
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "proposals_owner_all" ON public.transcript_proposals
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM public.meeting_transcripts t
--       WHERE t.id = transcript_id AND t.user_id = auth.uid()
--     )
--   );
