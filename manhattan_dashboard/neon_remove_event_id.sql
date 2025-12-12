-- Remove event_id column from Neon app_usage_events table
-- This column is no longer needed - we use 'id' (primary key) instead

-- Drop the index first (if it exists)
DROP INDEX IF EXISTS idx_event_id;

-- Remove the event_id column
ALTER TABLE app_usage_events DROP COLUMN IF EXISTS event_id;

-- Verify removal
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_usage_events' 
ORDER BY ordinal_position;
