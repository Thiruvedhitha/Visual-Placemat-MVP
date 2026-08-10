-- =============================================================================
-- Migration: Capability-owned style category assignments
-- Date:      2026-08-05
--
-- Adds:
--   1. capability_style_categories for catalog-scoped legend definitions
--   2. nullable category references on capabilities
--
-- SAFE TO RUN. This migration is additive and does not modify node_styles or
-- chat_history. Existing diagrams continue using the legacy style path until
-- the application enables dual-read and dual-write behavior.
--
-- Rollback:
--   ALTER TABLE public.capabilities DROP COLUMN IF EXISTS text_category_id;
--   ALTER TABLE public.capabilities DROP COLUMN IF EXISTS border_category_id;
--   ALTER TABLE public.capabilities DROP COLUMN IF EXISTS fill_category_id;
--   DROP TABLE IF EXISTS public.capability_style_categories;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.capability_style_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  uuid NOT NULL REFERENCES public.capability_catalogs(id) ON DELETE CASCADE,
  slot        text NOT NULL CHECK (slot IN ('fill', 'border', 'textColor')),
  entry_key   text NOT NULL,
  label       text NOT NULL,
  color       text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  source      text NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual', 'ai', 'transcript', 'migration')),
  source_id   uuid,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, slot, entry_key),
  UNIQUE (catalog_id, id)
);

CREATE INDEX IF NOT EXISTS idx_style_categories_catalog_slot
  ON public.capability_style_categories (catalog_id, slot);

ALTER TABLE public.capabilities
  ADD COLUMN IF NOT EXISTS fill_category_id uuid,
  ADD COLUMN IF NOT EXISTS border_category_id uuid,
  ADD COLUMN IF NOT EXISTS text_category_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'capabilities_fill_category_fkey'
      AND conrelid = 'public.capabilities'::regclass
  ) THEN
    ALTER TABLE public.capabilities
      ADD CONSTRAINT capabilities_fill_category_fkey
      FOREIGN KEY (catalog_id, fill_category_id)
      REFERENCES public.capability_style_categories(catalog_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'capabilities_border_category_fkey'
      AND conrelid = 'public.capabilities'::regclass
  ) THEN
    ALTER TABLE public.capabilities
      ADD CONSTRAINT capabilities_border_category_fkey
      FOREIGN KEY (catalog_id, border_category_id)
      REFERENCES public.capability_style_categories(catalog_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'capabilities_text_category_fkey'
      AND conrelid = 'public.capabilities'::regclass
  ) THEN
    ALTER TABLE public.capabilities
      ADD CONSTRAINT capabilities_text_category_fkey
      FOREIGN KEY (catalog_id, text_category_id)
      REFERENCES public.capability_style_categories(catalog_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_capabilities_fill_category
  ON public.capabilities (fill_category_id)
  WHERE fill_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capabilities_border_category
  ON public.capabilities (border_category_id)
  WHERE border_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capabilities_text_category
  ON public.capabilities (text_category_id)
  WHERE text_category_id IS NOT NULL;