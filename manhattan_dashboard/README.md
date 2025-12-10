# Manhattan App Usage Dashboard - Home Assistant Configuration

This folder contains all Home Assistant configuration files for the Manhattan App Usage Dashboard.

## Files

- **`templates.yaml`** - Template sensors that aggregate totals across all apps
- **`sql_sensors.yaml`** - All SQL sensors that query the HA database for app usage events
- **`store_event.py`** - Python script that processes webhook events and fires HA events

## Workflow

1. **Apps** → Send events to HA webhook: `/api/webhook/manhattan_app_usage`
2. **Automation** (in `automations.yaml`) → Triggers on webhook, calls `python_script.store_event`
3. **Python Script** (`store_event.py`) → Fires HA event `app_usage_event` with event data
4. **HA Database** → Automatically stores the event in `events` and `event_data` tables
5. **SQL Sensors** (`sql_sensors.yaml`) → Query database to aggregate and format data
6. **Template Sensors** (`templates.yaml`) → Aggregate totals across all apps
7. **Dashboard** → Reads sensors via HA API and displays data

## Included in configuration.yaml

These files are included in the main `configuration.yaml`:

```yaml
template: !include manhattan_dashboard/templates.yaml
sql: !include manhattan_dashboard/sql_sensors.yaml
```

## Python Script Location

**Important:** Home Assistant's `python_script` integration only loads scripts from `/config/python_scripts/`.

To use the script from this folder, you have two options:

### Option 1: Create a Symlink (Recommended)
Create a symbolic link from the python_scripts folder to this location:

```bash
# SSH into your HA instance, then:
ln -s /config/manhattan_dashboard/store_event.py /config/python_scripts/store_event.py
```

### Option 2: Keep a Copy in Both Locations
If symlinks don't work, keep a copy of `store_event.py` in both:
- `/config/manhattan_dashboard/store_event.py` (for version control)
- `/config/python_scripts/store_event.py` (for HA to load)

**Note:** If you keep copies, remember to update both files when making changes.

## Version Control

This entire folder can be version controlled in GitHub for backup and collaboration. The folder structure is self-contained and can be easily restored if needed.

## Restoring to Home Assistant

To restore these files to your Home Assistant instance:

1. Copy all files from this folder to `/config/manhattan_dashboard/` in your HA instance
2. Create the symlink for `store_event.py` (see above)
3. Ensure `configuration.yaml` includes the files (see above)
4. Restart Home Assistant
