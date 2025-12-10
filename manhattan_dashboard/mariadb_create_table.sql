-- MariaDB Table Creation Script for Manhattan App Usage Dashboard
-- This script creates the table structure only
-- Note: Database and users are already created by the MariaDB add-on
-- 
-- Run this from HA Advanced Terminal:
-- mariadb -h localhost -u root -p manhattan_app_usage < mariadb_create_table.sql

USE manhattan_app_usage;

-- Create the app_usage_events table
CREATE TABLE IF NOT EXISTS app_usage_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NULL,  -- Original HA event_id (for reference, may be NULL)
    event_name VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    org VARCHAR(255) NULL,
    timestamp DATETIME NOT NULL,
    event_data JSON NOT NULL,  -- Full JSON payload
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    INDEX idx_app_name (app_name),
    INDEX idx_timestamp (timestamp),
    INDEX idx_event_name (event_name),
    INDEX idx_org (org),
    INDEX idx_app_timestamp (app_name, timestamp),
    
    -- Composite index for dashboard queries
    INDEX idx_app_time_range (app_name, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a view for recent events (last 15 per app)
CREATE OR REPLACE VIEW recent_events_by_app AS
SELECT 
    app_name,
    event_name,
    org,
    timestamp,
    event_data,
    created_at
FROM app_usage_events
WHERE (app_name, timestamp) IN (
    SELECT app_name, timestamp
    FROM (
        SELECT app_name, timestamp
        FROM app_usage_events
        ORDER BY timestamp DESC
        LIMIT 1000
    ) AS sub
    GROUP BY app_name
    ORDER BY timestamp DESC
    LIMIT 15
)
ORDER BY timestamp DESC;

-- Create a view for aggregate statistics
CREATE OR REPLACE VIEW app_statistics AS
SELECT 
    app_name,
    COUNT(*) AS total_events,
    COUNT(CASE WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) AS events_last_24h,
    COUNT(CASE WHEN JSON_EXTRACT(event_data, '$.event_name') = 'app_opened' THEN 1 END) AS total_opens
FROM app_usage_events
GROUP BY app_name;

-- Verify setup
SELECT 'Table setup complete!' AS status;
SELECT COUNT(*) AS table_count FROM information_schema.tables 
    WHERE table_schema = 'manhattan_app_usage';
DESCRIBE app_usage_events;

