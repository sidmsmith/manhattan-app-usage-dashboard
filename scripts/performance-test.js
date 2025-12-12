/**
 * Simple Performance Testing Script for Dashboard API
 * Tests Neon API endpoint response times and performance
 * 
 * Usage: node scripts/performance-test.js
 */

const API_BASE = process.env.DASHBOARD_URL || 'https://manhattan-app-usage-dashboard.vercel.app';

async function fetchWithTiming(url) {
  const startTime = performance.now();
  try {
    const response = await fetch(url);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        duration: duration.toFixed(2),
        error: `HTTP ${response.status}`
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      status: response.status,
      duration: duration.toFixed(2),
      dataSize: JSON.stringify(data).length,
      recordCount: Array.isArray(data.events) ? data.events.length : (data.events ? 1 : 0)
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      success: false,
      duration: (endTime - startTime).toFixed(2),
      error: error.message
    };
  }
}

async function testHealth() {
  console.log('🏥 Testing Health Check...');
  const result = await fetchWithTiming(`${API_BASE}/api/fetch-neon?query=health`);
  
  if (result.success) {
    console.log(`   ✅ Status: ${result.status} | Time: ${result.duration}ms`);
    if (result.dataSize) {
      console.log(`   📦 Response size: ${(result.dataSize / 1024).toFixed(2)} KB`);
    }
  } else {
    console.log(`   ❌ Failed: ${result.error} | Time: ${result.duration}ms`);
  }
  return result;
}

async function testRecentEvents(limit = 15) {
  console.log(`\n📋 Testing Recent Events (limit: ${limit})...`);
  const result = await fetchWithTiming(`${API_BASE}/api/fetch-neon?query=recent-events&limit=${limit}`);
  
  if (result.success) {
    console.log(`   ✅ Status: ${result.status} | Time: ${result.duration}ms`);
    console.log(`   📊 Records returned: ${result.recordCount}`);
    console.log(`   📦 Response size: ${(result.dataSize / 1024).toFixed(2)} KB`);
    
    if (parseFloat(result.duration) > 500) {
      console.log(`   ⚠️  Slow response (>500ms)`);
    }
  } else {
    console.log(`   ❌ Failed: ${result.error} | Time: ${result.duration}ms`);
  }
  return result;
}

async function testAppSpecific(appName) {
  console.log(`\n📱 Testing App-Specific Query (${appName})...`);
  const result = await fetchWithTiming(`${API_BASE}/api/fetch-neon?query=recent-events&app_name=${encodeURIComponent(appName)}&limit=15`);
  
  if (result.success) {
    console.log(`   ✅ Status: ${result.status} | Time: ${result.duration}ms`);
    console.log(`   📊 Records returned: ${result.recordCount}`);
    console.log(`   📦 Response size: ${(result.dataSize / 1024).toFixed(2)} KB`);
    
    if (parseFloat(result.duration) > 500) {
      console.log(`   ⚠️  Slow response (>500ms)`);
    }
  } else {
    console.log(`   ❌ Failed: ${result.error} | Time: ${result.duration}ms`);
  }
  return result;
}

async function testStatistics(appName = null) {
  const query = appName 
    ? `${API_BASE}/api/fetch-neon?query=statistics&app_name=${encodeURIComponent(appName)}`
    : `${API_BASE}/api/fetch-neon?query=statistics`;
  
  console.log(`\n📊 Testing Statistics${appName ? ` (${appName})` : ' (All Apps)'}...`);
  const result = await fetchWithTiming(query);
  
  if (result.success) {
    console.log(`   ✅ Status: ${result.status} | Time: ${result.duration}ms`);
    console.log(`   📦 Response size: ${(result.dataSize / 1024).toFixed(2)} KB`);
    
    if (parseFloat(result.duration) > 500) {
      console.log(`   ⚠️  Slow response (>500ms)`);
    }
  } else {
    console.log(`   ❌ Failed: ${result.error} | Time: ${result.duration}ms`);
  }
  return result;
}

