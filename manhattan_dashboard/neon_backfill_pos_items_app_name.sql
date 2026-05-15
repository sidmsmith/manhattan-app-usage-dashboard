-- Normalize historical POS Items rows: canonical app_name is pos-items-app
-- (dashboard previously queried "POS Items"; some payloads also sent display label in JSON).
--
-- Run in Neon SQL Editor against the database used by usage-ingest (table app_usage_events).
--
-- Preview (run first; adjust predicates if needed):
--   SELECT id, app_name, event_name, event_data->>'app_name' AS json_app_name, created_at
--   FROM app_usage_events
--   WHERE app_name IN ('POS Items', 'pos_items', 'POS-Items')
--      OR (event_data->>'app_name') IN ('POS Items', 'pos_items', 'POS-Items')
--   ORDER BY created_at DESC
--   LIMIT 50;

BEGIN;

UPDATE app_usage_events AS e
SET
  app_name = 'pos-items-app',
  event_data = e.event_data || jsonb_build_object(
    'app_name', 'pos-items-app',
    'legacy_app_name_label',
      COALESCE(
        NULLIF(e.event_data->>'legacy_app_name_label', ''),
        NULLIF(e.event_data->>'page_title', ''),
        CASE
          WHEN e.app_name IS NOT NULL AND e.app_name <> 'pos-items-app' THEN e.app_name
          WHEN (e.event_data->>'app_name') IS NOT NULL
               AND (e.event_data->>'app_name') <> 'pos-items-app'
            THEN e.event_data->>'app_name'
          ELSE NULL
        END
      )
  )
WHERE e.app_name IN ('POS Items', 'pos_items', 'POS-Items')
   OR (e.event_data->>'app_name') IN ('POS Items', 'pos_items', 'POS-Items');

COMMIT;
