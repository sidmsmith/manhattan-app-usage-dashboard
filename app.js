// Dashboard Version - Update this with each push to main
const DASHBOARD_VERSION = '2.5.1';

// Optional config.js loads before this script if present (local overrides).
const CONFIG = {
  refreshInterval: 60000,
};

if (typeof window.CONFIG === 'undefined') {
  const script = document.createElement('script');
  script.src = 'config.js';
  script.onerror = () => {};
  document.head.appendChild(script);
}

// App definitions with display names
// neonAppName: Maps dashboard app.id to actual app_name in Neon database
//
// Usage events (Neon ingest; each app sets MANHATTAN_USAGE_INGEST_URL on Vercel):
// - item-generator-gallery: app_opened; auth_*; generate_items_*; gallery_generate_*; gallery_finalize_*;
//   upload_cloudinary_*; update_wm_*
// - item-generator-app (Item Copy): app_opened; auth_*; find_item_*; create_item_*
// - driver-pickup: app_opened; auth_*; barcode_validation_*; barcode_scanned; barcode_scan_invalid; pickup_*
// - order-generator-app: app_opened; auth_*; find_order_*; create_order_*; bulk_import_orders_*
// - proofofdelivery: app_opened; auth_*; barcode_validation_*; barcode_scanned; barcode_scan_invalid;
//   pickup_*; (delivery flow: search_olpns, deliver_olpn, condition codes, upload_pod_photo — track as needed later)
// - work-order-update: app_opened; auth_*; work_order_search_*; work_order_descriptions_*
// - banding: app_opened; auth_*; banding_search_orders_*; banding_order_selected; banding_order_detail_*;
//   banding_add_to_bundle_*; banding_remove_from_bundle_*; banding_back_to_order_list; banding_sort_changed;
//   banding_theme_changed; banding_console_toggled
// - forecast-import: app_opened; auth_*; forecast_file_loaded; location_file_loaded; file_load_failed;
//   upload_forecast_*; upload_locations_* (server may emit upload_*_failed)
// - scp-store: app_opened; auth_*; store_id_entered; card_clicked; (legacy forecast/location upload events if that UI path runs)
// - pos-items-app: app_opened; auth_*; (item generation / bulk import / gallery events per UI)
// - item-update: app_opened; auth_*; item_scanned
// - todolist: app_opened; auth_*; (todo CRUD events per frontend)
// - dispatch: app_opened; auth_attempt; auth_success; auth_failed; dispatch_search_trips; dispatch_assign_trip
// - dispatch-request: app_opened; auth_attempt; auth_success; auth_failed; dispatch_request_submit
// - inspection: app_opened; auth_*; appointment search / check-in flow events (fork of check_in)
const APPS = [
  { id: 'lpn_unlock_app', name: 'LPN Lock / Unlock', icon: '🔓', neonAppName: 'lpn-unlock-app' },
  { id: 'mhe_console', name: 'MHE Console', icon: '🖥️', neonAppName: 'mhe-console' },
  { id: 'appt_app', name: 'Check In Kiosk', icon: '📅', neonAppName: 'appt-app' }, // check_in app sends app_name appt-app
  { id: 'inspection', name: 'Inspection', icon: '🔍', neonAppName: 'inspection' },
  { id: 'pos_items', name: 'POS Items', icon: '📦', neonAppName: 'pos-items-app' },
  { id: 'item_update', name: 'Item Master Update', icon: '✏️', neonAppName: 'item-update' },
  { id: 'driver_pickup', name: 'Driver Pickup', icon: '🚚', neonAppName: 'driver-pickup' },
  { id: 'facility_addresses', name: 'Facility Addresses', icon: '📍', neonAppName: 'facility-addresses' },
  { id: 'forecast_import', name: 'Import Forecast', icon: '📊', neonAppName: 'forecast-import' },
  { id: 'scp_store', name: 'SCP Store', icon: '🏪', neonAppName: 'scp-store' },
  { id: 'apps_homepage', name: 'Apps Homepage', icon: '🏠', neonAppName: 'apps-homepage' },
  { id: 'item_generator_gallery', name: 'Item Generator Gallery', icon: '🖼️', neonAppName: 'item-generator-gallery' },
  { id: 'item_generator', name: 'Item Copy', icon: '📦', neonAppName: 'item-generator-app' },
  { id: 'order_generator', name: 'Order Generator', icon: '📋', neonAppName: 'order-generator-app' },
  { id: 'schedule_app', name: 'Schedule Appointment', icon: '📆', neonAppName: 'schedule-app' },
  { id: 'todolist', name: 'Todo List', icon: '✅', neonAppName: 'todolist' },
  { id: 'update_appt', name: 'Update Appointment', icon: '✏️', neonAppName: 'update-appt' },
  { id: 'cycle_count', name: 'Cycle Count Import', icon: '🔄', neonAppName: 'cycle-count' },
  { id: 'proofofdelivery', name: 'Proof of Delivery', icon: '📬', neonAppName: 'proofofdelivery' },
  { id: 'work_order_update', name: 'Work Order Update', icon: '🔧', neonAppName: 'work-order-update' },
  { id: 'banding', name: 'Banding', icon: '📎', neonAppName: 'banding' },
  { id: 'dispatch', name: 'Dispatch', icon: '🛣️', neonAppName: 'dispatch' },
  { id: 'dispatch_request', name: 'Dispatch Request', icon: '📮', neonAppName: 'dispatch-request' },
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
    return null;
  }
}

