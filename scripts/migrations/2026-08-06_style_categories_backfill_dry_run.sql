-- =============================================================================
-- Dry run: legacy node_styles -> capability style categories
-- Date:    2026-08-06
--
-- READ ONLY. This script reports what the backfill migration will process.
-- It does not insert categories, update capabilities, or remove legacy data.
-- =============================================================================

BEGIN TRANSACTION READ ONLY;

WITH
slots(slot) AS (
  VALUES ('fill'::text), ('border'::text), ('textColor'::text)
),
legacy_styles AS (
  SELECT
    catalog.id AS catalog_id,
    style_entry.key AS capability_id,
    slots.slot,
    style_entry.value ->> slots.slot AS color
  FROM public.capability_catalogs AS catalog
  CROSS JOIN LATERAL jsonb_each(COALESCE(catalog.node_styles, '{}'::jsonb)) AS style_entry
  CROSS JOIN slots
  WHERE jsonb_typeof(style_entry.value) = 'object'
    AND jsonb_typeof(style_entry.value -> slots.slot) = 'string'
),
active_styles AS (
  SELECT styles.*
  FROM legacy_styles AS styles
  JOIN public.capabilities AS capability
    ON capability.catalog_id = styles.catalog_id
   AND capability.id::text = styles.capability_id
),
valid_legend AS (
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
    AND (entry ->> 'color') ~* '^#[0-9a-f]{6}([0-9a-f]{2})?$'
),
valid_active_styles AS (
  SELECT *
  FROM active_styles
  WHERE color ~* '^#[0-9a-f]{6}([0-9a-f]{2})?$'
),
style_match_counts AS (
  SELECT
    styles.catalog_id,
    styles.capability_id,
    styles.slot,
    styles.color,
    count(legend.entry_key) AS legend_matches
  FROM valid_active_styles AS styles
  LEFT JOIN valid_legend AS legend
    ON legend.catalog_id = styles.catalog_id
   AND legend.slot = styles.slot
   AND legend.color = lower(styles.color)
  GROUP BY styles.catalog_id, styles.capability_id, styles.slot, styles.color
),
generated_categories AS (
  SELECT DISTINCT catalog_id, slot, lower(color) AS color
  FROM style_match_counts
  WHERE legend_matches = 0
),
stale_style_entries AS (
  SELECT DISTINCT styles.catalog_id, styles.capability_id
  FROM legacy_styles AS styles
  LEFT JOIN public.capabilities AS capability
    ON capability.catalog_id = styles.catalog_id
   AND capability.id::text = styles.capability_id
  WHERE capability.id IS NULL
)
SELECT
  (SELECT count(*) FROM public.capability_style_categories) AS existing_categories,
  (SELECT count(*) FROM valid_legend) AS valid_legacy_legend_categories,
  (SELECT count(*) FROM valid_active_styles) AS active_valid_assignments,
  (SELECT count(*) FROM active_styles WHERE color = 'default') AS active_default_assignments_skipped,
  (SELECT count(*) FROM active_styles
    WHERE color <> 'default'
      AND color !~* '^#[0-9a-f]{6}([0-9a-f]{2})?$') AS active_invalid_assignments_skipped,
  (SELECT count(*) FROM style_match_counts WHERE legend_matches = 1) AS assignments_matching_legend,
  (SELECT count(*) FROM style_match_counts WHERE legend_matches > 1) AS ambiguous_assignments_blocking_backfill,
  (SELECT count(*) FROM generated_categories) AS generated_categories_needed,
  (SELECT count(*) FROM stale_style_entries) AS stale_node_style_entries_skipped;

COMMIT;