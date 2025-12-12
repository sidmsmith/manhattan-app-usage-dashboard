-- Neon PostgreSQL Schema Update Script
-- This script adds missing columns, indexes, and views to the Neon database
-- Run this in Neon SQL Editor or via psql/neonctl

-- Step 1: Add missing columns (if they don't exist)
DO $$ 
BEGIN
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_usage_events' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE app_usage_events 
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_usage_events' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE app_usage_events 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_app_name ON app_usage_events(app_name);
CREATE INDEX IF NOT EXISTS idx_timestamp ON app_usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_name ON app_usage_events(event_name);
CREATE INDEX IF NOT EXISTS idx_org ON app_usage_events(org);
CREATE INDEX IF NOT EXISTS idx_app_timestamp ON app_usage_events(app_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_time_range ON app_usage_events(app_name, timestamp DESC);

-- Step 3: Create GIN index for JSONB queries (efficient JSON searches)
CREATE INDEX IF NOT EXISTS idx_event_data_gin ON app_usage_events USING GIN (event_data);

-- Step 4: Create views for common queries

-- View: Recent events by app (simplified for PostgreSQL)
CREATE OR REPLACE VIEW recent_events_by_app AS
SELECT 
    app_name,
    event_name,
    org,
    timestamp,
    event_data,
    created_at,
    id
FROM app_usage_events
ORDER BY app_name, timestamp DESC;

-- View: App statistics (aggregate metrics)
CREATE OR REPLACE VIEW app_statistics AS
SELECT 
    app_name,
    COUNT(*) AS total_events,
    COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) AS events_last_24h,
    COUNT(CASE WHEN event_name = 'app_opened' THEN 1 END) AS total_opens
FROM app_usage_events
GROUP BY app_name;

-- View: All apps aggregate statistics
CREATE OR REPLACE VIEW all_apps_statistics AS
SELECT 
    'all_apps' AS app_name,
    COUNT(*) AS total_events,
    COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) AS events_last_24h,
    COUNT(CASE WHEN event_name = 'app_opened' THEN 1 END) AS total_opens
FROM app_usage_events;

-- Step 5: Verify setup
SELECT 'Schema update complete!' AS status;
SELECT COUNT(*) AS index_count 
FROM pg_indexes 
WHERE tablename = 'app_usage_events';

SELECT COUNT(*) AS view_count 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE '%statistics%' OR table_name LIKE '%events%';

-- Show table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'app_usage_events'
ORDER BY ordinal_position;

