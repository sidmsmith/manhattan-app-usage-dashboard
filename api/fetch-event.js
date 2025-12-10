// Vercel serverless function to fetch full event data from Home Assistant
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { start_time, end_time, event_type, app_name, event_name, timestamp } = req.query;

  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'start_time and end_time are required' });
  }

  const HA_URL = process.env.HA_URL;
  const HA_TOKEN = process.env.HA_TOKEN;

  if (!HA_URL || !HA_TOKEN) {
    return res.status(500).json({ error: 'Home Assistant configuration missing' });
  }

  try {
    // First try history API to get full event data with all attributes
    const historyUrl = `${HA_URL}/api/history/period/${start_time}?end_time=${end_time}`;
    
    const historyResponse = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      
      // History API returns array of arrays (one per entity)
      // Flatten and find matching event
      const allEvents = Array.isArray(historyData) ? historyData.flat() : [];
      
      const eventTime = timestamp ? new Date(timestamp) : null;
      
      const matchingEvent = allEvents.find(e => {
        if (!e.attributes) return false;
        
        const attrs = e.attributes;
        const eTime = e.last_changed || e.last_updated;
        
        // Match by event_name and app_name, and timestamp if provided
        const nameMatch = attrs.event_name === event_name || attrs.app_name === app_name;
        let timeMatch = true;
        
        if (eventTime && eTime) {
          const eTimeDate = new Date(eTime);
          const timeDiff = Math.abs(eTimeDate.getTime() - eventTime.getTime());
          timeMatch = timeDiff < 10000; // Within 10 seconds
        }
        
        return nameMatch && timeMatch;
      });
      
      if (matchingEvent && matchingEvent.attributes) {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        return res.status(200).json([matchingEvent]);
      }
    }
    
    // Fallback to logbook API
    const logbookUrl = `${HA_URL}/api/logbook/${start_time}?end_time=${end_time}`;
    
    const logbookResponse = await fetch(logbookUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (logbookResponse.ok) {
      const logbookData = await logbookResponse.json();
      
      // Filter for matching event
      const matchingEvent = logbookData.find(e => {
        const logTime = new Date(e.when);
        const eventTime = timestamp ? new Date(timestamp) : null;
        const timeMatch = eventTime ? Math.abs(logTime.getTime() - eventTime.getTime()) < 10000 : true;
        const nameMatch = e.name === event_name || e.entity_id?.includes(app_name);
        return timeMatch && nameMatch;
      });
      
      if (matchingEvent) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        return res.status(200).json([matchingEvent]);
      }
    }

    // No matching event found
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(200).json([]);
    
  } catch (error) {
    console.error('Error fetching event from HA:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch event data',
      message: error.message 
    });
  }
}

