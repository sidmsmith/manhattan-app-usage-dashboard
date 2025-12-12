# Alternative approach: Store Event with MariaDB via HA Service
# This version uses a different approach if subprocess doesn't work
# 
# Option: Create a custom HA integration or use a different method
# This file is for reference/documentation

event = data.get("event", {})

# Fire HA event (existing functionality)
hass.bus.fire("app_usage_event", event)

# Alternative approaches if subprocess doesn't work:

# Option 1: Write to a staging SQLite table, sync to MariaDB via automation
# Option 2: Use HA's REST API to call a service that writes to MariaDB
# Option 3: Create a custom Python integration with full database access
# Option 4: Use a Node-RED flow to sync HA events to MariaDB

# For now, the main store_event.py uses subprocess approach
# If that fails, we can implement one of these alternatives



