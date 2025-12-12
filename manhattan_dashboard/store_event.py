# Manhattan App Usage Dashboard - Store Event Script
# Processes webhook events and stores them in both HA events and MariaDB
# 
# NOTE: HA Python scripts have strict import restrictions
# Cannot use: json, subprocess, datetime, sqlite3, os, etc.
# Workaround: Use shell_command via hass.services.call

# Get event data from automation
event = data.get("event", {})

# EXISTING: Fire HA event (keeps current functionality working)
# This stores the event in SQLite for backward compatibility
hass.bus.fire("app_usage_event", event)

# NEW: Also write to MariaDB (parallel storage for experimental approach)
# This is wrapped in try/except so failures don't break existing functionality
try:
    # Extract event data (no imports needed - event is already a dict)
    event_name = str(event.get("event_name", "")).replace("'", "''")
    app_name = str(event.get("app_name", "")).replace("'", "''")
    org = event.get("org")
    org_str = ("'" + str(org).replace("'", "''") + "'") if org else "NULL"
    
    # Get timestamp - handle various formats without datetime import
    timestamp_str = event.get("timestamp", "")
    if not timestamp_str:
        # Use current time if not provided (format: YYYY-MM-DD HH:MM:SS)
        # Get current time from HA
        now = hass.states.get("sensor.date_time")
        if now and now.state:
            timestamp_formatted = now.state.replace("T", " ").split(".")[0]
        else:
            timestamp_formatted = "NOW()"
    else:
        # Parse timestamp string manually (handle ISO format)
        # Remove 'Z' and microseconds if present
        ts_clean = timestamp_str.replace("Z", "").split(".")[0]
        # Convert from ISO format (2024-01-01T00:00:00) to SQL format (2024-01-01 00:00:00)
        timestamp_formatted = ts_clean.replace("T", " ")
    
    # Build JSON string manually (without json.dumps)
    # Simple JSON stringification for the event data
    event_data_parts = []
    for key, value in event.items():
        key_str = str(key).replace('"', '\\"')
        if isinstance(value, str):
            value_str = '"' + str(value).replace('"', '\\"') + '"'
        elif isinstance(value, (int, float)):
            value_str = str(value)
        elif isinstance(value, bool):
            value_str = "true" if value else "false"
        elif value is None:
            value_str = "null"
        else:
            value_str = '"' + str(value).replace('"', '\\"') + '"'
        event_data_parts.append('"' + key_str + '":' + value_str)
    
    event_data_json = "{" + ",".join(event_data_parts) + "}"
    # Escape single quotes for SQL
    event_data_json = event_data_json.replace("'", "''")
    
    # Build SQL INSERT statement
    sql = "INSERT INTO app_usage_events (event_name, app_name, org, timestamp, event_data) VALUES ('" + event_name + "', '" + app_name + "', " + org_str + ", '" + timestamp_formatted + "', '" + event_data_json + "');"
    
    # Call shell_command to execute mariadb CLI
    # The shell_command will be defined in configuration.yaml
    hass.services.call(
        "shell_command",
        "mariadb_insert_event",
        {
            "sql": sql
        }
    )
    
    logger.info("MariaDB write command triggered for event: " + event_name + " from " + app_name)
        
except Exception as e:
    # Log error but don't fail - existing HA event storage must continue working
    logger.warning("MariaDB write error (non-critical, HA event still stored): " + str(e))


