import appdaemon.plugins.hass.hassapi as hass
import json
import mysql.connector
from datetime import datetime

class CustomEventLogger(hass.Hass):
    def initialize(self):
        self.listen_event(self.log_to_mariadb, "app_usage_event")
        self.log("CustomEventLogger initialized - listening for app_usage_event")

    def log_to_mariadb(self, event_name, data, kwargs):
        cnx = None
        cursor = None

        try:
            cnx = mysql.connector.connect(
                host="core-mariadb",
                port=3306,
                user="homeassistant",
                password="jacket",
                database="manhattan_app_usage",
                autocommit=False
            )
            cursor = cnx.cursor()

            event_data = data if isinstance(data, dict) else {}

            app_name = event_data.get("app_name", "unknown")
            event_name_value = event_data.get("event_name", "unknown")
            org = event_data.get("org")

            timestamp_str = event_data.get("timestamp")
            if timestamp_str:
                timestamp_clean = timestamp_str.replace("Z", "").split(".")[0]
                timestamp_clean = timestamp_clean.replace("T", " ")
                try:
                    timestamp = datetime.strptime(timestamp_clean, "%Y-%m-%d %H:%M:%S")
                except Exception:
                    timestamp = datetime.now()
            else:
                timestamp = datetime.now()

            event_data_json = json.dumps(event_data)

            query = (
                "INSERT INTO app_usage_events "
                "(event_name, app_name, org, timestamp, event_data) "
                "VALUES (%s, %s, %s, %s, %s)"
            )

            cursor.execute(query, (
                event_name_value,
                app_name,
                org if org else None,
                timestamp,
                event_data_json
            ))

            cnx.commit()
            self.log(f"Logged event to MariaDB: {app_name} - {event_name_value}")

        except mysql.connector.Error as e:
            self.log(f"MariaDB error: {e}", level="ERROR")
            if cnx:
                cnx.rollback()

        except Exception as e:
            self.log(f"Error logging to MariaDB: {str(e)}", level="ERROR")
            if cnx:
                cnx.rollback()

        finally:
            if cursor:
                cursor.close()
            if cnx:
                cnx.close()
