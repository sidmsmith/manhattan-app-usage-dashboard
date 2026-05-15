-- Normalize historical Import Forecast rows: canonical app_name is forecast-import
-- (API previously sent display string "Import Forecast" in column and JSON).
--
-- Run in Neon SQL Editor against the database used by usage-ingest.
--
-- Preview:
--   SELECT id, app_name, event_name, event_data->>'app_name' AS json_app_name, created_at
--   FROM app_usage_events
--   WHERE app_name = 'Import Forecast'
--      OR (event_data->>'app_name') = 'Import Forecast'
--   ORDER BY created_at DESC
--   LIMIT 50;

BEGIN;

UPDATE app_usage_events AS e
SET
  app_name = 'forecast-import',
  event_data = e.event_data || jsonb_build_object(
    'app_name', 'forecast-import',
    'legacy_app_name_label',
      COALESCE(
        NULLIF(e.event_data->>'legacy_app_name_label', ''),
        NULLIF(e.event_data->>'page_title', ''),
        CASE
          WHEN e.app_name IS NOT NULL AND e.app_name <> 'forecast-import' THEN e.app_name
          WHEN (e.event_data->>'app_name') IS NOT NULL
               AND (e.event_data->>'app_name') <> 'forecast-import'
            THEN e.event_data->>'app_name'
          ELSE NULL
        END
      )
  )
WHERE e.app_name = 'Import Forecast'
   OR (e.event_data->>'app_name') = 'Import Forecast';

COMMIT;
