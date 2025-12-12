// Dashboard Version - Update this with each push to main
const DASHBOARD_VERSION = '2.0.2';

// Configuration
// For Vercel: environment variables are available via process.env
// For local dev: create a config.js file (not committed to git)
const CONFIG = {
  haUrl: window.CONFIG?.HA_URL || '',
  haToken: window.CONFIG?.HA_TOKEN || '',
  refreshInterval: 60000, // 60 seconds
  useNeon: window.CONFIG?.USE_NEON !== false, // Default to true if not specified
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
// neonAppName: Maps dashboard app.id to actual app_name in Neon database
const APPS = [
  { id: 'lpn_unlock_app', name: 'LPN Lock / Unlock', icon: '🔓', neonAppName: 'lpn-unlock-app' },
  { id: 'mhe_console', name: 'MHE Console', icon: '🖥️', neonAppName: 'mhe-console' },
  { id: 'appt_app', name: 'Check In Kiosk', icon: '📅', neonAppName: 'appt-app' },
  { id: 'pos_items', name: 'POS Items', icon: '📦', neonAppName: 'POS Items' },
  { id: 'driver_pickup', name: 'Driver Pickup', icon: '🚚', neonAppName: 'driver-pickup' },
  { id: 'facility_addresses', name: 'Facility Addresses', icon: '📍', neonAppName: 'facility-addresses' },
  { id: 'forecast_import', name: 'Import Forecast', icon: '📊', neonAppName: 'Import Forecast' },
  { id: 'apps_homepage', name: 'Apps Homepage', icon: '🏠', neonAppName: 'apps-homepage' },
  { id: 'item_generator_gallery', name: 'Item Generator', icon: '🖼️', neonAppName: 'Item Generator' },
  { id: 'order_generator', name: 'Order Generator', icon: '📋', neonAppName: 'Order Generator' },
  { id: 'schedule_app', name: 'Schedule Appointment', icon: '📆', neonAppName: 'schedule-app' },
  { id: 'todolist', name: 'Todo List', icon: '✅', neonAppName: 'todolist' },
  { id: 'update_appt', name: 'Update Appointment', icon: '✏️', neonAppName: 'update-appt' },
];

// State
let appData = {};
let sortOrder = 'recent';
let sortableInstance = null;

// Client-side cache for API responses (30 second TTL)
const CACHE_TTL = 30000; // 30 seconds in milliseconds
const apiCache = {
  // Cache structure: { key: { data: {...}, timestamp: number } }
  get(key) {
    const cached = this._cache[key];
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
      // Cache expired
      delete this._cache[key];
      return null;
    }
    
    return cached.data;
  },
  
  set(key, data) {
    this._cache[key] = {
      data: data,
      timestamp: Date.now()
    };
  },
  
  clear() {
    this._cache = {};
  },
  
  _cache: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Update version in header
  updateVersionDisplay();
  loadSortOrder();
  initializeSortable();
  setupEventListeners();
  initializeModal(); // Initialize modal functionality
  loadDashboardData();
  // Auto-refresh every 60 seconds (cache will be used if still valid)
  setInterval(() => loadDashboardData(false), CONFIG.refreshInterval);
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

// Fetch data from Neon PostgreSQL (cloud database)
// The serverless function connects directly to Neon PostgreSQL
// Uses client-side caching (30 second TTL) to reduce API calls
async function fetchNeonData(query, params = {}) {
  if (!CONFIG.useNeon) {
    return null;
  }

  // Create cache key from query and params
  const cacheKey = `neon:${query}:${JSON.stringify(params)}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    const queryParams = new URLSearchParams({ query, ...params });
    const url = `/api/fetch-neon?${queryParams.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in cache
    apiCache.set(cacheKey, data);
    
    return data;
  } catch (error) {
    // Neon fetch failed, falling back to SQL sensors (error logged silently)
    return null; // Return null on error, allowing fallback to SQL sensors
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
// forceRefresh: if true, clears cache before loading (for manual refresh)
async function loadDashboardData(forceRefresh = false) {
  try {
    // Clear cache if force refresh is requested
    if (forceRefresh) {
      apiCache.clear();
    }
    
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
  // Hybrid approach
  // - Use SQL sensors for summary stats
  // - Try Neon first for recent events (full JSON), fallback to SQL sensor
  
  // Fetch summary stats from SQL sensors (always use these for now)
  const [totalEvents, events24h, totalOpens] = await Promise.all([
    fetchSensorData('sensor.all_apps_total_events'),
    fetchSensorData('sensor.all_apps_events_last_24h'),
    fetchSensorData('sensor.all_apps_total_opens')
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

    // Try Neon for recent events (all apps, full JSON), fallback to SQL sensor
    let events = [];
    const neonData = await fetchNeonData('recent-events', { limit: '15' });
    
    if (neonData && neonData.events && Array.isArray(neonData.events)) {
      // Use Neon data - convert to expected format
      events = neonData.events.map(event => ({
        event_name: event.event_name,
        timestamp: event.timestamp,
        org: event.org,
        app_name: event.app_name,
        id: event.id, // Neon ID - should always be present
        event_data: event.event_data // Full JSON data available!
      }));
      console.log('[loadOverallSummary] Using Neon data for recent events:', events.length);
      // Debug: check if any events are missing id
      const eventsWithoutId = events.filter(e => !e.id);
      if (eventsWithoutId.length > 0) {
        console.warn('[loadOverallSummary] Some events missing id:', eventsWithoutId.length, 'out of', events.length);
        console.warn('[loadOverallSummary] Sample event without id:', eventsWithoutId[0]);
      }
    } else {
    // Fallback to SQL sensor
    const recentEvents = await fetchSensorData('sensor.all_apps_recent_events');
    
    // Parse events from attributes.events (JSON string) - state is "unknown" due to 255 char limit
    if (recentEvents?.attributes?.events) {
      const eventsData = recentEvents.attributes.events;
      if (typeof eventsData === 'string') {
        try {
          events = JSON.parse(eventsData);
        } catch (e) {
          console.error('Failed to parse events JSON:', e);
          events = [];
        }
      } else if (Array.isArray(eventsData)) {
        events = eventsData;
      }
      
      // SQL sensor events may have event_id instead of id - try to map it
      // But note: SQL sensor events won't be clickable since they don't have Neon id
      events = events.map(event => ({
        ...event,
        id: event.id || event.event_id || null // Try to use id, fallback to event_id, or null
      }));
      
      console.warn('[loadOverallSummary] Using SQL sensor fallback - events may not have Neon id');
    }
    // Using SQL sensor data (Neon unavailable - fallback mode)
  }
  
  if (!Array.isArray(events)) {
    events = [];
  }
  renderRecentEvents(events);
}

// Load data for all apps
// Uses query batching: fetches all events in one query, then groups by app
async function loadAppData() {
  // Step 1: Fetch all recent events in one batch query (enough for all apps)
  // We fetch 200 events to ensure we have enough for all apps (13 apps * 15 events = 195 max)
  let allEvents = [];
  const neonData = await fetchNeonData('recent-events', { limit: '200' });
  
  if (neonData && neonData.events && Array.isArray(neonData.events)) {
    // Convert to expected format
    allEvents = neonData.events.map(event => ({
      event_name: event.event_name,
      timestamp: event.timestamp,
      org: event.org,
      app_name: event.app_name,
      id: event.id,
      event_data: event.event_data
    }));
  }
  
  // Step 2: Group events by app_name for efficient lookup
  const eventsByApp = {};
  allEvents.forEach(event => {
    const appName = event.app_name;
    if (!eventsByApp[appName]) {
      eventsByApp[appName] = [];
    }
    eventsByApp[appName].push(event);
  });
  
  // Step 3: Process each app (fetch stats + get recent events from grouped data)
  const promises = APPS.map(async (app) => {
    // Use neonAppName if defined, otherwise convert app.id
    const appName = app.neonAppName || app.id.replace(/_/g, '-');
    
    // Fetch summary stats from SQL sensors (always use these for now)
    const [totalEvents, events24h, totalOpens] = await Promise.all([
      fetchSensorData(`sensor.${app.id}_total_events`),
      fetchSensorData(`sensor.${app.id}_events_last_24h`),
      fetchSensorData(`sensor.${app.id}_total_opens`)
    ]);

    // Get recent events from batched query (already grouped by app_name)
    let events = [];
    if (eventsByApp[appName] && Array.isArray(eventsByApp[appName])) {
      // Take top 15 events for this app (already sorted by timestamp DESC from query)
      events = eventsByApp[appName].slice(0, 15);
    } else {
      // Fallback: if Neon query failed or app not found, try SQL sensor
      const recentEvents = await fetchSensorData(`sensor.${app.id}_recent_events`);
      
      if (recentEvents?.attributes?.events) {
        const eventsData = recentEvents.attributes.events;
        if (typeof eventsData === 'string') {
          try {
            events = JSON.parse(eventsData);
          } catch (e) {
            console.error(`Failed to parse events JSON for ${app.id}:`, e);
            events = [];
          }
        } else if (Array.isArray(eventsData)) {
          events = eventsData;
        }
      }
    }
    
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

// Convert UTC timestamp to local time (24-hour format)
function formatLocalTime(utcTimestamp) {
  // Ensure timestamp is treated as UTC (add Z if not present, or parse as ISO)
  let timestamp = utcTimestamp;
  if (!timestamp.endsWith('Z') && !timestamp.includes('+') && !timestamp.includes('-', 10)) {
    // If no timezone indicator, assume it's UTC and add Z
    timestamp = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  }
  
  // Parse as UTC and convert to local time
  const dt = new Date(timestamp);
  
  // Verify it's a valid date
  if (isNaN(dt.getTime())) {
    console.warn('[formatLocalTime] Invalid timestamp:', utcTimestamp);
    // Fallback: try parsing without Z
    const dtFallback = new Date(utcTimestamp);
    if (!isNaN(dtFallback.getTime())) {
      const mmdd = `${String(dtFallback.getMonth() + 1).padStart(2, '0')}/${String(dtFallback.getDate()).padStart(2, '0')}`;
      const time = `${String(dtFallback.getHours()).padStart(2, '0')}:${String(dtFallback.getMinutes()).padStart(2, '0')}`;
      return { mmdd, time };
    }
    return { mmdd: '??/??', time: '??:??' };
  }
  
  const mmdd = `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  
  // Removed verbose logging - time conversion is working correctly
  return { mmdd, time };
}

// Create event item element (for header card - reversed format: App bold, then Event)
function createEventItem(event) {
  const div = document.createElement('div');
  div.className = 'event-item';
  
  // Debug: log event to see if id is present
  if (!event.id) {
    console.warn('[createEventItem] Event missing id:', event);
  }
  
  div.dataset.eventId = event.id || '';
  div.dataset.appName = event.app_name || '';
  div.dataset.context = 'summary'; // Context: summary or app-specific

  // Convert UTC to local time
  const { mmdd, time } = formatLocalTime(event.timestamp);

  const appShort = getAppShortName(event.app_name);
  const eventName = event.event_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const org = event.org || 'N/A';

  // Header card format: App (bold) || Event
  div.innerHTML = `• <strong>${appShort}</strong> — ${eventName} — ${mmdd} ${time} — ${org}`;
  
  // Add click handler for modal (only if event.id exists)
  if (event.id) {
    div.addEventListener('click', () => openEventModal(event.id, 'summary', event.app_name));
    div.style.cursor = 'pointer'; // Visual indicator
  } else {
    console.warn('[createEventItem] Skipping click handler - no id for event:', event.event_name, event.app_name);
    div.style.cursor = 'default';
  }
  
  return div;
}

// Get human-readable app display name (for modal header)
function getAppDisplayName(appName) {
  if (!appName) return 'Unknown App';
  
  // Find matching app from APPS array
  const app = APPS.find(a => 
    a.neonAppName === appName || 
    a.id.replace(/_/g, '-') === appName ||
    a.name === appName
  );
  
  return app ? app.name : appName;
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
    'order-generator': 'Order Gen',
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
  div.dataset.eventId = event.id;
  div.dataset.appName = event.app_name || '';
  div.dataset.context = 'app'; // Context: app-specific navigation

  // Convert UTC to local time
  const { mmdd, time } = formatLocalTime(event.timestamp);
  const dt = new Date(event.timestamp);

  // Calculate days since event (date only, not time)
  const today = new Date();
  const eventDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysDiff = Math.floor((todayDate - eventDate) / (1000 * 60 * 60 * 24));
  
  // Add class for events older than 3 days
  if (daysDiff > 3) {
    div.classList.add('event-old');
  }

  const eventName = event.event_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const org = event.org || 'N/A';

  div.innerHTML = `• <strong>${eventName}</strong> — ${mmdd} ${time} — ${org}`;
  
  // Add click handler for modal (only if event.id exists)
  if (event.id) {
    div.addEventListener('click', () => openEventModal(event.id, 'app', event.app_name));
  }
  
  return div;
}

// Show error message
function showError(message) {
  const container = document.getElementById('cardsContainer');
  if (container) {
    container.innerHTML = `<div class="loading-message" style="color: red;">${message}</div>`;
  }
}

// Modal state management
let modalState = {
  currentId: null,
  context: null, // 'summary' or 'app'
  appName: null, // For app-specific navigation
  prevId: null,
  nextId: null,
  prevData: null,
  nextData: null
};

// Open event modal
async function openEventModal(eventId, context, appName = null) {
  const modal = document.getElementById('eventModal');
  const modalBody = document.getElementById('modalBody');
  
  // Set modal state
  modalState.currentId = eventId;
  modalState.context = context;
  modalState.appName = appName;
  
  // Show modal with loading state
  modal.style.display = 'flex';
  modalBody.innerHTML = '<div class="modal-loading">Loading event details...</div>';
  
  // Hide navigation buttons initially
  document.getElementById('modalPrevBtn').style.display = 'none';
  document.getElementById('modalNextBtn').style.display = 'none';
  
  try {
    // Fetch current event details
    const eventData = await fetchEventDetails(eventId);
    
    if (eventData.error) {
      modalBody.innerHTML = `<div class="modal-loading" style="color: red;">Error: ${eventData.error}</div>`;
      return;
    }
    
    // Update modal header with app name
    const modalHeader = document.querySelector('.modal-header h2');
    if (modalHeader && eventData.app_name) {
      const appDisplayName = getAppDisplayName(eventData.app_name);
      modalHeader.textContent = `Event Details: ${appDisplayName}`;
    }
    
    // Display event data
    displayEventInModal(eventData);
    
    // Pre-load previous and next events
    await preloadNavigationEvents(eventId, context, appName);
    
    // Update navigation buttons
    updateNavigationButtons();
    
  } catch (error) {
    console.error('Error loading event details:', error);
    modalBody.innerHTML = `<div class="modal-loading" style="color: red;">Error loading event details</div>`;
  }
}

// Fetch event details from Neon
async function fetchEventDetails(eventId) {
  try {
    const response = await fetch(`/api/fetch-neon?query=event-details&id=${eventId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching event details:', error);
    return { error: error.message };
  }
}

// Fetch navigation event ID (prev/next)
async function fetchNavigationId(currentId, direction, appName = null) {
  try {
    const params = new URLSearchParams({
      query: 'event-navigation',
      id: currentId,
      direction: direction
    });
    if (appName) {
      params.append('app_name', appName);
    }
    
    const response = await fetch(`/api/fetch-neon?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.id; // Returns null if no next/prev event
  } catch (error) {
    console.error(`Error fetching ${direction} event ID:`, error);
    return null;
  }
}

// Pre-load previous and next events
async function preloadNavigationEvents(currentId, context, appName) {
  const appNameForNav = context === 'app' ? appName : null;
  
  // Fetch prev/next IDs
  const [prevId, nextId] = await Promise.all([
    fetchNavigationId(currentId, 'prev', appNameForNav),
    fetchNavigationId(currentId, 'next', appNameForNav)
  ]);
  
  modalState.prevId = prevId;
  modalState.nextId = nextId;
  
  // Pre-load event data for prev/next
  const loadPromises = [];
  if (prevId) {
    loadPromises.push(
      fetchEventDetails(prevId).then(data => {
        modalState.prevData = data;
      }).catch(err => {
        console.error('Error pre-loading prev event:', err);
        modalState.prevData = null;
      })
    );
  }
  if (nextId) {
    loadPromises.push(
      fetchEventDetails(nextId).then(data => {
        modalState.nextData = data;
      }).catch(err => {
        console.error('Error pre-loading next event:', err);
        modalState.nextData = null;
      })
    );
  }
  
  await Promise.all(loadPromises);
}

// Display event data in modal
function displayEventInModal(eventData) {
  const modalBody = document.getElementById('modalBody');
  
  // Format event data as pretty JSON
  const eventJson = JSON.stringify(eventData, null, 2);
  
  // Build HTML
  let html = '<div class="modal-event-info">';
  html += `<div class="modal-event-info-item"><span class="modal-event-info-label">ID:</span> <span class="modal-event-info-value">${eventData.id || 'N/A'}</span></div>`;
  html += `<div class="modal-event-info-item"><span class="modal-event-info-label">App Name:</span> <span class="modal-event-info-value">${eventData.app_name || 'N/A'}</span></div>`;
  html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Event Name:</span> <span class="modal-event-info-value">${eventData.event_name || 'N/A'}</span></div>`;
  html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Organization:</span> <span class="modal-event-info-value">${eventData.org || 'N/A'}</span></div>`;
  html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Timestamp:</span> <span class="modal-event-info-value">${eventData.timestamp || 'N/A'}</span></div>`;
  if (eventData.created_at) {
    html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Created At:</span> <span class="modal-event-info-value">${eventData.created_at}</span></div>`;
  }
  if (eventData.updated_at) {
    html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Updated At:</span> <span class="modal-event-info-value">${eventData.updated_at}</span></div>`;
  }
  html += '</div>';
  
  html += '<div class="modal-json">' + escapeHtml(eventJson) + '</div>';
  
  modalBody.innerHTML = html;
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update navigation buttons visibility
function updateNavigationButtons() {
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');
  
  prevBtn.style.display = modalState.prevId ? 'flex' : 'none';
  nextBtn.style.display = modalState.nextId ? 'flex' : 'none';
  
  prevBtn.disabled = !modalState.prevId;
  nextBtn.disabled = !modalState.nextId;
}

// Navigate to previous event
async function navigateToPrev() {
  if (!modalState.prevId) return;
  
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = '<div class="modal-loading">Loading previous event...</div>';
  
  // Use pre-loaded data if available, otherwise fetch
  let eventData = modalState.prevData;
  if (!eventData) {
    eventData = await fetchEventDetails(modalState.prevId);
  }
  
  if (eventData.error) {
    modalBody.innerHTML = `<div class="modal-loading" style="color: red;">Error: ${eventData.error}</div>`;
    return;
  }
  
  // Update state
  modalState.currentId = modalState.prevId;
  const oldNextId = modalState.nextId;
  modalState.nextId = modalState.currentId; // Current becomes next
  
  // Update modal header with app name
  const modalHeader = document.querySelector('.modal-header h2');
  if (modalHeader && eventData.app_name) {
    const appDisplayName = getAppDisplayName(eventData.app_name);
    modalHeader.textContent = `Event Details: ${appDisplayName}`;
  }
  
  // Display event
  displayEventInModal(eventData);
  
  // Pre-load new previous event
  const newPrevId = await fetchNavigationId(modalState.currentId, 'prev', modalState.appName);
  modalState.prevId = newPrevId;
  
  // Pre-load new previous event data
  if (newPrevId) {
    fetchEventDetails(newPrevId).then(data => {
      modalState.prevData = data;
    }).catch(err => {
      console.error('Error pre-loading prev event:', err);
      modalState.prevData = null;
    });
  } else {
    modalState.prevData = null;
  }
  
  // Keep next data (was current, now next)
  modalState.nextData = eventData;
  
  // Update buttons
  updateNavigationButtons();
}

// Navigate to next event
async function navigateToNext() {
  if (!modalState.nextId) return;
  
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = '<div class="modal-loading">Loading next event...</div>';
  
  // Use pre-loaded data if available, otherwise fetch
  let eventData = modalState.nextData;
  if (!eventData) {
    eventData = await fetchEventDetails(modalState.nextId);
  }
  
  if (eventData.error) {
    modalBody.innerHTML = `<div class="modal-loading" style="color: red;">Error: ${eventData.error}</div>`;
    return;
  }
  
  // Update state
  modalState.currentId = modalState.nextId;
  const oldPrevId = modalState.prevId;
  modalState.prevId = modalState.currentId; // Current becomes prev
  
  // Update modal header with app name
  const modalHeader = document.querySelector('.modal-header h2');
  const appDisplayName = getAppDisplayName(eventData.app_name);
  modalHeader.textContent = `Event Details: ${appDisplayName}`;
  
  // Display event
  displayEventInModal(eventData);
  
  // Pre-load new next event
  const newNextId = await fetchNavigationId(modalState.currentId, 'next', modalState.appName);
  modalState.nextId = newNextId;
  
  // Pre-load new next event data
  if (newNextId) {
    fetchEventDetails(newNextId).then(data => {
      modalState.nextData = data;
    }).catch(err => {
      console.error('Error pre-loading next event:', err);
      modalState.nextData = null;
    });
  } else {
    modalState.nextData = null;
  }
  
  // Keep prev data (was current, now prev)
  modalState.prevData = eventData;
  
  // Update buttons
  updateNavigationButtons();
}

// Close modal
function closeEventModal() {
  const modal = document.getElementById('eventModal');
  modal.style.display = 'none';
  modalState = {
    currentId: null,
    context: null,
    appName: null,
    prevId: null,
    nextId: null,
    prevData: null,
    nextData: null
  };
}

// Initialize modal event listeners
function initializeModal() {
  const modal = document.getElementById('eventModal');
  const closeBtn = document.querySelector('.modal-close');
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');
  const overlay = document.querySelector('.modal-overlay');
  
  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEventModal);
  }
  
  // Overlay click
  if (overlay) {
    overlay.addEventListener('click', closeEventModal);
  }
  
  // Navigation buttons
  if (prevBtn) {
    prevBtn.addEventListener('click', navigateToPrev);
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', navigateToNext);
  }
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeEventModal();
    }
  });
}

