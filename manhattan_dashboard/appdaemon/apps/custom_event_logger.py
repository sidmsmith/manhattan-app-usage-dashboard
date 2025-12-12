import appdaemon.plugins.hass.hassapi as hass
import json
import mysql.connector
from datetime import datetime

class CustomEventLogger(hass.Hass):
    def initialize(self):
        self.listen_event(self.log_to_mariadb, "app_usage_event")
        self.log("CustomEventLogger initialized - listening for app_usage_event")

    def log_to_mariadb(self, event_name, data, kwargs):
        """
        Main event handler. Writes to both MariaDB and Neon PostgreSQL.
        Both writes are independent - if one fails, the other continues.
        """
        cnx = None
        cursor = None

        # Extract and normalize event data
        event_data = data if isinstance(data, dict) else {}
        app_name = event_data.get("app_name", "unknown")
        event_name_value = event_data.get("event_name", "unknown")
        org = event_data.get("org")

        # Parse timestamp
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

        # Write to MariaDB (local)
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

        # Write to Neon PostgreSQL (cloud) - independent of MariaDB write
        self.log_to_neon(event_data, timestamp)

    def log_to_neon(self, event_data, timestamp):
        """
        Writes event data to Neon PostgreSQL. MariaDB logging is unaffected.
        Uses SSL connection with pooler endpoint for better performance.
        """
        try:
            import psycopg2

            conn = psycopg2.connect(
                host="ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech",
                dbname="neondb",
                user="neondb_owner",
                password="npg_HCWtem4D6fcR",
                sslmode="require",
                connect_timeout=5
            )

            cursor = conn.cursor()

            app_name = event_data.get("app_name", "unknown")
            event_name = event_data.get("event_name", "unknown")
            org = event_data.get("org")
            event_json = json.dumps(event_data)

            sql = """
                INSERT INTO app_usage_events
                (event_name, app_name, org, timestamp, event_data)
                VALUES (%s, %s, %s, %s, %s)
            """

            cursor.execute(sql, (
                event_name, 
                app_name, 
                org, 
                timestamp, 
                event_json
            ))

            conn.commit()
            cursor.close()
            conn.close()

            self.log(f"🟢 Neon: Inserted {app_name} - {event_name}")

        except Exception as e:
            self.log(f"🟡 Neon insert failed: {str(e)}", level="WARNING")
