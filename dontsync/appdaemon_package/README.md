# Full AppDaemon + MariaDB Logging Solution (Expanded Documentation)

This package contains a complete, working configuration for integrating **Home Assistant**, **AppDaemon**, and **MariaDB** so that custom Home Assistant events (`app_usage_event`) are captured and written directly into a MariaDB table.

The documentation explains:

1. Installation  
2. Required configuration  
3. Directory structure inside & outside the container  
4. AppDaemon file layout  
5. Event workflow HA → AppDaemon → MariaDB  
6. GitHub/Cursor syncing strategy  

---

# 1. AppDaemon Installation (Home Assistant Add-on)

Install **AppDaemon 4** from the Home Assistant Add-on Store.

Add to the add-on configuration:

```yaml
system_packages: []
python_packages:
  - mysql-connector-python
init_commands: []
```

---

# 2. AppDaemon Configuration File (Critical)

Stored at:

```
/addon_configs/a0d7b954_appdaemon/appdaemon.yaml
```

This file becomes, inside the container:

```
/config/appdaemon.yaml
```

Contents:

```yaml
appdaemon:
  time_zone: America/New_York
  latitude: 33.9944
  longitude: -84.4747
  elevation: 300
  app_dir: /config/apps

plugins:
  HASS:
    type: hass
    ha_url: http://supervisor/core

http:
  url: http://0.0.0.0:5050

hadashboard:
```

AppDaemon auto‑injects HA authentication token — **no manual token required**.

---

# 3. AppDaemon App Files

### `/addon_configs/a0d7b954_appdaemon/apps/apps.yaml`

```yaml
custom_event_logger:
  module: custom_event_logger
  class: CustomEventLogger
```

### `/addon_configs/a0d7b954_appdaemon/apps/custom_event_logger.py`

This Python script listens for `app_usage_event` and writes rows into MariaDB.

(The actual file is not embedded here — use your HA container copy.)

---

# 4. Directory Structure (Important)

### Host OS (persistent)

```
/addon_configs/
  └── a0d7b954_appdaemon/
       ├── appdaemon.yaml
       ├── apps/
       │    ├── apps.yaml
       │    └── custom_event_logger.py
```

### Inside Container

```
/config/
  ├── appdaemon.yaml
  ├── apps/
  │    ├── apps.yaml
  │    └── custom_event_logger.py
```

---

# 5. Workflow of an Event

```
[Browser App]
   │
   └── Sends event → Home Assistant API
         event_type: app_usage_event
         data: JSON payload

[Home Assistant]
   │
   └── Publishes event on event bus

[AppDaemon HASS plugin]
   │
   └── Triggers CustomEventLogger.log_to_mariadb()

[CustomEventLogger]
   │
   ├── Normalizes timestamp
   ├── Serializes payload → JSON
   └── INSERT INTO MariaDB(app_usage_events)

[MariaDB]
   │
   └── Stores analytics‑ready rows
```

---

# 6. MariaDB Schema

```sql
CREATE TABLE app_usage_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(255),
  app_name VARCHAR(255),
  org VARCHAR(255),
  timestamp DATETIME,
  event_data JSON
);
```

---

# 7. GitHub + Cursor Workflow

### Include in repo:

```
appdaemon/appdaemon.yaml
appdaemon/apps/apps.yaml
appdaemon/apps/custom_event_logger.py
README.md
```

### Do NOT track:

- HA OS internal paths
- Supervisor‑managed token files
- Auto‑generated folders (`compiled`, `namespaces`, `www`)

---

# 8. Validation Commands

### appdaemon.yaml
```
docker exec -it addon_a0d7b954_appdaemon sh -c "sed -n '1,200p' /config/appdaemon.yaml | cat -A"
```

### apps.yaml
```
docker exec -it addon_a0d7b954_appdaemon sh -c "sed -n '1,200p' /config/apps/apps.yaml | cat -A"
```

### custom_event_logger.py
```
docker exec -it addon_a0d7b954_appdaemon sh -c "sed -n '1,200p' /config/apps/custom_event_logger.py"
```

---

# 9. Test Event

Send via Developer Tools → Events:

```json
{
  "event_name": "test_event",
  "app_name": "demo-app",
  "org": "TEST",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

Expected AppDaemon log:

```
Logged event to MariaDB: demo-app - test_event
```

---

# 10. Summary

This package includes:

- Full documentation
- AppDaemon configuration template
- apps.yaml template
- Custom event logger
- Deployment + DevOps workflow
