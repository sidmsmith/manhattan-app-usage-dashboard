-- Backfill app_clicked rows from Apps Homepage so app_name is the emitter (apps-homepage),
-- not the tile label. Moves the previous JSON app_name into clicked_app_name when missing.
--
-- Target: Neon database used by apps_dashboard usage-ingest (table app_usage_events).
-- Scope: event_name = app_clicked, page_url contains "appshomepage" (production portal),
--   and column app_name is not already apps-homepage.
--
-- Optional: add OR predicates on event_data->>'page_url' for staging/local hosts before running.

BEGIN;

UPDATE app_usage_events AS e
SET
  app_name = 'apps-homepage',
  event_data = e.event_data
    || jsonb_build_object(
      'app_name', 'apps-homepage',
      'clicked_app_name',
        COALESCE(
          NULLIF(e.event_data->>'clicked_app_name', ''),
          NULLIF(e.event_data->>'app_name', '')
        )
      )
WHERE e.event_name = 'app_clicked'
  AND e.app_name IS DISTINCT FROM 'apps-homepage'
  AND COALESCE(e.event_data->>'page_url', '') ILIKE '%appshomepage%';

COMMIT;
