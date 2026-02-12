/**
 * Test script to verify API endpoints work with mock data
 * Run this after seeding the database
 */
import 'dotenv/config';
import { logger } from '../lib/logger.js';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<any>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    logger.info(`✓ ${name} (${duration}ms)`);
    return { name, success: true, duration, data };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`✗ ${name} (${duration}ms):`, errorMsg);
    return { name, success: false, duration, error: errorMsg };
  }
}

async function testHealthCheck() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function testGetStats() {
  const response = await fetch(`${API_BASE}/api/series/stats`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function testSearch() {
  const response = await fetch(`${API_BASE}/api/series/search?q=spy&limit=5`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Expected array response');
  return data;
}

async function testGetSeriesById(seriesId: string) {
  const response = await fetch(`${API_BASE}/api/series/${seriesId}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function runAllTests() {
  logger.info('Starting API endpoint tests...\n');

  // Test 1: Health check
  results.push(await runTest('Health Check', testHealthCheck));

  // Test 2: Get stats
  const statsResult = await runTest('Get Cache Stats', testGetStats);
  results.push(statsResult);

  if (statsResult.success && statsResult.data) {
    logger.info(`  Series in cache: ${statsResult.data.totalSeries}`);
    logger.info(`  Tags generated: ${statsResult.data.totalTags}`);
    logger.info(`  Relationships: ${statsResult.data.totalRelationships}`);
  }

  // Test 3: Search
  const searchResult = await runTest('Search Series', testSearch);
  results.push(searchResult);

  if (searchResult.success && searchResult.data) {
    logger.info(`  Found ${searchResult.data.length} series`);
    if (searchResult.data.length > 0) {
      const firstSeries = searchResult.data[0];
      logger.info(`  First result: ${firstSeries.title}`);

      // Test 4: Get series by ID
      results.push(
        await runTest(`Get Series by ID (${firstSeries.id})`, () =>
          testGetSeriesById(firstSeries.id)
        )
      );
    }
  }

  // Print summary
  logger.info('\n=== Test Summary ===');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  logger.info(`Passed: ${passed}/${results.length}`);
  logger.info(`Failed: ${failed}/${results.length}`);
  logger.info(`Average duration: ${avgDuration.toFixed(0)}ms`);

  if (failed > 0) {
    logger.info('\n=== Failed Tests ===');
    results
      .filter(r => !r.success)
      .forEach(r => logger.error(`${r.name}: ${r.error}`));
  }

  return failed === 0;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('Test script failed:', error);
      process.exit(1);
    });
}

export { runAllTests };
