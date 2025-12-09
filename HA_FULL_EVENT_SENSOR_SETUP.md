# Home Assistant Full Event Data Sensor Setup

This guide explains how to set up a custom sensor in Home Assistant that can query the full event data from the database by timestamp, including events older than 24 hours.

## Overview

The full webhook event data (including all fields like `user_agent`, `browser_name`, `lpn_list`, etc.) is stored in HA's database in the `event_data.shared_data` JSON field. This setup creates a Python script that queries that data and exposes it via a REST service.

## Step 1: Create Python Script

Create a file: `/config/python_scripts/get_full_event_data.py`

```python
"""Get full event data from HA database by timestamp."""
import json
import sqlite3
import os
from datetime import datetime

# Get database path (default HA SQLite location)
config_dir = os.path.dirname(os.path.dirname(__file__))
db_path = os.path.join(config_dir, 'home-assistant_v2.db')

# If using MariaDB/PostgreSQL, you'll need to modify the connection
# For now, assuming SQLite

def get_full_event_data(timestamp, event_name=None, app_name=None):
    """
    Query HA database for full event data by timestamp.
    
    Args:
        timestamp: ISO format timestamp (e.g., "2025-12-09T05:42:30.345311")
        event_name: Optional event name filter
        app_name: Optional app name filter
    
    Returns:
        Full event data as dict, or None if not found
    """
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Parse timestamp and create query window (±5 seconds)
        try:
            # Handle different timestamp formats
            if 'Z' in timestamp:
                event_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            else:
                event_time = datetime.fromisoformat(timestamp)
            
            # Convert to microseconds (HA stores timestamps in microseconds)
            event_timestamp_us = int(event_time.timestamp() * 1000000)
            start_time = event_timestamp_us - 5000000  # 5 seconds before
            end_time = event_timestamp_us + 5000000    # 5 seconds after
        except Exception as e:
            logger.error(f"Error parsing timestamp {timestamp}: {e}")
            conn.close()
            return None
        
        # Query events table joined with event_data
        query = """
            SELECT 
                e.event_id,
                e.time_fired_ts,
                et.event_type,
                ed.shared_data,
                ed.metadata
            FROM events e
            LEFT JOIN event_data ed ON e.data_id = ed.data_id
            LEFT JOIN event_types et ON e.event_type_id = et.event_type_id
            WHERE et.event_type = 'app_usage_event'
            AND e.time_fired_ts BETWEEN ? AND ?
            ORDER BY ABS(e.time_fired_ts - ?) ASC
            LIMIT 10
        """
        
        cursor.execute(query, [start_time, end_time, event_timestamp_us])
        rows = cursor.fetchall()
        
        # Find the best match
        for row in rows:
            if row['shared_data']:
                try:
                    # Parse the JSON data
                    event_data = json.loads(row['shared_data'])
                    
                    # Apply filters if provided
                    if event_name and event_data.get('event_name') != event_name:
                        continue
                    if app_name and event_data.get('app_name') != app_name:
                        continue
                    
                    # Found match! Return full data
                    result = {
                        'event_id': row['event_id'],
                        'time_fired_ts': row['time_fired_ts'],
                        'event_type': row['event_type'],
                        'data': event_data,
                        'metadata': json.loads(row['metadata']) if row['metadata'] else {}
                    }
                    conn.close()
                    return result
                except json.JSONDecodeError:
                    continue
        
        conn.close()
        return None
        
    except Exception as e:
        logger.error(f"Error querying event data: {e}")
        return None

# Main execution (called from HA service)
timestamp = data.get('timestamp')
event_name = data.get('event_name')
app_name = data.get('app_name')

if not timestamp:
    logger.error("Timestamp is required")
    hass.states.set('sensor.full_event_data_result', 'Error: Timestamp required', {
        'error': 'Timestamp is required'
    })
else:
    result = get_full_event_data(timestamp, event_name, app_name)
    
    if result:
        # Store result in a sensor
        hass.states.set('sensor.full_event_data_result', 'Found', {
            'timestamp': timestamp,
            'event_name': event_name,
            'app_name': app_name,
            'event_id': result.get('event_id'),
            'full_data': json.dumps(result.get('data', {}), indent=2),
            'raw_data': result.get('data', {})
        })
    else:
        hass.states.set('sensor.full_event_data_result', 'Not found', {
            'timestamp': timestamp,
            'event_name': event_name,
            'app_name': app_name,
            'error': 'Event not found in database'
        })
```

## Step 2: Add REST Command to configuration.yaml

Add this to your `configuration.yaml`:

```yaml
rest_command:
  get_full_event_data:
    url: "http://localhost:8123/api/services/python_script/get_full_event_data"
    method: POST
    headers:
      Authorization: "Bearer {{ states('input_text.ha_long_lived_token') }}"
      Content-Type: "application/json"
    payload: |
      {
        "timestamp": "{{ timestamp }}",
        "event_name": "{{ event_name }}",
        "app_name": "{{ app_name }}"
      }
```

**Note:** Replace `input_text.ha_long_lived_token` with your actual long-lived access token, or use a template that gets it from secrets.

## Step 3: Create Input Helper for Token (Optional but Recommended)

If you don't have a token stored, add this to `configuration.yaml`:

```yaml
input_text:
  ha_long_lived_token:
    name: "HA Long Lived Token"
    initial: "your_token_here"
    mode: password
```

## Step 4: Create Template Sensor to Read Results

Add to `configuration.yaml`:

```yaml
template:
  - sensor:
      - name: "Full Event Data Result"
        state: "{{ states('sensor.full_event_data_result') }}"
        attributes:
          timestamp: "{{ state_attr('sensor.full_event_data_result', 'timestamp') }}"
          event_name: "{{ state_attr('sensor.full_event_data_result', 'event_name') }}"
          app_name: "{{ state_attr('sensor.full_event_data_result', 'app_name') }}"
          full_data_json: "{{ state_attr('sensor.full_event_data_result', 'full_data') }}"
          raw_data: "{{ state_attr('sensor.full_event_data_result', 'raw_data') }}"
```

## Step 5: Alternative - Direct Service Call (Simpler)

Instead of REST command, you can call the Python script service directly. The web dashboard will call:

```
POST /api/services/python_script/get_full_event_data
{
  "timestamp": "2025-12-09T05:42:30.345311",
  "event_name": "generate_message_completed",
  "app_name": "mhe-console"
}
```

Then read the result from `sensor.full_event_data_result`.

## Database Path Notes

- **SQLite (default)**: `/config/home-assistant_v2.db`
- **MariaDB/PostgreSQL**: You'll need to modify the Python script to use the appropriate database connection

If your database is in a different location, update the `db_path` variable in the Python script.

## Testing

1. Restart Home Assistant after adding the Python script
2. Test the service call from Developer Tools → Services:
   - Service: `python_script.get_full_event_data`
   - Service Data:
     ```yaml
     timestamp: "2025-12-09T05:42:30.345311"
     event_name: "generate_message_completed"
     app_name: "mhe-console"
     ```
3. Check `sensor.full_event_data_result` to see if it found the event

## Next Steps

After setting this up, the web dashboard will be updated to:
1. Call the Python script service with the event timestamp
2. Read the result from `sensor.full_event_data_result`
3. Display the full event data in the modal
