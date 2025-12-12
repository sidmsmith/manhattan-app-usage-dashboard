# Event Details Modal Feature

**Version**: 2.1.0  
**Status**: ✅ Fully Functional

## Overview

The dashboard now includes a modal that displays full event details when clicking on any Recent Event. The modal shows pretty-printed JSON of the complete event record and includes navigation arrows to browse through events. This feature was introduced in v2.1.0 ("Modal Works").

## Features

### Clickable Events
- All Recent Events (both in Summary and App cards) are clickable
- No visual changes to event text (no blue color, no underline)
- Cursor changes to pointer on hover (subtle indication)
- Clicking opens modal with full event details

### Modal Display
- Shows complete event record as pretty-printed JSON
- Displays all fields: id, app_name, event_name, org, timestamp, created_at, updated_at, event_data
- Modal is ~50% of screen width
- Styled to match dashboard design
- Scrollable content for long JSON

### Navigation Arrows
- Left/Right arrows on both sides of modal
- Navigate to previous/next event
- Context-aware navigation:
  - **Summary context**: Navigates across all events (by id)
  - **App-specific context**: Navigates only within the same app (by id, filtered by app_name)
- Arrows automatically hide when no prev/next event exists
- Pre-loading: Previous and next events are pre-loaded for instant navigation

### Pre-loading Strategy
1. When modal opens: Fetches current event + pre-loads prev/next
2. When navigating: Uses pre-loaded data if available, otherwise fetches
3. After navigation: Pre-loads new prev/next for the current event
4. Ensures smooth, fast navigation experience

## Technical Implementation

### Database Changes
- **Removed `event_id` column** from Neon (no longer needed)
- Using `id` (primary key) for all event identification
- AppDaemon script doesn't write to `event_id` (was already NULL)

### API Endpoints
- `GET /api/fetch-neon?query=event-details&id={id}` - Fetch full event details
- `GET /api/fetch-neon?query=event-navigation&id={id}&direction={prev|next}&app_name={optional}` - Get prev/next event ID

### Navigation Logic
- **Summary mode**: `WHERE id > current_id ORDER BY id ASC` (all events)
- **App mode**: `WHERE app_name = X AND id > current_id ORDER BY id ASC` (same app only)
- Navigation is by sequential `id`, not timestamp

## Usage

1. **Click any Recent Event** (from Summary or App card)
2. **Modal opens** showing full event JSON
3. **Use arrows** to navigate to previous/next event
4. **Close modal** via X button, overlay click, or ESC key

## Files Modified

- `index.html` - Added modal HTML structure
- `styles.css` - Added modal styles and clickable event styles
- `app.js` - Added modal functionality, click handlers, navigation logic
- `api/fetch-neon.js` - Added event-navigation query, removed event_id references
- `manhattan_dashboard/neon_remove_event_id.sql` - SQL to remove event_id column
- `scripts/remove-event-id-column.js` - Script to remove event_id column

## Migration Steps

1. **Remove event_id column from Neon:**
   ```bash
   # Option 1: Run SQL directly in Neon SQL Editor
   # Copy/paste from manhattan_dashboard/neon_remove_event_id.sql
   
   # Option 2: Run Node.js script
   npm run remove-event-id-column
   ```

2. **Deploy code changes:**
   - Code is ready to deploy
   - Modal will work once event_id column is removed

## Notes

- AppDaemon script doesn't need changes (already doesn't write to event_id)
- All event identification uses `id` (primary key)
- Navigation is sequential by `id`, not chronological
- Pre-loading ensures smooth navigation experience
- Modal header dynamically updates with app name when navigating
- Summary context navigation goes across all events, app context stays within app

## Version History

- **v2.1.0** (2025-12-13): "Modal Works" - Full modal functionality with context-aware navigation
  - Clickable events in summary and app cards
  - Modal with pretty-printed JSON
  - Navigation arrows with pre-loading
  - Dynamic modal header with app name
  - Fixed navigation context logic
