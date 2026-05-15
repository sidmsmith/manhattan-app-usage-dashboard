-- Normalize historical Item Generator rows: canonical app_name is item-generator-gallery
-- (older clients sent display title "Item Generator" in JSON, which overwrote app_name).
--
-- Run in Neon SQL Editor against the database used by usage-ingest.

BEGIN;

UPDATE app_usage_events AS e
SET
  app_name = 'item-generator-gallery',
  event_data = e.event_data || jsonb_build_object(
    'app_name', 'item-generator-gallery',
    'legacy_app_name_label',
      COALESCE(
        NULLIF(e.event_data->>'legacy_app_name_label', ''),
        NULLIF(e.event_data->>'page_title', ''),
        CASE
          WHEN e.app_name IS NOT NULL AND e.app_name <> 'item-generator-gallery' THEN e.app_name
          ELSE NULL
        END
      )
  )
WHERE e.app_name = 'Item Generator'
   OR (e.event_data->>'app_name') = 'Item Generator';

COMMIT;