/**
 * Summary counters from Neon (same DB as recent events).
 * @param {string | null} appName - null = all apps aggregate
 */
async function fetchSummaryStatsFromNeon(appName = null) {
  const params = appName ? { app_name: appName } : {};
  const stats = await fetchNeonData('statistics', params);
  if (!stats || stats.error != null || stats.total_events === undefined) {
    return null;
  }
  return {
    totalEvents: { state: String(stats.total_events) },
    events24h: { state: String(stats.events_last_24h) },
    totalOpens: { state: String(stats.total_opens) },
  };
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
  const zero = { state: '0' };
  let totalEvents;
  let events24h;
  let totalOpens;
  const neonSummary = await fetchSummaryStatsFromNeon(null);
  if (neonSummary) {
    totalEvents = neonSummary.totalEvents;
    events24h = neonSummary.events24h;
    totalOpens = neonSummary.totalOpens;
  } else {
    totalEvents = events24h = totalOpens = zero;
  }

  document.getElementById('total-events').textContent = totalEvents?.state || '0';
  document.getElementById('events-24h').textContent = events24h?.state || '0';
  document.getElementById('total-opens').textContent = totalOpens?.state || '0';

  let events = [];
  const neonData = await fetchNeonData('recent-events', { limit: '15' });

  if (neonData && neonData.events && Array.isArray(neonData.events)) {
    events = neonData.events.map(event => ({
      event_name: event.event_name,
      timestamp: event.timestamp,
      org: event.org,
      app_name: event.app_name,
      id: event.id,
      event_data: event.event_data,
    }));
    const eventsWithoutId = events.filter(e => !e.id);
    if (eventsWithoutId.length > 0) {
      console.warn('[loadOverallSummary] Some events missing id:', eventsWithoutId.length, 'out of', events.length);
    }
  }

  renderRecentEvents(events);
}

