-- =============================================================================
-- Migration: Backfill capability style categories from legacy node_styles
-- Date:      2026-08-06
-- Batch ID:  20260806-0000-4000-8000-000000000001
--
-- Migrates only active capability rows with valid hex colors.
-- Preserves capability_catalogs.node_styles and chat_history in full.
-- Skips stale node-style keys, "default" sentinels, invalid colors, ambiguous
-- legend matches, and capabilities that already have a category assignment.
--
-- Run 2026-08-06_style_categories_backfill_dry_run.sql first. The migration
-- aborts if one color maps to multiple legend entries in the same slot.
--
-- Rollback for this batch:
--   BEGIN;
--   UPDATE public.capabilities AS capability
--   SET fill_category_id = NULL
--   FROM public.capability_style_categories AS category
--   WHERE capability.fill_category_id = category.id
--     AND category.source_id = '20260806-0000-4000-8000-000000000001'::uuid;
--   UPDATE public.capabilities AS capability
--   SET border_category_id = NULL
--   FROM public.capability_style_categories AS category
--   WHERE capability.border_category_id = category.id
--     AND category.source_id = '20260806-0000-4000-8000-000000000001'::uuid;
--   UPDATE public.capabilities AS capability
--   SET text_category_id = NULL
--   FROM public.capability_style_categories AS category
--   WHERE capability.text_category_id = category.id
--     AND category.source_id = '20260806-0000-4000-8000-000000000001'::uuid;
--   DELETE FROM public.capability_style_categories
--   WHERE source_id = '20260806-0000-4000-8000-000000000001'::uuid;
--   COMMIT;
-- =============================================================================

BEGIN;

CREATE TEMP TABLE backfill_legacy_styles ON COMMIT DROP AS
WITH slots(slot) AS (
  VALUES ('fill'::text), ('border'::text), ('textColor'::text)
)
SELECT
  catalog.id AS catalog_id,
  capability.id AS capability_id,
  slots.slot,
  style_entry.value ->> slots.slot AS color
FROM public.capability_catalogs AS catalog
CROSS JOIN LATERAL jsonb_each(COALESCE(catalog.node_styles, '{}'::jsonb)) AS style_entry
CROSS JOIN slots
JOIN public.capabilities AS capability
  ON capability.catalog_id = catalog.id
 AND capability.id::text = style_entry.key
WHERE jsonb_typeof(style_entry.value) = 'object'
  AND jsonb_typeof(style_entry.value -> slots.slot) = 'string'
  AND (style_entry.value ->> slots.slot) ~* '^#[0-9a-f]{6}([0-9a-f]{2})?$';

CREATE TEMP TABLE backfill_valid_legend ON COMMIT DROP AS
WITH slots(slot) AS (
  VALUES ('fill'::text), ('border'::text), ('textColor'::text)
)
SELECT
  catalog.id AS catalog_id,
  slots.slot,
  entry ->> 'id' AS entry_key,
  entry ->> 'label' AS label,
  lower(entry ->> 'color') AS color
FROM public.capability_catalogs AS catalog
CROSS JOIN slots
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(catalog.chat_history #> ARRAY['legend', slots.slot]::text[]) = 'array'
      THEN catalog.chat_history #> ARRAY['legend', slots.slot]::text[]
    ELSE '[]'::jsonb
  END
) AS entry
WHERE NULLIF(entry ->> 'id', '') IS NOT NULL
  AND NULLIF(entry ->> 'label', '') IS NOT NULL
  AND (entry ->> 'color') ~* '^#[0-9a-f]{6}([0-9a-f]{2})?$';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM backfill_legacy_styles AS styles
    JOIN backfill_valid_legend AS legend
      ON legend.catalog_id = styles.catalog_id
     AND legend.slot = styles.slot
     AND legend.color = lower(styles.color)
    GROUP BY styles.catalog_id, styles.capability_id, styles.slot
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Backfill stopped: an active style color matches multiple legend entries';
  END IF;
END $$;

INSERT INTO public.capability_style_categories (
  catalog_id,
  slot,
  entry_key,
  label,
  color,
  source,
  source_id
)
SELECT DISTINCT
  legend.catalog_id,
  legend.slot,
  legend.entry_key,
  legend.label,
  legend.color,
  'migration',
  '20260806-0000-4000-8000-000000000001'::uuid
FROM backfill_valid_legend AS legend
ON CONFLICT (catalog_id, slot, entry_key) DO NOTHING;

INSERT INTO public.capability_style_categories (
  catalog_id,
  slot,
  entry_key,
  label,
  color,
  source,
  source_id
)
SELECT DISTINCT
  styles.catalog_id,
  styles.slot,
  'legacy-color-' || replace(lower(styles.color), '#', ''),
  CASE styles.slot
    WHEN 'fill' THEN 'Legacy fill ' || upper(styles.color)
    WHEN 'border' THEN 'Legacy border ' || upper(styles.color)
    ELSE 'Legacy text ' || upper(styles.color)
  END,
  lower(styles.color),
  'migration',
  '20260806-0000-4000-8000-000000000001'::uuid
FROM backfill_legacy_styles AS styles
LEFT JOIN backfill_valid_legend AS legend
  ON legend.catalog_id = styles.catalog_id
 AND legend.slot = styles.slot
 AND legend.color = lower(styles.color)
WHERE legend.entry_key IS NULL
ON CONFLICT (catalog_id, slot, entry_key) DO NOTHING;

CREATE TEMP TABLE backfill_assignments ON COMMIT DROP AS
SELECT
  styles.capability_id,
  styles.slot,
  category.id AS category_id
FROM backfill_legacy_styles AS styles
LEFT JOIN backfill_valid_legend AS legend
  ON legend.catalog_id = styles.catalog_id
 AND legend.slot = styles.slot
 AND legend.color = lower(styles.color)
JOIN public.capability_style_categories AS category
  ON category.catalog_id = styles.catalog_id
 AND category.slot = styles.slot
 AND category.entry_key = COALESCE(
   legend.entry_key,
   'legacy-color-' || replace(lower(styles.color), '#', '')
 )
 AND lower(category.color) = lower(styles.color);

UPDATE public.capabilities AS capability
SET fill_category_id = assignment.category_id
FROM backfill_assignments AS assignment
WHERE assignment.capability_id = capability.id
  AND assignment.slot = 'fill'
  AND capability.fill_category_id IS NULL;

UPDATE public.capabilities AS capability
SET border_category_id = assignment.category_id
FROM backfill_assignments AS assignment
WHERE assignment.capability_id = capability.id
  AND assignment.slot = 'border'
  AND capability.border_category_id IS NULL;

UPDATE public.capabilities AS capability
SET text_category_id = assignment.category_id
FROM backfill_assignments AS assignment
WHERE assignment.capability_id = capability.id
  AND assignment.slot = 'textColor'
  AND capability.text_category_id IS NULL;

COMMIT;

SELECT
  count(*) FILTER (WHERE source_id = '20260806-0000-4000-8000-000000000001'::uuid)
    AS categories_created_by_backfill,
  (SELECT count(*) FROM public.capabilities WHERE fill_category_id IS NOT NULL)
    AS fill_assignments,
  (SELECT count(*) FROM public.capabilities WHERE border_category_id IS NOT NULL)
    AS border_assignments,
  (SELECT count(*) FROM public.capabilities WHERE text_category_id IS NOT NULL)
    AS text_assignments
FROM public.capability_style_categories;