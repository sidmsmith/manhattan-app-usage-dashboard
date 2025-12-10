# Manhattan App Usage Dashboard - Home Assistant Configuration

This folder contains all Home Assistant configuration files for the Manhattan App Usage Dashboard. These files must be installed in your Home Assistant instance for the dashboard to function.

## Overview

The Home Assistant configuration consists of four main components:

1. **Automation** - Receives webhook events from apps and triggers the Python script
2. **Python Script** - Processes webhook data and fires HA events into the database
3. **SQL Sensors** - Query the HA database to aggregate and format event data
4. **Template Sensors** - Aggregate totals across all individual app sensors

## Complete Setup Guide

### Step 1: Copy Files to Home Assistant

Copy all files from this `manhattan_dashboard/` folder to `/config/manhattan_dashboard/` in your Home Assistant instance.

**Methods:**
- **SSH/SCP**: `scp -r manhattan_dashboard/ homeassistant:/config/`
- **Samba/Network Share**: Copy via network share if enabled
- **File Editor Add-on**: Use HA's File Editor add-on to create files manually
- **Git**: Clone this repo and copy the folder

**Required files:**
- `templates.yaml`
- `sql_sensors.yaml`
- `store_event.py`
- `README.md` (this file, for reference)

### Step 2: Configure Python Script

**Important:** Home Assistant's `python_script` integration only loads scripts from `/config/python_scripts/`.

You have two options:

#### Option 1: Create a Symlink (Recommended)

SSH into your HA instance and create a symbolic link:

```bash
# SSH into your HA instance
ssh homeassistant@your-ha-ip

# Create the symlink
ln -s /config/manhattan_dashboard/store_event.py /config/python_scripts/store_event.py
```

**Benefits:**
- Single source of truth (file in `manhattan_dashboard/`)
- Updates automatically when you update the file
- No need to maintain two copies

#### Option 2: Keep a Copy in Both Locations

If symlinks don't work, copy the file:

```bash
cp /config/manhattan_dashboard/store_event.py /config/python_scripts/store_event.py
```

**Note:** If you use this method, remember to update both files when making changes.

### Step 3: Update configuration.yaml

Add these includes to your main `configuration.yaml` file:

```yaml
# Manhattan App Usage Dashboard Configuration
template: !include manhattan_dashboard/templates.yaml
sql: !include manhattan_dashboard/sql_sensors.yaml
```

**Location:** Add these lines in your `/config/configuration.yaml` file. The `!include` directive tells Home Assistant to load the sensor definitions from the separate files.

**Note:** If you already have `template:` or `sql:` sections in your `configuration.yaml`, you'll need to merge them. The `!include` directive replaces the entire section, so you may need to use `!include_dir_merge_list` if you have other templates/SQL sensors.

**Example with existing config:**
```yaml
# If you have other template sensors, use merge:
template: !include_dir_merge_list templates/

# Then add the dashboard templates separately:
template:
  - !include manhattan_dashboard/templates.yaml
```

### Step 4: Create the Automation

**This is a critical step that must be done manually.** The automation receives webhook events from your apps and triggers the Python script.

Create or edit `/config/automations.yaml` and add this automation:

```yaml
- id: 'manhattan_app_usage_webhook'
  alias: 'Manhattan App Usage - Process Webhook'
  description: 'Process webhook events from Manhattan apps and store in database'
  trigger:
    - platform: webhook
      webhook_id: manhattan_app_usage
  action:
    - service: python_script.store_event
      data:
        event: "{{ trigger.json }}"
  mode: single
```

**Key points:**
- **webhook_id**: `manhattan_app_usage` - This is the webhook endpoint your apps call: `/api/webhook/manhattan_app_usage`
- **service**: `python_script.store_event` - Calls the Python script we set up
- **data.event**: Passes the entire webhook payload to the Python script

**If `automations.yaml` doesn't exist**, create it and add:

```yaml
- id: 'manhattan_app_usage_webhook'
  alias: 'Manhattan App Usage - Process Webhook'
  description: 'Process webhook events from Manhattan apps and store in database'
  trigger:
    - platform: webhook
      webhook_id: manhattan_app_usage
  action:
    - service: python_script.store_event
      data:
        event: "{{ trigger.json }}"
  mode: single
```

Then ensure `configuration.yaml` includes it:

```yaml
automation: !include automations.yaml
```

### Step 5: Restart Home Assistant

After making all changes:

1. **Check Configuration**: Go to **Developer Tools** > **YAML** > **Check Configuration**
2. **If valid**: Restart Home Assistant (Settings > System > Restart)
3. **If errors**: Fix any YAML syntax errors before restarting