async function runMultipleTests(testFn, count = 5, label) {
  console.log(`\n🔄 Running ${count} ${label} tests...`);
  const results = [];
  
  for (let i = 0; i < count; i++) {
    const result = await testFn();
    if (result.success) {
      results.push(parseFloat(result.duration));
    }
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (results.length > 0) {
    const avg = (results.reduce((a, b) => a + b, 0) / results.length).toFixed(2);
    const min = Math.min(...results).toFixed(2);
    const max = Math.max(...results).toFixed(2);
    console.log(`   📈 Average: ${avg}ms | Min: ${min}ms | Max: ${max}ms`);
  }
  
  return results;
}

async function testDashboardLoad() {
  console.log('\n🌐 Testing Full Dashboard Load Simulation...');
  console.log('   (Simulating what the dashboard does on page load)');
  
  const startTime = performance.now();
  
  // Simulate dashboard load: health + recent events + statistics
  const [health, recent, stats] = await Promise.all([
    fetchWithTiming(`${API_BASE}/api/fetch-neon?query=health`),
    fetchWithTiming(`${API_BASE}/api/fetch-neon?query=recent-events&limit=15`),
    fetchWithTiming(`${API_BASE}/api/fetch-neon?query=statistics`)
  ]);
  
  const endTime = performance.now();
  const totalTime = (endTime - startTime).toFixed(2);
  
  console.log(`   ⏱️  Total parallel load time: ${totalTime}ms`);
  console.log(`   ✅ Health: ${health.duration}ms`);
  console.log(`   ✅ Recent Events: ${recent.duration}ms`);
  console.log(`   ✅ Statistics: ${stats.duration}ms`);
  
  if (parseFloat(totalTime) > 2000) {
    console.log(`   ⚠️  Slow dashboard load (>2s)`);
  } else {
    console.log(`   ✅ Dashboard load time is good (<2s)`);
  }
  
  return { totalTime, health, recent, stats };
}

async function main() {
  console.log('🚀 Performance Testing for Manhattan App Usage Dashboard\n');
  console.log(`📍 Testing API at: ${API_BASE}\n`);
  
  const results = {
    health: null,
    recentEvents: null,
    appSpecific: null,
    statistics: null,
    dashboardLoad: null
  };
  
  // Single tests
  results.health = await testHealth();
  results.recentEvents = await testRecentEvents(15);
  results.appSpecific = await testAppSpecific('Order Generator');
  results.statistics = await testStatistics();
  
  // Multiple tests for consistency
  await runMultipleTests(() => testRecentEvents(15), 5, 'Recent Events');
  
  // Dashboard load simulation
  results.dashboardLoad = await testDashboardLoad();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Performance Test Summary');
  console.log('='.repeat(60));
  
  if (results.health?.success) {
    console.log(`✅ Health Check: ${results.health.duration}ms`);
  }
  if (results.recentEvents?.success) {
    console.log(`✅ Recent Events: ${results.recentEvents.duration}ms (${results.recentEvents.recordCount} records)`);
  }
  if (results.appSpecific?.success) {
    console.log(`✅ App-Specific: ${results.appSpecific.duration}ms`);
  }
  if (results.statistics?.success) {
    console.log(`✅ Statistics: ${results.statistics.duration}ms`);
  }
  if (results.dashboardLoad) {
    console.log(`✅ Dashboard Load: ${results.dashboardLoad.totalTime}ms (parallel)`);
  }
  
  console.log('\n💡 Recommendations:');
  if (results.recentEvents && parseFloat(results.recentEvents.duration) > 500) {
    console.log('   ⚠️  Recent events query is slow - consider adding indexes');
  }
  if (results.dashboardLoad && parseFloat(results.dashboardLoad.totalTime) > 2000) {
    console.log('   ⚠️  Dashboard load is slow - consider query batching or caching');
  }
  if (results.recentEvents && parseFloat(results.recentEvents.duration) < 300 && 
      results.dashboardLoad && parseFloat(results.dashboardLoad.totalTime) < 1500) {
    console.log('   ✅ Performance looks good!');
  }
  
  console.log('\n✨ Testing complete!');
}

// Run tests
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

