// Vercel serverless function to call HA Python script service and fetch full event data
export default async function (req, res) {
  // Only allow GET requests (parameters passed as query string)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event_id, timestamp, event_name, app_name } = req.query;

  if (!event_id && !timestamp) {
    return res.status(400).json({ error: 'event_id or timestamp is required' });
  }

  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return res.status(500).json({ error: 'Home Assistant configuration missing' });
  }

  try {
    // Step 1: Call the Python script service
    const serviceUrl = `${HA_URL}/api/services/python_script/get_full_event_data`;
    
    const serviceResponse = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_id: event_id || null,
        timestamp: timestamp || null,
        event_name: event_name || null,
        app_name: app_name || null
      })
    });

    if (!serviceResponse.ok) {
      throw new Error(`HA service call failed: ${serviceResponse.status} ${serviceResponse.statusText}`);
    }

    // Step 2: Wait a moment for the sensor to update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Read the result from the sensor
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

    const sensorData = await sensorResponse.json();
    
    // Extract the full event data - Python script returns shared_data as JSON string
    const sharedData = sensorData.attributes?.shared_data;
    
    let fullEventData = null;
    
    if (sharedData) {
      try {
        // Parse the JSON string from Python script
        fullEventData = typeof sharedData === 'string' ? JSON.parse(sharedData) : sharedData;
      } catch (e) {
        console.error('Error parsing shared_data JSON:', e);
        // Fallback to raw_data if available
        const rawData = sensorData.attributes?.raw_data;
        if (rawData && typeof rawData === 'object') {
          fullEventData = rawData;
        }
      }
    } else {
      // Fallback to raw_data or full_data_json
      const rawData = sensorData.attributes?.raw_data;
      const fullDataJson = sensorData.attributes?.full_data_json;
      
      if (rawData && typeof rawData === 'object') {
        fullEventData = rawData;
      } else if (fullDataJson) {
        try {
          fullEventData = typeof fullDataJson === 'string' ? JSON.parse(fullDataJson) : fullDataJson;
        } catch (e) {
          console.error('Error parsing full_data_json:', e);
        }
      }
    }
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (fullEventData) {
      return res.status(200).json({
        success: true,
        data: fullEventData,
        event_id: sensorData.attributes?.event_id,
        timestamp: sensorData.attributes?.timestamp
      });
    } else {
      // Return more debugging info
      return res.status(200).json({
        success: false,
        message: 'Event not found',
        sensor_state: sensorData.state,
        attributes: sensorData.attributes,
        debug: {
          requested_event_id: event_id,
          requested_timestamp: timestamp,
          requested_event_name: event_name,
          requested_app_name: app_name,
          sensor_event_id: sensorData.attributes?.event_id,
          sensor_timestamp: sensorData.attributes?.timestamp,
          sensor_event_name: sensorData.attributes?.event_name,
          sensor_app_name: sensorData.attributes?.app_name,
          error: sensorData.attributes?.error
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching full event data:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch full event data',
      message: error.message 
    });
  }
}