### Step 6: Verify Installation

After restart, verify everything is working:

1. **Check Sensors Exist**: Go to **Developer Tools** > **States**
   - Search for `sensor.all_apps_total_events`
   - Search for `sensor.lpn_unlock_app_total_events` (or any app)
   - You should see all the sensors listed

2. **Check Python Script**: Go to **Developer Tools** > **Services**
   - Service: `python_script.store_event`
   - Should be available (no errors)

3. **Test Webhook** (optional):
   ```bash
   curl -X POST http://your-ha-url:8123/api/webhook/manhattan_app_usage \
     -H "Content-Type: application/json" \
     -d '{"event_name":"test_event","app_name":"test-app","timestamp":"2024-01-01T00:00:00Z"}'
   ```
   Then check if sensors update (may take up to 60 seconds for SQL sensors to refresh)

## File Descriptions

### templates.yaml

**Purpose**: Template sensors that aggregate totals across all individual app sensors.

**Sensors Created:**
- `sensor.all_apps_total_events` - Sum of all app total events
- `sensor.all_apps_events_last_24h` - Sum of all app 24h events
- `sensor.all_apps_total_opens` - Sum of all app opens

**How it works:**
- Reads individual app sensors (e.g., `sensor.lpn_unlock_app_total_events`)
- Sums them using Jinja2 template syntax
- Updates automatically when source sensors change

**To add a new app**: Add the app's sensors to each aggregation formula.

### sql_sensors.yaml

**Purpose**: SQL sensors that query the Home Assistant database directly to get event data.

**Structure**: Each app has 4 sensors:
1. **Total Events** - `COUNT(*)` of all events for the app
2. **Events Last 24h** - `COUNT(*)` with time filter for last 24 hours
3. **Total Opens** - `COUNT(*)` where `event_name = 'app_opened'`
4. **Recent Events** - `json_group_array` of last 15 events with details

**Database Tables Used:**
- `event_data` - Contains the actual event data (JSON in `shared_data` column)
- Events are stored as JSON with keys: `event_name`, `timestamp`, `org`, `app_name`

**Query Pattern:**
```sql
SELECT json_group_array(
  json_object(
    'event_name', event_name,
    'timestamp', timestamp,
    'org', org,
    'app_name', app_name
  )
) AS events
FROM (
  SELECT
    json_extract(shared_data, '$.event_name') AS event_name,
    json_extract(shared_data, '$.timestamp') AS timestamp,
    json_extract(shared_data, '$.org') AS org,
    json_extract(shared_data, '$.app_name') AS app_name
  FROM event_data
  WHERE json_extract(shared_data, '$.app_name') = 'app-name'
  ORDER BY timestamp DESC
  LIMIT 15
);
```

