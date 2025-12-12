#!/usr/bin/env python3
"""
One-time data migration script: Home Assistant SQLite → Neon PostgreSQL
Migrates existing app_usage_event data from HA database to Neon database.

Designed to run directly from Home Assistant environment.

Usage from HA Terminal:
    cd /config
    python3 manhattan_dashboard/migrate_ha_to_neon.py

Or from HA Advanced Terminal:
    python3 /config/manhattan_dashboard/migrate_ha_to_neon.py
"""

import sqlite3
import json
import sys
from datetime import datetime
from pathlib import Path

# Try to import psycopg2 (may need to install in HA)
try:
    import psycopg2
except ImportError:
    print("❌ Error: psycopg2-binary is not installed.")
    print("\n💡 Install it in HA:")
    print("   1. Go to Settings → Add-ons → AppDaemon")
    print("   2. Open Terminal")
    print("   3. Run: pip install psycopg2-binary")
    print("\n   Or install in HA Core container:")
    print("   docker exec -it homeassistant pip install psycopg2-binary")
    sys.exit(1)

# Configuration - HA paths
HA_DB_PATH = '/config/home-assistant_v2.db'  # Standard HA database location
NEON_CONNECTION_STRING = 'postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require'

# Alternative: Use environment variables
import os
if os.getenv('HA_DB_PATH'):
    HA_DB_PATH = os.getenv('HA_DB_PATH')
if os.getenv('NEON_DATABASE_URL'):
    NEON_CONNECTION_STRING = os.getenv('NEON_DATABASE_URL')


def connect_ha_db(db_path):
    """Connect to Home Assistant SQLite database"""
    if not Path(db_path).exists():
        raise FileNotFoundError(f"HA database not found at: {db_path}")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Return rows as dict-like objects
    return conn


def connect_neon_db(connection_string):
    """Connect to Neon PostgreSQL database"""
    conn = psycopg2.connect(connection_string)
    return conn


