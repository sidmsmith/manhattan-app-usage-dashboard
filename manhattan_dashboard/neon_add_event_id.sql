-- Add event_id column to Neon app_usage_events table
-- This column stores the original HA event_id for reference and duplicate detection

-- Add event_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_usage_events' AND column_name = 'event_id'
    ) THEN
        ALTER TABLE app_usage_events 
        ADD COLUMN event_id INTEGER NULL;
        
        -- Create index for faster duplicate checks
        CREATE INDEX IF NOT EXISTS idx_event_id ON app_usage_events(event_id);
        
        RAISE NOTICE 'event_id column added successfully';
    ELSE
        RAISE NOTICE 'event_id column already exists';
    END IF;
END $$;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_usage_events' AND column_name = 'event_id';
