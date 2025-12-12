# Changelog

All notable changes to the Manhattan App Usage Dashboard project will be documented in this file.

## [2.1.0] - 2025-12-13

### 🎉 Release: "Modal Works"

**Major Features:**
- ✅ Event Details Modal - Click any Recent Event to view full JSON
- ✅ Context-aware navigation (summary vs app-specific)
- ✅ Pre-loading for smooth navigation experience
- ✅ Modal header displays app name dynamically
- ✅ All Recent Events are clickable (summary and app cards)

**Improvements:**
- Fixed navigation logic: summary context navigates across all events, app context stays within app
- Added visual feedback (cursor pointer) for clickable events
- Improved error handling and debugging for missing event IDs
- Better fallback handling for SQL sensor events

**Technical Changes:**
- Removed `event_id` column from Neon (using `id` primary key exclusively)
- Added `event-details` and `event-navigation` API endpoints
- Implemented modal state management with pre-loading
- Added `getAppDisplayName()` function for human-readable app names

**Documentation:**
- Created `MODAL_FEATURE.md` with complete modal documentation
- Updated README with modal feature details
- Added migration guide for removing `event_id` column

---

## [2.0.0] - 2025-12-12

### 🎉 Release: "Fully works with Neon before Modal"

**Major Features:**
- ✅ Full Neon PostgreSQL integration for event data storage
- ✅ Client-side caching (30-second TTL) for improved performance
- ✅ Query batching: reduced from 13+ API calls to 1 batch query
- ✅ Fixed timestamp issues in migrated data
- ✅ App name mapping fixes for all apps
- ✅ Performance optimizations and testing tools

**Improvements:**
- Reduced console logging verbosity
- Optimized dashboard load time (< 2 seconds)
- Better error handling with fallback to SQL sensors
- Comprehensive performance testing suite

**Technical Changes:**
- Migrated from Cloudflare Tunnel/MariaDB direct connection to Neon PostgreSQL
- Implemented AppDaemon dual-write (MariaDB local backup + Neon cloud primary)
- Added batch query optimization (200 events in one query)
- Added client-side API response caching

**Data Migration:**
- Historical data migrated from Home Assistant SQLite to Neon
- Fixed timestamp extraction from event_data JSON
- All apps now display recent events correctly

**Documentation:**
- Complete setup guides for Neon integration
- Performance testing documentation
- AppDaemon deployment guides
- Migration scripts and instructions

---

## [1.0.0] - 2025-12-09

### Baseline Version

**Initial Release:**
- Organized Home Assistant configuration into `manhattan_dashboard/` folder
- Cleaned up unused scripts and test files
- Repository cleanup and organization
- Complete documentation structure

**Features:**
- Overall summary dashboard
- Individual app cards with metrics
- Recent events display
- Configurable sorting (Recent, 24H, Events, Opens, Alphabetical, Manual)
- Drag-and-drop card reordering
- Auto-refresh every 60 seconds
- Timezone support (local browser timezone)

---

## [0.3.7] - Previous

- Removed modal functionality
- Fixed Recent Events display
- Various bug fixes and improvements
