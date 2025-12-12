# Performance Testing Guide

Quick guide for testing dashboard and API performance.

## Quick Start

### Option 1: Run Automated Test Script

```bash
cd apps_dashboard
npm run test-performance
```

This will test:
- Health check endpoint
- Recent events query
- App-specific queries
- Statistics queries
- Full dashboard load simulation
- Multiple runs for consistency

### Option 2: Manual Browser Testing

1. **Open Dashboard:**
   - Go to: https://manhattan-app-usage-dashboard.vercel.app
   - Open Browser DevTools (F12)
   - Go to Network tab
   - Refresh the page

2. **Measure Load Time:**
   - Look for `/api/fetch-neon` requests
   - Check "Time" column for each request
   - Total load = sum of all API calls

3. **Check Performance Tab:**
   - Open DevTools → Performance tab
   - Click Record
   - Refresh page
   - Stop recording
   - Review timeline for bottlenecks

## Performance Benchmarks

### Target Metrics
- **Health Check:** < 200ms
- **Recent Events (15):** < 300ms
- **App-Specific Query:** < 300ms
- **Statistics:** < 400ms
- **Full Dashboard Load:** < 2 seconds

### Current Performance
Run the test script to see current metrics.

## What to Look For

### ✅ Good Performance
- All API calls < 500ms
- Dashboard loads in < 2 seconds
- Consistent response times across multiple runs

### ⚠️ Issues to Watch For
- **Slow queries (>500ms):** May need database indexes
- **Inconsistent times:** May indicate connection pooling issues
- **Large response sizes:** May need pagination or filtering
- **Slow dashboard load (>2s):** May need query batching or caching

## Quick Performance Wins

### 1. Check Database Indexes
```sql
-- In Neon SQL Editor, check if indexes exist
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'app_usage_events';
```

### 2. Test Query Performance
```sql
-- Test a recent events query
EXPLAIN ANALYZE
SELECT * FROM app_usage_events
WHERE app_name = 'Order Generator'
ORDER BY timestamp DESC
LIMIT 15;
```

Look for:
- **Seq Scan:** Bad - needs index
- **Index Scan:** Good - using index
- **Execution Time:** Should be < 50ms

### 3. Check Response Sizes
Large responses can slow things down. Check:
- How many records are returned
- Size of `event_data` JSON
- Total response payload size

## Browser Performance Testing

### Chrome DevTools

1. **Network Tab:**
   - Filter by "fetch-neon"
   - Check "Time" column
   - Look for slow requests (red)

2. **Performance Tab:**
   - Record page load
   - Look for long tasks
   - Check JavaScript execution time

3. **Lighthouse:**
   - DevTools → Lighthouse tab
   - Run Performance audit
   - Check recommendations

## API Endpoint Testing

### Test Individual Endpoints

```bash
# Health check
curl -w "\nTime: %{time_total}s\n" "https://manhattan-app-usage-dashboard.vercel.app/api/fetch-neon?query=health"

# Recent events
curl -w "\nTime: %{time_total}s\n" "https://manhattan-app-usage-dashboard.vercel.app/api/fetch-neon?query=recent-events&limit=15"

# Statistics
curl -w "\nTime: %{time_total}s\n" "https://manhattan-app-usage-dashboard.vercel.app/api/fetch-neon?query=statistics"
```

## Optimization Opportunities

### If Recent Events is Slow:
1. Add composite index: `(app_name, timestamp DESC)`
2. Limit query to last 24 hours
3. Cache results for 30 seconds

### If Dashboard Load is Slow:
1. Batch queries (fetch all apps in one query)
2. Implement client-side caching
3. Use parallel requests (already doing this)

### If Statistics is Slow:
1. Create materialized view for statistics
2. Refresh view periodically
3. Cache statistics results

## Next Steps After Testing

1. **Document Results:** Note current performance metrics
2. **Identify Bottlenecks:** Which queries are slowest?
3. **Prioritize Fixes:** Start with biggest impact
4. **Re-test:** Verify improvements after changes

## Example Test Output

```
🚀 Performance Testing for Manhattan App Usage Dashboard

📍 Testing API at: https://manhattan-app-usage-dashboard.vercel.app

🏥 Testing Health Check...
   ✅ Status: 200 | Time: 145.23ms
   📦 Response size: 0.15 KB

📋 Testing Recent Events (limit: 15)...
   ✅ Status: 200 | Time: 287.45ms
   📊 Records returned: 15
   📦 Response size: 12.34 KB

📱 Testing App-Specific Query (Order Generator)...
   ✅ Status: 200 | Time: 234.12ms
   📊 Records returned: 15
   📦 Response size: 8.76 KB

📊 Testing Statistics (All Apps)...
   ✅ Status: 200 | Time: 312.67ms
   📦 Response size: 0.45 KB

🔄 Running 5 Recent Events tests...
   📈 Average: 289.34ms | Min: 245.12ms | Max: 334.56ms

🌐 Testing Full Dashboard Load Simulation...
   ⏱️  Total parallel load time: 456.78ms
   ✅ Health: 145.23ms
   ✅ Recent Events: 287.45ms
   ✅ Statistics: 312.67ms
   ✅ Dashboard load time is good (<2s)

============================================================
📊 Performance Test Summary
============================================================
✅ Health Check: 145.23ms
✅ Recent Events: 287.45ms (15 records)
✅ App-Specific: 234.12ms
✅ Statistics: 312.67ms
✅ Dashboard Load: 456.78ms (parallel)

💡 Recommendations:
   ✅ Performance looks good!

✨ Testing complete!
```
