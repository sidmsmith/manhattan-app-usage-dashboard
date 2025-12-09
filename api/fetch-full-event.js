// Vercel serverless function to fetch full event data using Option 1: Template Sensor with SQL Query
// 1. Set input_text.event_id_to_query with event_id
// 2. Wait for SQL sensor to update (runs every 5 seconds)
// 3. Read template sensor result
export default async function (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event_id, timestamp } = req.query;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id is required' });
  }

  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return res.status(500).json({ error: 'Home Assistant configuration missing' });
  }

  try {
    // Step 1: Set input_text.event_id_to_query
    console.log('[fetch-full-event] Setting input_text.event_id_to_query to', event_id);
    const setInputUrl = `${HA_URL}/api/services/input_text/set_value`;
    const setInputResponse = await fetch(setInputUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entity_id: 'input_text.event_id_to_query',
        value: String(event_id)
      })
    });

    if (!setInputResponse.ok) {
      const errorText = await setInputResponse.text();
      throw new Error(`Failed to set input_text: ${setInputResponse.status} ${errorText}`);
    }

    // Step 2: Wait for SQL sensor to update (runs every 60 seconds by default, wait up to 70 seconds)
    console.log('[fetch-full-event] Waiting for SQL sensor to update...');
    const maxWaitTime = 70000; // 70 seconds (SQL sensors run every 60 seconds)
    const checkInterval = 500; // Check every 500ms
    const startTime = Date.now();
    let sensorData = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Step 3: Read template sensor result
      const sensorUrl = `${HA_URL}/api/states/sensor.full_event_data_result`;
      const sensorResponse = await fetch(sensorUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${HA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!sensorResponse.ok) {
        throw new Error(`Failed to read sensor: ${sensorResponse.status}`);
      }

      sensorData = await sensorResponse.json();
      const sharedData = sensorData.attributes?.shared_data;
      
      if (sharedData && sharedData !== '' && sharedData !== 'unknown') {
        console.log('[fetch-full-event] Success! Found event data');
        try {
          // Parse the JSON string from SQL sensor
          const parsed = typeof sharedData === 'string' ? JSON.parse(sharedData) : sharedData;
          
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          
          return res.status(200).json({
            success: true,
            data: parsed,
            event_id: event_id,
            timestamp: parsed.timestamp || timestamp
          });
        } catch (e) {
          console.error('[fetch-full-event] Error parsing shared_data JSON:', e);
        }
      }
    }
    
    // Timeout - return error
    console.warn('[fetch-full-event] Timeout waiting for SQL sensor update');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(200).json({
      success: false,
      message: 'Event not found or timeout waiting for SQL sensor',
      sensor_state: sensorData?.state,
      debug: {
        requested_event_id: event_id,
        sensor_shared_data: sensorData?.attributes?.shared_data ? 'present' : 'missing',
        wait_time_ms: Date.now() - startTime
      }
    });
    
  } catch (error) {
    console.error('[fetch-full-event] Error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'Failed to fetch full event data',
      message: error.message 
    });
  }
}
