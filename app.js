// Dashboard Version - Update this with each push to main
const DASHBOARD_VERSION = '0.1.4';

// Configuration
// For Vercel: environment variables are available via process.env
// For local dev: create a config.js file (not committed to git)
const CONFIG = {
  haUrl: window.CONFIG?.HA_URL || '',
  haToken: window.CONFIG?.HA_TOKEN || '',
  refreshInterval: 60000, // 60 seconds
};

// Load config from external file if it exists (for local development)
// This file should be in .gitignore
if (typeof window.CONFIG === 'undefined') {
  const script = document.createElement('script');
  script.src = 'config.js';
  script.onerror = () => {
    console.warn('config.js not found. Using environment variables or defaults.');
    // Try to get from meta tags as fallback
    const metaUrl = document.querySelector('meta[name="ha-url"]');
    const metaToken = document.querySelector('meta[name="ha-token"]');
    if (metaUrl) CONFIG.haUrl = metaUrl.content;
    if (metaToken) CONFIG.haToken = metaToken.content;
  };
  document.head.appendChild(script);
}

// App definitions with display names
const APPS = [
  { id: 'lpn_unlock_app', name: 'LPN Lock / Unlock', icon: '🔓' },
  { id: 'mhe_console', name: 'MHE Console', icon: '🖥️' },
  { id: 'appt_app', name: 'Check In Kiosk', icon: '📅' },
  { id: 'pos_items', name: 'POS Items', icon: '📦' },
  { id: 'driver_pickup', name: 'Driver Pickup', icon: '🚚' },
  { id: 'facility_addresses', name: 'Facility Addresses', icon: '📍' },
  { id: 'forecast_import', name: 'Import Forecast', icon: '📊' },
  { id: 'apps_homepage', name: 'Apps Homepage', icon: '🏠' },
  { id: 'item_generator_gallery', name: 'Item Generator', icon: '🖼️' },
  { id: 'order_generator', name: 'Order Generator', icon: '📋' },
  { id: 'schedule_app', name: 'Schedule Appointment', icon: '📆' },
  { id: 'todolist', name: 'Todo List', icon: '✅' },
  { id: 'update_appt', name: 'Update Appointment', icon: '✏️' },
];

// State
let appData = {};
let sortOrder = 'recent';
let sortableInstance = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Update version in header
  updateVersionDisplay();
  loadSortOrder();
  initializeSortable();
  setupEventListeners();
  setupModalListeners();
  loadDashboardData();
  setInterval(loadDashboardData, CONFIG.refreshInterval);
});

// Update version display in header
function updateVersionDisplay() {
  const versionBadge = document.querySelector('.version-badge');
  if (versionBadge) {
    versionBadge.textContent = `v${DASHBOARD_VERSION}`;
  }
  // Also update page title
  document.title = `Manhattan App Usage Dashboard v${DASHBOARD_VERSION}`;
}

// Load saved sort order from localStorage
function loadSortOrder() {
  const saved = localStorage.getItem('dashboardSortOrder');
  if (saved) {
    sortOrder = saved;
    document.getElementById('sortOrder').value = saved;
  }
}

// Save sort order to localStorage
function saveSortOrder(order) {
  sortOrder = order;
  localStorage.setItem('dashboardSortOrder', order);
}

// Initialize SortableJS for drag and drop
function initializeSortable() {
  const container = document.getElementById('cardsContainer');
  if (container && typeof Sortable !== 'undefined') {
    sortableInstance = new Sortable(container, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd: () => {
        // Save manual order when drag ends
        if (sortOrder === 'manual') {
          saveCardOrder();
        }
      }
    });
  }
}

// Save card order to localStorage
function saveCardOrder() {
  const cards = Array.from(document.querySelectorAll('.app-card'));
  const order = cards.map(card => card.dataset.app);
  localStorage.setItem('dashboardCardOrder', JSON.stringify(order));
}

// Load card order from localStorage
function loadCardOrder() {
  const saved = localStorage.getItem('dashboardCardOrder');
  return saved ? JSON.parse(saved) : null;
}

