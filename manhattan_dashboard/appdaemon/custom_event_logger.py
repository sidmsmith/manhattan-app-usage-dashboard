"""
Manhattan App Usage Dashboard - Custom Event Logger for AppDaemon
Listens for app_usage_event and writes to MariaDB
"""

import appdaemon.plugins.hass.hassapi as hass
import mysql.connector
import json
from datetime import datetime

class CustomEventLogger(hass.Hass):
    """Logs app_usage_event to MariaDB"""
    
    def initialize(self):
        """Initialize the app and listen for events"""
        # Listen for app_usage_event from the Python script
        self.listen_event(self.log_to_mariadb, "app_usage_event")
        self.log("CustomEventLogger initialized - listening for app_usage_event")
    
    def log_to_mariadb(self, event_name, data, kwargs):
        """Write event to MariaDB"""
        try:
            # Connect to MariaDB
            cnx = mysql.connector.connect(
                host="core-mariadb",
                port=3306,
                user="homeassistant",
                password="jacket",  # TODO: Move to secrets or environment variable
                database="manhattan_app_usage",
                autocommit=False
            )
            cursor = cnx.cursor()
            
            # Extract event data
            event_data = data if isinstance(data, dict) else {}
            app_name = event_data.get("app_name", "unknown")
            event_name_value = event_data.get("event_name", "unknown")
            org = event_data.get("org")
            timestamp_str = event_data.get("timestamp")
            
            # Parse timestamp or use current time
            if timestamp_str:
                try:
                    # Handle ISO format: 2024-01-01T00:00:00 or 2024-01-01T00:00:00.123456
                    timestamp_clean = timestamp_str.replace("Z", "").split(".")[0]
                    timestamp_clean = timestamp_clean.replace("T", " ")
                    timestamp = datetime.strptime(timestamp_clean, "%Y-%m-%d %H:%M:%S")
                except:
                    timestamp = datetime.now()
            else:
                timestamp = datetime.now()
            
            # Convert full event data to JSON
            event_data_json = json.dumps(event_data)
            
            # Insert into MariaDB
            query = """
            INSERT INTO app_usage_events (event_name, app_name, org, timestamp, event_data)
            VALUES (%s, %s, %s, %s, %s)
            """
            
            cursor.execute(query, (
                event_name_value,
                app_name,
                org if org else None,
                timestamp,
                event_data_json
            ))
            
            cnx.commit()
            self.log(f"✅ Logged event to MariaDB: {app_name} - {event_name_value}")
            
        except mysql.connector.Error as e:
            self.log(f"❌ MariaDB error: {e}", level="ERROR")
            if cnx:
                cnx.rollback()
        except Exception as e:
            self.log(f"❌ Error logging to MariaDB: {str(e)}", level="ERROR")
            if cnx:
                cnx.rollback()
        finally:
            if cursor:
                cursor.close()
            if cnx:
                cnx.close()
