-- Fix timestamps in Neon database by extracting from event_data JSON
-- This updates events that have the incorrect epoch timestamp (1969-12-31)
-- to use the correct timestamp from the event_data JSON field

-- First, let's see how many records need fixing
SELECT 
    COUNT(*) as records_to_fix,
    MIN(timestamp) as min_timestamp,
    MAX(timestamp) as max_timestamp
FROM app_usage_events
WHERE timestamp < '1970-01-01'::timestamp;

-- Preview what the fix will do (run this first to verify)
SELECT 
    id,
    app_name,
    event_name,
    timestamp as current_timestamp,
    event_data->>'timestamp' as json_timestamp,
    CASE 
        WHEN event_data->>'timestamp' IS NOT NULL THEN
            -- Try to parse the timestamp from JSON
            -- Handles formats like: "2025-12-11T20:59:05.000Z" or "2025-12-11T20:59:05Z"
            CAST(
                REPLACE(
                    REPLACE(event_data->>'timestamp', 'Z', ''),
                    'T', ' '
                ) AS TIMESTAMP
            )
        ELSE NULL
    END as new_timestamp
FROM app_usage_events
WHERE timestamp < '1970-01-01'::timestamp
LIMIT 10;

-- ACTUAL UPDATE QUERY (run this after verifying the preview above)
-- This updates the timestamp column using the timestamp from event_data JSON
UPDATE app_usage_events
SET timestamp = CAST(
    REPLACE(
        REPLACE(event_data->>'timestamp', 'Z', ''),
        'T', ' '
    ) AS TIMESTAMP
)
WHERE 
    timestamp < '1970-01-01'::timestamp
    AND event_data->>'timestamp' IS NOT NULL
    AND event_data->>'timestamp' != '';

-- Verify the fix worked
SELECT 
    COUNT(*) as remaining_bad_timestamps
FROM app_usage_events
WHERE timestamp < '1970-01-01'::timestamp;

-- Show some fixed records
SELECT 
    id,
    app_name,
    event_name,
    timestamp,
    event_data->>'timestamp' as original_json_timestamp
FROM app_usage_events
WHERE timestamp >= '1970-01-01'::timestamp
ORDER BY timestamp DESC
LIMIT 10;