// Setup event listeners
function setupEventListeners() {
  const sortDropdown = document.getElementById('sortOrder');
  if (sortDropdown) {
    sortDropdown.addEventListener('change', (e) => {
      const newOrder = e.target.value;
      saveSortOrder(newOrder);
      renderCards();
    });
  }
}

// Fetch data from Home Assistant API
async function fetchSensorData(entityId) {
  try {
    let url;
    let options = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // If we have direct HA config (local dev), use it directly
    if (CONFIG.haUrl && CONFIG.haToken) {
      url = `${CONFIG.haUrl}/api/states/${entityId}`;
      options.headers['Authorization'] = `Bearer ${CONFIG.haToken}`;
    } else {
      // Otherwise, use Vercel serverless function (production)
      url = `/api/fetch-sensor?entityId=${encodeURIComponent(entityId)}`;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${entityId}:`, error);
    return null;
  }
}

// Load all dashboard data
async function loadDashboardData() {
  try {
    // Load overall summary
    await loadOverallSummary();

    // Load individual app data
    await loadAppData();

    // Render cards
    renderCards();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('Failed to load dashboard data. Check console for details.');
  }
}

// Load overall summary data
async function loadOverallSummary() {
  const [totalEvents, events24h, totalOpens, recentEvents] = await Promise.all([
    fetchSensorData('sensor.all_apps_total_events'),
    fetchSensorData('sensor.all_apps_events_last_24h'),
    fetchSensorData('sensor.all_apps_total_opens'),
    fetchSensorData('sensor.all_apps_recent_events')
  ]);

  if (totalEvents) {
    document.getElementById('total-events').textContent = totalEvents.state || '0';
  }
  if (events24h) {
    document.getElementById('events-24h').textContent = events24h.state || '0';
  }
  if (totalOpens) {
    document.getElementById('total-opens').textContent = totalOpens.state || '0';
  }
  if (recentEvents && recentEvents.attributes?.events) {
    let events = recentEvents.attributes.events;
    // Parse if it's a JSON string
    if (typeof events === 'string') {
      try {
        events = JSON.parse(events);
      } catch (e) {
        console.error('Failed to parse events JSON:', e);
        events = [];
      }
    }
    renderRecentEvents(Array.isArray(events) ? events : []);
  }
}

// Load data for all apps
async function loadAppData() {
  const promises = APPS.map(async (app) => {
    const [totalEvents, events24h, totalOpens, recentEvents] = await Promise.all([
      fetchSensorData(`sensor.${app.id}_total_events`),
      fetchSensorData(`sensor.${app.id}_events_last_24h`),
      fetchSensorData(`sensor.${app.id}_total_opens`),
      fetchSensorData(`sensor.${app.id}_recent_events`)
    ]);

    // Parse events if it's a JSON string
    let events = recentEvents?.attributes?.events || [];
    if (typeof events === 'string') {
      try {
        events = JSON.parse(events);
      } catch (e) {
        console.error(`Failed to parse events JSON for ${app.id}:`, e);
        events = [];
      }
    }
    // Ensure it's an array
    if (!Array.isArray(events)) {
      events = [];
    }

    return {
      id: app.id,
      name: app.name,
      icon: app.icon,
      totalEvents: totalEvents?.state || '0',
      events24h: events24h?.state || '0',
      totalOpens: totalOpens?.state || '0',
      recentEvents: events
    };
  });

  const results = await Promise.all(promises);
  appData = {};
  results.forEach(app => {
    appData[app.id] = app;
  });
}

// Render recent events in header
function renderRecentEvents(events) {
  if (!Array.isArray(events)) return;

  const col2 = document.getElementById('recent-events-col2');
  const col3 = document.getElementById('recent-events-col3');

  if (!col2 || !col3) return;

  col2.innerHTML = '';
  col3.innerHTML = '';

  // Display first 3 events in column 2
  events.slice(0, 3).forEach(event => {
    const item = createEventItem(event);
    col2.appendChild(item);
  });

  // Display next 5 events (4-8) in column 3
  events.slice(3, 8).forEach(event => {
    const item = createEventItem(event);
    col3.appendChild(item);
  });
}

// Create event item element (for header card - reversed format: App bold, then Event)
function createEventItem(event) {
  const div = document.createElement('div');
  div.className = 'event-item';

  const dt = new Date(event.timestamp);
  const mmdd = `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

  // Store full event data for modal
  div.dataset.eventData = JSON.stringify(event);

  // Add click handler to open modal
  div.addEventListener('click', () => {
    openEventModal(event);
  });

  const appShort = getAppShortName(event.app_name);
  const eventName = event.event_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const org = event.org || 'N/A';

  // Header card format: App (bold) || Event
  div.innerHTML = `• <strong>${appShort}</strong> — ${eventName} — ${mmdd} ${time} — ${org}`;
  return div;
}

// Get short app name
function getAppShortName(appName) {
  const mapping = {
    'lpn-unlock-app': 'LPN',
    'mhe-console': 'MHE',
    'appt-app': 'APPT',
    'appt_app': 'APPT',
    'POS Items': 'POS',
    'driver-pickup': 'Driver',
    'driver_pickup': 'Driver',
    'Driver Pickup': 'Driver',
    'facility-addresses': 'Facility',
    'facility_addresses': 'Facility',
    'Facility Addresses': 'Facility',
    'Import Forecast': 'Forecast',
    'apps-homepage': 'Homepage',
    'item-generator-gallery': 'Item Gen',
    'Item Generator': 'Item Gen',
    'order-generator-app': 'Order Gen',
    'Order Generator': 'Order Gen',
    'schedule-app': 'Schedule',
    'todolist': 'Todo',
    'update-appt': 'Update Appt'
  };
  return mapping[appName] || appName;
}

// Sort apps based on current sort order
function sortApps(apps) {
  const sorted = [...apps];

  switch (sortOrder) {
    case 'recent':
      sorted.sort((a, b) => {
        const aTime = getMostRecentEventTime(a);
        const bTime = getMostRecentEventTime(b);
        return bTime - aTime; // Most recent first
      });
      break;

    case '24h':
      sorted.sort((a, b) => {
        return parseInt(b.events24h) - parseInt(a.events24h);
      });
      break;

    case 'events':
      sorted.sort((a, b) => {
        return parseInt(b.totalEvents) - parseInt(a.totalEvents);
      });
      break;

    case 'opens':
      sorted.sort((a, b) => {
        return parseInt(b.totalOpens) - parseInt(a.totalOpens);
      });
      break;

    case 'alphabetical':
      sorted.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      break;

    case 'manual':
      const savedOrder = loadCardOrder();
      if (savedOrder) {
        sorted.sort((a, b) => {
          const aIndex = savedOrder.indexOf(a.id);
          const bIndex = savedOrder.indexOf(b.id);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
      break;
  }

  return sorted;
}

// Get most recent event timestamp for an app
function getMostRecentEventTime(app) {
  if (!app.recentEvents || app.recentEvents.length === 0) return 0;
  const latest = app.recentEvents[0];
  return new Date(latest.timestamp).getTime();
}

// Render all app cards
function renderCards() {
  const container = document.getElementById('cardsContainer');
  if (!container) return;

  const apps = Object.values(appData);
  const sortedApps = sortApps(apps);

  container.innerHTML = '';

  sortedApps.forEach(app => {
    const card = createAppCard(app);
    container.appendChild(card);
  });

  // Reinitialize SortableJS after rendering
  if (sortOrder === 'manual') {
    initializeSortable();
  }
}

// Create app card element
function createAppCard(app) {
  const card = document.createElement('div');
  card.className = 'app-card';
  card.dataset.app = app.id;

  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = '⋮⋮';
  dragHandle.title = 'Drag to reorder';

  const header = document.createElement('div');
  header.className = 'app-card-header';
  header.textContent = `${app.icon || ''} ${app.name}`;

  const metrics = document.createElement('div');
  metrics.className = 'app-metrics';
  metrics.innerHTML = `
    <div class="app-metric">
      <div class="app-metric-label">Total Events</div>
      <div class="app-metric-value">${app.totalEvents}</div>
    </div>
    <div class="app-metric">
      <div class="app-metric-label">Last 24 Hrs</div>
      <div class="app-metric-value">${app.events24h}</div>
    </div>
    <div class="app-metric">
      <div class="app-metric-label">Total Opens</div>
      <div class="app-metric-value">${app.totalOpens}</div>
    </div>
  `;

  const recentEvents = document.createElement('div');
  recentEvents.className = 'app-recent-events';
  recentEvents.innerHTML = '<h3>Recent Events</h3>';

  const eventsList = document.createElement('div');
  eventsList.className = 'app-events-list';

  if (app.recentEvents && Array.isArray(app.recentEvents) && app.recentEvents.length > 0) {
    // Show all events but limit visible height with scrolling
    app.recentEvents.forEach(event => {
      const item = createAppEventItem(event);
      eventsList.appendChild(item);
    });
  } else {
    eventsList.innerHTML = '<div class="app-event-item">No recent events found.</div>';
  }

  recentEvents.appendChild(eventsList);

  card.appendChild(dragHandle);
  card.appendChild(header);
  card.appendChild(metrics);
  card.appendChild(recentEvents);

  return card;
}

// Create app event item
function createAppEventItem(event) {
  const div = document.createElement('div');
  div.className = 'app-event-item';

  const dt = new Date(event.timestamp);
  const mmdd = `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

  // Calculate days since event (date only, not time)
  const today = new Date();
  const eventDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysDiff = Math.floor((todayDate - eventDate) / (1000 * 60 * 60 * 24));
  
  // Add class for events older than 3 days
  if (daysDiff > 3) {
    div.classList.add('event-old');
  }

  // Store full event data for modal
  div.dataset.eventData = JSON.stringify(event);

  // Add click handler to open modal
  div.addEventListener('click', () => {
    openEventModal(event);
  });

  const eventName = event.event_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const org = event.org || 'N/A';

  div.innerHTML = `• <strong>${eventName}</strong> — ${mmdd} ${time} — ${org}`;
  return div;
}

// Show error message
function showError(message) {
  const container = document.getElementById('cardsContainer');
  if (container) {
    container.innerHTML = `<div class="loading-message" style="color: red;">${message}</div>`;
  }
}

// Open event modal with event data
async function openEventModal(event) {
  const modal = document.getElementById('eventModal');
  const modalBody = document.getElementById('eventModalBody');
  
  if (!modal || !modalBody) return;

  // Show loading state
  modalBody.innerHTML = '<div class="event-json-viewer">Loading full event data...</div>';
  modal.classList.add('show');
  
  try {
    // Fetch full event data from HA
    const fullEventData = await fetchFullEventData(event);
    
    // Format and display the event data
    const formattedJson = formatEventJson(fullEventData || event);
    modalBody.innerHTML = `<div class="event-json-viewer">${formattedJson}</div>`;
  } catch (error) {
    console.error('Error fetching full event data:', error);
    // Fallback to displaying the event data we have
    const formattedJson = formatEventJson(event);
    modalBody.innerHTML = `<div class="event-json-viewer">${formattedJson}<br/><br/><em>Note: Could not fetch full event data from HA. Showing available data.</em></div>`;
  }
  
  // Close on background click
  modal.addEventListener('click', function closeOnBackground(e) {
    if (e.target === modal) {
      closeEventModal();
      modal.removeEventListener('click', closeOnBackground);
    }
  });
}

// Close event modal
function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Fetch full event data from Home Assistant
// Uses the Python script service to query the database for full event data
async function fetchFullEventData(event) {
  try {
    const timestamp = event.timestamp;
    const event_name = event.event_name;
    const app_name = event.app_name;
    
    if (!timestamp) {
      console.warn('No timestamp in event, cannot fetch full data');
      return event;
    }
    
    // Build URL for calling the Python script service
    let url;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timestamp: timestamp,
        event_name: event_name,
        app_name: app_name
      })
    };

    // If we have direct HA config (local dev), use it directly
    if (CONFIG.haUrl && CONFIG.haToken) {
      url = `${CONFIG.haUrl}/api/services/python_script/get_full_event_data`;
      options.headers['Authorization'] = `Bearer ${CONFIG.haToken}`;
      
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // After calling the service, wait a moment for the sensor to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now read the result from the sensor
      const sensorUrl = `${CONFIG.haUrl}/api/states/sensor.full_event_data_result`;
      
      const sensorResponse = await fetch(sensorUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONFIG.haToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (sensorResponse.ok) {
        const sensorData = await sensorResponse.json();
        const rawData = sensorData.attributes?.raw_data;
        const fullDataJson = sensorData.attributes?.full_data_json;
        
        if (rawData && typeof rawData === 'object') {
          // We have the full event data!
          return {
            event_type: 'app_usage_event',
            data: rawData,
            origin: 'LOCAL',
            time_fired: timestamp,
            context: {},
            ...rawData,
            _source: 'database_query',
            _event_id: sensorData.attributes?.event_id
          };
        } else if (fullDataJson) {
          // Parse JSON string if needed
          try {
            const parsed = typeof fullDataJson === 'string' ? JSON.parse(fullDataJson) : fullDataJson;
            return {
              event_type: 'app_usage_event',
              data: parsed,
              origin: 'LOCAL',
              time_fired: timestamp,
              context: {},
              ...parsed,
              _source: 'database_query_json'
            };
          } catch (e) {
            console.error('Error parsing full_data_json:', e);
          }
        }
      }
    } else {
      // Use Vercel serverless function (production)
      // The serverless function will handle both the service call and sensor read
      url = `/api/fetch-full-event?timestamp=${encodeURIComponent(timestamp)}`;
      if (event_name) url += `&event_name=${encodeURIComponent(event_name)}`;
      if (app_name) url += `&app_name=${encodeURIComponent(app_name)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return {
            event_type: 'app_usage_event',
            data: result.data,
            origin: 'LOCAL',
            time_fired: timestamp,
            context: {},
            ...result.data,
            _source: 'database_query',
            _event_id: result.event_id
          };
        }
      }
    }
    
    // Fallback: return what we have
    console.warn('Could not fetch full event data from database, using available fields');
    return {
      event_type: 'app_usage_event',
      data: event,
      origin: 'LOCAL',
      time_fired: timestamp,
      context: {},
      ...event,
      _source: 'sensor_data_fallback',
      _note: 'Full event data query failed or not configured. Showing available fields only.'
    };
    
  } catch (error) {
    console.error('Error fetching full event data:', error);
    // Return the event we have as fallback
    return {
      event_type: 'app_usage_event',
      data: event,
      origin: 'LOCAL',
      time_fired: event.timestamp,
      context: {},
      ...event,
      _source: 'sensor_data_error',
      _error: error.message
    };
  }
}

// Format event JSON for display - show ALL fields including nested data
function formatEventJson(event) {
  // Deep clone to avoid modifying original
  const eventCopy = JSON.parse(JSON.stringify(event));
  
  // Recursively collect ALL fields, including nested objects
  const collectAllFields = (obj, prefix = '') => {
    const result = {};
    
    for (const key in obj) {
      if (key.startsWith('_')) continue; // Skip internal metadata fields for now
      
      const value = obj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        result[fullKey] = value;
      } else if (Array.isArray(value)) {
        result[fullKey] = value;
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        // Recursively process nested objects, but also include the object itself
        const nested = collectAllFields(value, fullKey);
        Object.assign(result, nested);
        // Also keep the object at this level for structure
        result[fullKey] = value;
      } else {
        result[fullKey] = value;
      }
    }
    
    return result;
  };
  
  // Collect all fields
  const allFields = collectAllFields(eventCopy);
  
  // Create structured output showing the full event
  const structuredEvent = {
    // Event metadata
    event_type: 'app_usage_event',
    origin: event.origin || 'LOCAL',
    time_fired: event.timestamp || event.time_fired,
    context: event.context || {},
    
    // All data fields (flattened and structured)
    data: allFields,
    
    // Also include original structure for reference
    _original_structure: eventCopy
  };
  
  // Create a nicely formatted JSON string
  const formatted = JSON.stringify(structuredEvent, null, 2);
  
  // Apply syntax highlighting
  return formatted
    .replace(/("[\w]+"):/g, '<span class="event-json-key">$1</span>:')
    .replace(/: ("[^"]*")/g, ': <span class="event-json-string">$1</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="event-json-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="event-json-boolean">$1</span>')
    .replace(/: null/g, ': <span class="event-json-null">null</span>');
}

// Setup modal listeners
function setupModalListeners() {
  const closeBtn = document.getElementById('eventModalClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEventModal);
  }
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEventModal();
    }
  });
}
