// Vercel serverless function to fetch full event data using shell_command for immediate query
// 1. Set input_text.event_id_to_query with event_id
// 2. Call shell_command service to query SQLite directly
// 3. Read file sensor result
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

    // Step 2: Call shell_command service to query database immediately
    console.log('[fetch-full-event] Calling shell_command.query_event_by_id');
    const shellCommandUrl = `${HA_URL}/api/services/shell_command/query_event_by_id`;
    const shellCommandResponse = await fetch(shellCommandUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!shellCommandResponse.ok) {
      const errorText = await shellCommandResponse.text();
      throw new Error(`Failed to call shell_command: ${shellCommandResponse.status} ${errorText}`);
    }

    // Step 3: Wait for file sensor to update (should be very fast, max 5 seconds)
    console.log('[fetch-full-event] Waiting for file sensor to update...');
    const maxWaitTime = 5000; // 5 seconds (should be much faster)
    const checkInterval = 200; // Check every 200ms
    const startTime = Date.now();
    let sensorData = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Read file sensor result
      const sensorUrl = `${HA_URL}/api/states/sensor.event_query_result_file`;
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
      const fileContent = sensorData.state;
      
      if (fileContent && fileContent !== 'unknown' && fileContent !== '' && !fileContent.includes('error')) {
        console.log('[fetch-full-event] Success! Found event data in file');
        try {
          // Parse the JSON from file sensor
          const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
          
          // Check if it's an error object
          if (parsed.error) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            return res.status(200).json({
              success: false,
              message: 'Event not found',
              error: parsed.error
            });
          }
          
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
          console.error('[fetch-full-event] Error parsing file content JSON:', e);
        }
      }
    }
    
    // Timeout - return error
    console.warn('[fetch-full-event] Timeout waiting for file sensor update');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(200).json({
      success: false,
      message: 'Event not found or timeout waiting for file sensor',
      sensor_state: sensorData?.state,
      debug: {
        requested_event_id: event_id,
        file_content: sensorData?.state ? 'present' : 'missing',
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