def fetch_ha_events(ha_conn):
    """
    Fetch all app_usage_event records from Home Assistant database.
    Returns list of event dictionaries.
    """
    cursor = ha_conn.cursor()
    
    # Query to get app_usage_event events with their JSON data
    query = """
        SELECT 
            e.event_id,
            e.time_fired_ts,
            ed.shared_data AS event_data_json
        FROM events e
        INNER JOIN event_data ed ON e.data_id = ed.data_id
        INNER JOIN event_types et ON e.event_type_id = et.event_type_id
        WHERE et.event_type = 'app_usage_event'
        ORDER BY e.time_fired_ts ASC
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    events = []
    for row in rows:
        try:
            # Parse JSON data
            event_data = json.loads(row['event_data_json']) if row['event_data_json'] else {}
            
            # Extract timestamp (HA stores as microseconds since epoch)
            timestamp_ts = row['time_fired_ts'] / 1_000_000  # Convert to seconds
            timestamp = datetime.fromtimestamp(timestamp_ts)
            
            events.append({
                'event_id': row['event_id'],
                'timestamp': timestamp,
                'event_data': event_data,
                'app_name': event_data.get('app_name', 'unknown'),
                'event_name': event_data.get('event_name', 'unknown'),
                'org': event_data.get('org')
            })
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"⚠️  Skipping event_id {row['event_id']}: {e}")
            continue
    
    return events


def insert_to_neon(neon_conn, events, batch_size=100):
    """
    Insert events into Neon PostgreSQL database.
    Uses batch insert for better performance.
    """
    cursor = neon_conn.cursor()
    
    inserted = 0
    skipped = 0
    errors = 0
    
    print(f"\n📦 Inserting {len(events)} events into Neon...")
    
    # Process in batches
    for i in range(0, len(events), batch_size):
        batch = events[i:i + batch_size]
        
        for event in batch:
            try:
                # Check if event already exists (by event_id)
                cursor.execute(
                    "SELECT id FROM app_usage_events WHERE event_id = %s",
                    (event['event_id'],)
                )
                if cursor.fetchone():
                    skipped += 1
                    continue
                
                # Insert event
                insert_query = """
                    INSERT INTO app_usage_events
                    (event_id, event_name, app_name, org, timestamp, event_data)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """
                
                cursor.execute(insert_query, (
                    event['event_id'],
                    event['event_name'],
                    event['app_name'],
                    event['org'],
                    event['timestamp'],
                    json.dumps(event['event_data'])  # Convert dict to JSON string
                ))
                
                inserted += 1
                
                if inserted % 50 == 0:
                    print(f"   Progress: {inserted} inserted, {skipped} skipped, {errors} errors")
                    neon_conn.commit()  # Commit periodically
                    
            except psycopg2.IntegrityError as e:
                # Duplicate key or other constraint violation
                skipped += 1
                neon_conn.rollback()
            except Exception as e:
                errors += 1
                print(f"   ❌ Error inserting event_id {event['event_id']}: {e}")
                neon_conn.rollback()
        
        # Commit batch
        neon_conn.commit()
    
    return inserted, skipped, errors


def main():
    """Main migration function"""
    print("🚀 Starting Home Assistant → Neon Migration")
    print("=" * 60)
    
    ha_conn = None
    neon_conn = None
    
    try:
        # Connect to databases
        print(f"\n📂 Connecting to HA database: {HA_DB_PATH}")
        ha_conn = connect_ha_db(HA_DB_PATH)
        print("   ✅ Connected to HA database")
        
        print(f"\n☁️  Connecting to Neon database...")
        neon_conn = connect_neon_db(NEON_CONNECTION_STRING)
        print("   ✅ Connected to Neon database")
        
        # Fetch events from HA
        print(f"\n📥 Fetching app_usage_event records from HA...")
        events = fetch_ha_events(ha_conn)
        print(f"   ✅ Found {len(events)} events")
        
        if len(events) == 0:
            print("\n⚠️  No events found. Nothing to migrate.")
            return
        
        # Show sample event
        if events:
            print(f"\n📋 Sample event:")
            sample = events[0]
            print(f"   Event ID: {sample['event_id']}")
            print(f"   App: {sample['app_name']}")
            print(f"   Event: {sample['event_name']}")
            print(f"   Timestamp: {sample['timestamp']}")
        
        # Show summary by app
        print(f"\n📊 Events by app:")
        app_counts = {}
        for event in events:
            app_name = event['app_name']
            app_counts[app_name] = app_counts.get(app_name, 0) + 1
        for app_name, count in sorted(app_counts.items()):
            print(f"   {app_name}: {count} events")
        
        # Confirm before proceeding
        print(f"\n⚠️  Ready to migrate {len(events)} events to Neon.")
        response = input("   Continue? (yes/no): ").strip().lower()
        if response not in ['yes', 'y']:
            print("   Migration cancelled.")
            return
        
        # Insert into Neon
        inserted, skipped, errors = insert_to_neon(neon_conn, events)
        
        # Summary
        print("\n" + "=" * 60)
        print("✅ Migration Complete!")
        print(f"   Inserted: {inserted}")
        print(f"   Skipped (duplicates): {skipped}")
        print(f"   Errors: {errors}")
        print(f"   Total processed: {len(events)}")
        
        # Verify
        cursor = neon_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM app_usage_events")
        total_in_neon = cursor.fetchone()[0]
        print(f"\n📊 Total events in Neon: {total_in_neon}")
        
        # Show breakdown by app in Neon
        cursor.execute("""
            SELECT app_name, COUNT(*) as count 
            FROM app_usage_events 
            GROUP BY app_name 
            ORDER BY count DESC
        """)
        print(f"\n📊 Events in Neon by app:")
        for row in cursor.fetchall():
            print(f"   {row[0]}: {row[1]} events")
        
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Tip: The HA database should be at /config/home-assistant_v2.db")
        print("   If it's in a different location, set HA_DB_PATH environment variable")
        sys.exit(1)
    except psycopg2.Error as e:
        print(f"\n❌ Neon database error: {e}")
        print("\n💡 Check:")
        print("   - Neon connection string is correct")
        print("   - Network connectivity to Neon")
        print("   - SSL mode is 'require'")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if ha_conn:
            ha_conn.close()
        if neon_conn:
            neon_conn.close()
        print("\n🔌 Database connections closed.")


if __name__ == '__main__':
    main()