// Load data for all apps
// Uses query batching: fetches all events in one query, then groups by app
async function loadAppData() {
  // Step 1: Fetch all recent events in one batch query (enough for all apps)
  let allEvents = [];
  const neonData = await fetchNeonData('recent-events', { limit: '200' });

  if (neonData && neonData.events && Array.isArray(neonData.events)) {
    allEvents = neonData.events.map(event => ({
      event_name: event.event_name,
      timestamp: event.timestamp,
      org: event.org,
      app_name: event.app_name,
      id: event.id,
      event_data: event.event_data,
    }));
  }

  const eventsByApp = {};
  allEvents.forEach(event => {
    const appName = event.app_name;
    if (!eventsByApp[appName]) {
      eventsByApp[appName] = [];
    }
    eventsByApp[appName].push(event);
  });

  const zero = { state: '0' };
  const promises = APPS.map(async (app) => {
    const appName = app.neonAppName || app.id.replace(/_/g, '-');

    let totalEvents;
    let events24h;
    let totalOpens;
    const neonStats = await fetchSummaryStatsFromNeon(appName);
    if (neonStats) {
      totalEvents = neonStats.totalEvents;
      events24h = neonStats.events24h;
      totalOpens = neonStats.totalOpens;
    } else {
      totalEvents = events24h = totalOpens = zero;
    }

    let events = [];
    if (eventsByApp[appName] && Array.isArray(eventsByApp[appName])) {
      events = eventsByApp[appName].slice(0, 15);
    }

    return {
      id: app.id,
      name: app.name,
      icon: app.icon,
      totalEvents: totalEvents?.state || '0',
      events24h: events24h?.state || '0',
      totalOpens: totalOpens?.state || '0',
      recentEvents: events,
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

/** Parsed event_data (JSONB may arrive as object or string). */
function getEventDataObject(event) {
  const ed = event && event.event_data;
  if (ed == null) return {};
  if (typeof ed === 'string') {
    try {
      return JSON.parse(ed);
    } catch {
      return {};
    }
  }
  return typeof ed === 'object' ? ed : {};
}

/**
 * ORG for list/modal: DB column `org` first, then common metadata paths (e.g. Apps Homepage URL params).
 */
function resolveDisplayOrg(event) {
  if (!event) return null;
  if (event.org != null && String(event.org).trim() !== '') {
    return String(event.org).trim();
  }
  const d = getEventDataObject(event);
  if (d.org != null && String(d.org).trim() !== '') return String(d.org).trim();
  if (d.Organization != null && String(d.Organization).trim() !== '') return String(d.Organization).trim();
  const up = d.url_params;
  if (up && typeof up === 'object') {
    const o = up.Organization ?? up.ORG ?? up.organization;
    if (o != null && String(o).trim() !== '') return String(o).trim();
  }
  return null;
}

/**
 * When `clicked_app_name` is empty (e.g. legacy Apps Homepage: single-word titles were fully removed by a textContent regex),
 * derive a short label from the tile URL hostname.
 */
function deriveClickedAppLabelFromAppUrl(appUrl) {
  if (!appUrl || typeof appUrl !== 'string') return null;
  try {
    const u = new URL(appUrl);
    let host = u.hostname.replace(/^www\./i, '');
    if (!host) return null;
    host = host
      .replace(/\.vercel\.app$/i, '')
      .replace(/\.netlify\.app$/i, '')
      .replace(/\.github\.io$/i, '');
    if (!host) return null;
    const words = host.split(/[-_]+/).filter(Boolean);
    if (words.length === 0) return null;
    // Manhattan demo pattern: banding-wm -> "Banding"
    if (words.length === 2 && words[1].toLowerCase() === 'wm') {
      const w = words[0];
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    return words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  } catch {
    return null;
  }
}

/** Tile label for app link clicks (Apps Homepage and any app sending clicked_app_name). */
function resolveClickedAppNameForDisplay(event) {
  if (!event || event.event_name !== 'app_clicked') return null;
  const d = getEventDataObject(event);
  const raw = d.clicked_app_name ?? d.clicked_app;
  if (raw != null && String(raw).trim() !== '') return String(raw).trim();
  return deriveClickedAppLabelFromAppUrl(d.app_url);
}

/** Trailing segment for event lines: ORG and/or clicked app, else N/A. */
function formatEventOrgClickedTail(event) {
  const org = resolveDisplayOrg(event);
  const clicked = resolveClickedAppNameForDisplay(event);
  const parts = [];
  if (org) parts.push(escapeHtml(String(org)));
  if (clicked) parts.push(escapeHtml(String(clicked)));
  if (parts.length === 0) return 'N/A';
  return parts.join(' · ');
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
  const tail = formatEventOrgClickedTail(event);

  // Header card format: App (bold) || Event
  div.innerHTML = `• <strong>${appShort}</strong> — ${eventName} — ${mmdd} ${time} — ${tail}`;
  
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
    (appName === 'check-in' && a.id === 'appt_app') ||
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
    'check-in': 'APPT',
    'inspection': 'Inspect',
    'POS Items': 'POS',
    'pos-items-app': 'POS',
    'item-update': 'Item Upd',
    'item_update': 'Item Upd',
    'driver-pickup': 'Driver',
    'driver_pickup': 'Driver',
    'Driver Pickup': 'Driver',
    'facility-addresses': 'Facility',
    'facility_addresses': 'Facility',
    'Facility Addresses': 'Facility',
    'forecast-import': 'Forecast',
    'forecast_import': 'Forecast',
    'Import Forecast': 'Forecast',
    'scp-store': 'SCP Store',
    'scp_store': 'SCP Store',
    'apps-homepage': 'Homepage',
    'item-generator-gallery': 'Item Gallery',
    'Item Generator Gallery': 'Item Gallery',
    'item-generator-app': 'Item Copy',
    'Item Copy': 'Item Copy',
    'order-generator-app': 'Order Gen',
    'order-generator': 'Order Gen',
    'Order Generator': 'Order Gen',
    'proofofdelivery': 'POD',
    'proof-of-delivery': 'POD',
    'work-order-update': 'WO Update',
    'banding': 'Banding',
    'banding-wm': 'Banding',
    'schedule-app': 'Schedule',
    'todolist': 'Todo',
    'update-appt': 'Update Appt',
    'cycle-count': 'Cycle Import',
    'cycle_count': 'Cycle Import',
    'dispatch': 'Dispatch',
    'dispatch-request': 'Dispatch Req'
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
  const tail = formatEventOrgClickedTail(event);

  div.innerHTML = `• <strong>${eventName}</strong> — ${mmdd} ${time} — ${tail}`;
  
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
  const orgResolved = resolveDisplayOrg(eventData) || 'N/A';
  html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Organization:</span> <span class="modal-event-info-value">${escapeHtml(orgResolved)}</span></div>`;
  const clickedResolved = resolveClickedAppNameForDisplay(eventData);
  if (clickedResolved) {
    html += `<div class="modal-event-info-item"><span class="modal-event-info-label">Clicked App:</span> <span class="modal-event-info-value">${escapeHtml(clickedResolved)}</span></div>`;
  }
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
  
  // Pre-load new previous event (use context to determine if app-specific)
  const appNameForNav = modalState.context === 'app' ? modalState.appName : null;
  const newPrevId = await fetchNavigationId(modalState.currentId, 'prev', appNameForNav);
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
  
  // Pre-load new next event (use context to determine if app-specific)
  const appNameForNav = modalState.context === 'app' ? modalState.appName : null;
  const newNextId = await fetchNavigationId(modalState.currentId, 'next', appNameForNav);
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