**Refresh Rate**: SQL sensors refresh every 60 seconds by default (HA's `sql` integration default).

**To add a new app**: Copy an existing app's 4-sensor block and update:
- `name`: Sensor display name
- `WHERE` clause: Update `app_name` filter
- Handle multiple app name variants if needed (e.g., `appt-app` vs `appt_app`)

### store_event.py

**Purpose**: Python script that processes webhook payloads and fires Home Assistant events.

**How it works:**
1. Receives webhook data via automation
2. Extracts the `event` object from the payload
3. Fires a Home Assistant event: `app_usage_event` with the event data
4. HA automatically stores this event in the database

**Code:**
```python
event = data.get("event", {})

# Fire a Home Assistant event with all metadata included
hass.bus.fire("app_usage_event", event)
```

**Event Structure**: The script expects the webhook payload to have an `event` key containing:
```json
{
  "event": {
    "event_name": "app_opened",
    "app_name": "lpn-unlock-app",
    "timestamp": "2024-01-01T00:00:00Z",
    "org": "SS-DEMO",
    ...other metadata...
  }
}
```

**Event Storage**: When `hass.bus.fire("app_usage_event", event)` is called, Home Assistant:
1. Stores the event in the `events` table
2. Stores the event data in the `event_data` table (in `shared_data` as JSON)
3. Makes it queryable by SQL sensors

## Complete Data Flow

Understanding the complete flow helps with troubleshooting:

```
1. Manhattan App (Python/JS)
   └─> POST /api/webhook/manhattan_app_usage
       Payload: {"event": {"event_name": "...", "app_name": "...", ...}}

2. Home Assistant Webhook
   └─> Triggers automation: manhattan_app_usage_webhook

3. Automation
   └─> Calls service: python_script.store_event
       Passes: data.event = trigger.json

4. Python Script (store_event.py)
   └─> Extracts: event = data.get("event", {})
   └─> Fires: hass.bus.fire("app_usage_event", event)

5. Home Assistant Event Bus
   └─> Stores event in database:
       - events table (event metadata)
       - event_data table (event data as JSON in shared_data)

6. SQL Sensors (sql_sensors.yaml)
   └─> Query event_data table every 60 seconds
   └─> Aggregate and format data
   └─> Create sensors: sensor.{app}_total_events, etc.

7. Template Sensors (templates.yaml)
   └─> Read individual app sensors
   └─> Sum them: sensor.all_apps_total_events, etc.

8. Dashboard (Web App)
   └─> GET /api/states/sensor.all_apps_total_events
   └─> GET /api/states/sensor.{app}_recent_events
   └─> Displays data in UI
```

## Adding a New App

To add support for a new Manhattan app:

### 1. Add SQL Sensors

In `sql_sensors.yaml`, add a new section with 4 sensors:

```yaml
#########################################################
# NEW APP NAME
#########################################################

- db_url: sqlite:////config/home-assistant_v2.db
  name: New App - Total Events
  query: >
    SELECT COUNT(*) AS count
    FROM event_data
    WHERE json_extract(shared_data, '$.app_name') = 'new-app-name';
  column: count

- db_url: sqlite:////config/home-assistant_v2.db
  name: New App - Events Last 24h
  query: >
    SELECT COUNT(*) AS count
    FROM event_data
    WHERE json_extract(shared_data, '$.app_name') = 'new-app-name'
      AND DATETIME(json_extract(shared_data, '$.timestamp')) > DATETIME('now','-1 day');
  column: count

- db_url: sqlite:////config/home-assistant_v2.db
  name: New App - Total Opens
  query: >
    SELECT COUNT(*) AS count
    FROM event_data
    WHERE json_extract(shared_data, '$.app_name') = 'new-app-name'
      AND json_extract(shared_data, '$.event_name') = 'app_opened';
  column: count

- db_url: sqlite:////config/home-assistant_v2.db
  name: New App - Recent Events
  query: >
    SELECT json_group_array(
             json_object(
               'event_name', event_name,
               'timestamp',  timestamp,
               'org',        org,
               'app_name',   app_name
             )
           ) AS events
    FROM (
      SELECT
        json_extract(shared_data, '$.event_name') AS event_name,
        json_extract(shared_data, '$.timestamp') AS timestamp,
        json_extract(shared_data, '$.org') AS org,
        json_extract(shared_data, '$.app_name') AS app_name
      FROM event_data
      WHERE json_extract(shared_data, '$.app_name') = 'new-app-name'
      ORDER BY timestamp DESC
      LIMIT 15
    );
  column: events
```

**Important**: Update `'new-app-name'` to match the `app_name` your app sends in webhook events.

### 2. Update Template Sensors

In `templates.yaml`, add the new app's sensors to each aggregation:

```yaml
- name: "All Apps - Total Events"
  state: >
    {{ states('sensor.lpn_unlock_app_total_events') | int(0) +
       states('sensor.mhe_console_total_events') | int(0) +
       states('sensor.new_app_total_events') | int(0) +  # ADD THIS
       ... }}
```

Do this for all three template sensors (Total Events, Events Last 24h, Total Opens).

### 3. Add to Dashboard

In the dashboard's `app.js`, add to the `APPS` array:

```javascript
{ id: 'new_app', name: 'New App', icon: '🆕' }
```

**Note**: The `id` should match the sensor prefix (e.g., `new_app` matches `sensor.new_app_total_events`).

### 4. Restart Home Assistant

After making changes:
1. Check configuration: **Developer Tools** > **YAML** > **Check Configuration**
2. Restart Home Assistant
3. Verify new sensors appear in **Developer Tools** > **States**

## Troubleshooting

### Sensors Not Appearing

1. **Check YAML syntax**: Use **Developer Tools** > **YAML** > **Check Configuration**
2. **Verify includes**: Ensure `configuration.yaml` has the `!include` statements
3. **Check file paths**: Ensure files are in `/config/manhattan_dashboard/`
4. **Restart HA**: Sensors only load on restart

### SQL Sensor Errors

1. **Check database path**: Ensure `db_url: sqlite:////config/home-assistant_v2.db` is correct
2. **Verify table exists**: Check that `event_data` table exists in database
3. **Check SQL syntax**: SQL sensors are sensitive to syntax errors
4. **Check logs**: Look for SQL errors in HA logs

### Python Script Not Working

1. **Verify symlink/copy**: Check file exists in `/config/python_scripts/store_event.py`
2. **Check permissions**: Ensure file is readable
3. **Test manually**: Go to **Developer Tools** > **Services** and call `python_script.store_event` with test data
4. **Check logs**: Look for Python script errors in HA logs

### Webhook Not Triggering

1. **Verify automation exists**: Check `automations.yaml` has the webhook automation
2. **Check webhook_id**: Must match what apps are sending: `manhattan_app_usage`
3. **Test webhook**: Use curl to test (see Step 6 in setup)
4. **Check automation logs**: Go to **Settings** > **Automations & Scenes** > Click automation > View logs

### Events Not Storing

1. **Check Python script**: Verify it's firing events
2. **Check event bus**: Go to **Developer Tools** > **Events** and listen for `app_usage_event`
3. **Verify database**: Check `event_data` table has entries
4. **Check webhook payload**: Ensure apps are sending correct format

## Database Schema Reference

Understanding the database structure helps with SQL queries:

**events table:**
- `event_id` - Unique event ID
- `time_fired_ts` - Timestamp (microseconds since epoch)
- `event_type_id` - Reference to event_types table
- `data_id` - Reference to event_data table

**event_data table:**
- `data_id` - Unique data ID
- `shared_data` - JSON string containing event data

**event_types table:**
- `event_type_id` - Unique type ID
- `event_type` - Event type name (e.g., `app_usage_event`)

**Example query to see all events:**
```sql
SELECT 
  e.event_id,
  datetime(e.time_fired_ts / 1000000, 'unixepoch') AS timestamp,
  json_extract(ed.shared_data, '$.app_name') AS app_name,
  json_extract(ed.shared_data, '$.event_name') AS event_name
FROM events e
LEFT JOIN event_data ed ON e.data_id = ed.data_id
LEFT JOIN event_types et ON e.event_type_id = et.event_type_id
WHERE et.event_type = 'app_usage_event'
ORDER BY e.time_fired_ts DESC
LIMIT 10;
```

## Restoring from Backup

If you need to restore these files to a new Home Assistant instance:

1. **Copy files**: Copy entire `manhattan_dashboard/` folder to `/config/`
2. **Create symlink**: `ln -s /config/manhattan_dashboard/store_event.py /config/python_scripts/store_event.py`
3. **Update configuration.yaml**: Add the `!include` statements
4. **Create automation**: Add the webhook automation to `automations.yaml`
5. **Restart**: Restart Home Assistant
6. **Verify**: Check sensors appear in Developer Tools > States

## Version Control

These files are version controlled in GitHub:
- Repository: `https://github.com/sidmsmith/manhattan-app-usage-dashboard.git`
- Location: `manhattan_dashboard/` folder

**Best Practice**: After making changes in HA, copy the updated files back to the GitHub repository to keep them in sync.

## Historical: Full Event JSON Modal Attempts

**Note**: This section documents previous attempts to implement a modal that would display the full JSON data for individual events. All attempts failed, and the feature was removed in v0.3.7. This documentation is preserved to avoid repeating the same mistakes in future attempts.

### Goal

The goal was to allow users to click on an event in the dashboard and see the complete JSON payload for that event, including all metadata that might not be displayed in the summary view.

### Attempt 1: Python Script with Direct Database Access

**Approach**: Create a Python script (`get_full_event_data.py`) that would:
- Accept an `event_id` parameter
- Use `sqlite3` to query the database directly
- Return the full event JSON

**Why it failed**:
1. **Import restrictions**: Home Assistant's Python Script integration has strict import limitations
   - `import sqlite3` → `ImportError: Not allowed to import sqlite3`
   - `import os` → `ImportError: Not allowed to import os`
   - Only a very limited set of modules are allowed
2. **Eval restrictions**: Attempts to use `eval()` were blocked
   - `Eval calls are not allowed`
3. **No direct database access**: Python scripts cannot directly access the HA database

**Lessons learned**:
- Python scripts in HA are heavily sandboxed
- Cannot import standard library modules like `sqlite3`, `os`, `json` (though `json` might work)
- Cannot use `eval()` or other dynamic code execution
- Must work within HA's service/event system

### Attempt 2: SQL Template Sensor with Dynamic Query

**Approach**: Create a template sensor that would:
- Accept an `event_id` via an `input_text` helper
- Use a template to construct a SQL query
- Query the database via template functions

**Why it failed**:
1. **Templates cannot execute SQL**: Home Assistant templates (Jinja2) cannot directly query the database
2. **No dynamic SQL in templates**: Template sensors can only read from other sensors, not execute queries
3. **Architecture mismatch**: Templates are for transforming data, not querying sources

**Lessons learned**:
- Template sensors are read-only transformations
- Cannot dynamically query the database from templates
- Templates work with existing sensor states, not raw database queries

### Attempt 3: Shell Command with SQLite3 CLI

**Approach**: Use HA's `shell_command` integration to:
1. Set `input_text.event_id_to_query` with the event ID
2. Trigger `shell_command.query_event_by_id` that runs:
   ```bash
   sqlite3 /config/home-assistant_v2.db "SELECT shared_data FROM event_data WHERE data_id = (SELECT data_id FROM events WHERE event_id = $(input_text.event_id_to_query))" > /config/event_query_result.json
   ```
3. Use a `command_line` sensor to read the file
4. Create a template sensor to parse the JSON
5. Vercel serverless function (`fetch-full-event.js`) orchestrates the flow

**Why it failed**:
1. **Shell command availability**: `shell_command` integration may not be available in all HA installations
   - Error: `Shell command not available`
   - Some HA installations (especially containerized) don't allow shell commands
2. **File system permissions**: Writing to `/config/` may have permission issues
3. **Race conditions**: Multiple rapid requests could cause file conflicts
4. **Error handling**: Difficult to handle errors gracefully
5. **Performance**: File I/O adds latency
6. **500 Internal Server Error**: Persistent server errors when calling the shell command
7. **Unstable**: Intermittent failures made it unreliable for production

**Configuration attempted**:
```yaml
# input_text helper
input_text:
  event_id_to_query:
    name: Event ID to Query
    initial: ""

# shell_command
shell_command:
  query_event_by_id: >
    sqlite3 /config/home-assistant_v2.db "
    SELECT shared_data 
    FROM event_data 
    WHERE data_id = (
      SELECT data_id 
      FROM events 
      WHERE event_id = {{ states('input_text.event_id_to_query') }}
    )" > /config/event_query_result.json

# command_line sensor
command_line:
  - sensor:
      name: Event Query Result File
      command: cat /config/event_query_result.json
      scan_interval: 1

# template sensor
template:
  - sensor:
      name: Full Event Data Result
      state: "{{ states('sensor.event_query_result_file') | from_json }}"
```

**Lessons learned**:
- `shell_command` is not universally available
- File-based approaches are fragile and slow
- Race conditions with concurrent requests
- Difficult error handling and debugging
- Not suitable for on-demand, real-time queries

### Attempt 4: Slow SQL Template Sensor

**Approach**: Create a SQL sensor that queries by `event_id`:
- Use `input_text` to set the event ID
- SQL sensor queries based on the input_text value
- Template sensor formats the result

**Why it failed**:
1. **60+ second delay**: SQL sensors refresh every 60 seconds by default
   - User clicks event → Set input_text → Wait up to 60 seconds → Sensor updates
   - Unacceptable user experience
2. **Not on-demand**: SQL sensors are scheduled, not event-driven
3. **Cannot trigger on-demand**: No way to force an immediate SQL sensor refresh

**Lessons learned**:
- SQL sensors are scheduled, not on-demand
- 60-second delay is too slow for interactive features
- Cannot force immediate refresh of SQL sensors
- Not suitable for real-time, user-triggered queries

### Current State

The modal feature was **removed in v0.3.7** because:
- All attempted approaches failed
- The modal was "ineffective" - couldn't display more details than already available
- The complexity wasn't worth the limited benefit
- Recent events already show the key information (event_name, timestamp, org, app_name)

### Future Approaches to Consider

If attempting this again in the future, consider:

1. **Home Assistant REST API**: 
   - Use HA's `/api/events` endpoint to query events
   - May require authentication and proper filtering
   - Could be called directly from the dashboard JavaScript

2. **Custom Integration**:
   - Create a custom HA integration that exposes an API endpoint
   - Can have direct database access
   - More control over query performance

3. **External Database Query Service**:
   - Create a separate service (Node.js/Python) that queries the HA database
   - Expose via API
   - Dashboard calls this service instead of HA

4. **Event Data in Recent Events**:
   - Store more data in the `recent_events` SQL sensor
   - Include full JSON in the events array
   - Display in modal without additional queries

5. **Webhook Response**:
   - Modify apps to include full event data in webhook response
   - Store in a separate sensor or helper
   - Query by correlation ID

**Key Requirements for Success**:
- Must be on-demand (no 60-second delay)
- Must work reliably (no shell command dependencies)
- Must handle errors gracefully
- Must be performant (< 1 second response time)
- Must work in standard HA installations (no special requirements)

## Support

For issues or questions:
1. Check HA logs: **Settings** > **System** > **Logs**
2. Check configuration: **Developer Tools** > **YAML** > **Check Configuration**
3. Verify sensors: **Developer Tools** > **States**
4. Test services: **Developer Tools** > **Services**
