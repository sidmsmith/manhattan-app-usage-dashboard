// Vercel serverless function to fetch recent events directly from HA database
// Uses shell_command to query SQLite and return JSON (bypasses 255 char limit)

export default async function (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { app_name } = req.query;

  if (!app_name) {
    return res.status(400).json({ error: 'app_name is required' });
  }

  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return res.status(500).json({ error: 'Home Assistant configuration missing' });
  }

  try {
    // Map frontend app_name to database app_name values
    const appNameQueries = {
      'lpn_unlock_app': "json_extract(shared_data, '$.app_name') = 'lpn-unlock-app'",
      'mhe_console': "json_extract(shared_data, '$.app_name') = 'mhe-console'",
      'appt_app': "(json_extract(shared_data, '$.app_name') = 'appt_app' OR json_extract(shared_data, '$.app_name') = 'appt-app')",
      'pos_items': "json_extract(shared_data, '$.app_name') = 'POS Items'",
      'driver_pickup': "(json_extract(shared_data, '$.app_name') = 'driver-pickup' OR json_extract(shared_data, '$.app_name') = 'driver_pickup' OR json_extract(shared_data, '$.app_name') = 'Driver Pickup')",
      'facility_addresses': "(json_extract(shared_data, '$.app_name') = 'facility-addresses' OR json_extract(shared_data, '$.app_name') = 'facility_addresses' OR json_extract(shared_data, '$.app_name') = 'Facility Addresses')",
      'forecast_import': "json_extract(shared_data, '$.app_name') = 'Import Forecast'",
      'apps_homepage': "json_extract(shared_data, '$.app_name') = 'apps-homepage'",
      'item_generator_gallery': "json_extract(shared_data, '$.app_name') = 'Item Generator'",
      'order_generator': "json_extract(shared_data, '$.app_name') = 'Order Generator'",
      'schedule_app': "json_extract(shared_data, '$.app_name') = 'schedule-app'",
      'todolist': "json_extract(shared_data, '$.app_name') = 'todolist'",
      'update_appt': "json_extract(shared_data, '$.app_name') = 'update-appt'"
    };

    const whereClause = appNameQueries[app_name];
    if (!whereClause) {
      return res.status(400).json({ error: `Unknown app_name: ${app_name}` });
    }

    // Step 1: Set the app_name in input_text.app_name_to_query
    const setAppNameUrl = `${HA_URL}/api/services/input_text/set_value`;
    const setAppNameResponse = await fetch(setAppNameUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entity_id: 'input_text.app_name_to_query',
        value: app_name
      })
    });

    if (!setAppNameResponse.ok) {
      throw new Error(`Failed to set app_name: ${setAppNameResponse.status}`);
    }

    // Step 2: Call shell_command to query recent events
    const shellCommandUrl = `${HA_URL}/api/services/shell_command/query_recent_events_by_app`;
    const shellCommandResponse = await fetch(shellCommandUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!shellCommandResponse.ok) {
      // If shell_command doesn't exist, return empty array for now
      console.warn('[fetch-recent-events] Shell command not available, returning empty events');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).json({ events: [] });
    }

    // Step 3: Read the result from command_line sensor
    const maxWaitTime = 2000; // 2 seconds
    const checkInterval = 200; // Check every 200ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      const sensorUrl = `${HA_URL}/api/states/sensor.recent_events_query_result`;
      const sensorResponse = await fetch(sensorUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${HA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (sensorResponse.ok) {
        const sensorData = await sensorResponse.json();
        const fileContent = sensorData.state;
        
        if (fileContent && fileContent !== 'unknown' && fileContent !== '' && !fileContent.includes('error')) {
          try {
            const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
            
            if (Array.isArray(parsed)) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              return res.status(200).json({ events: parsed });
            }
          } catch (e) {
            console.error('[fetch-recent-events] Error parsing JSON:', e);
          }
        }
      }
    }
    
    // Timeout - return empty array
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).json({ events: [] });
    
  } catch (error) {
    console.error('[fetch-recent-events] Error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'Failed to fetch recent events',
      message: error.message 
    });
  }
}
