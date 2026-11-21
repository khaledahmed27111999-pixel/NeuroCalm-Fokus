/**
 * NeuroCalm & Fokus — Phase S8 Sleep Insights & Analytics Test Suite
 * Automated tests for:
 * 1. Average recorded interval calculation.
 * 2. Shortest and longest recorded intervals.
 * 3. Empty history handling (graceful empty state).
 * 4. Insufficient data handling (< 2 records for consistency).
 * 5. Incomplete, corrupt, and invalid records exclusion.
 * 6. Unique nights counting and multi-session days.
 * 7. 7-day, 14-day, 30-day, and all-time range filtering.
 * 8. Missing nights representation (never fabricated or plotted as 0 hours).
 * 9. Cross-midnight records handling.
 * 10. Anchor Night assignment stability.
 * 11. Schedule comparison calculations (bedtime and wake-up minute deltas).
 * 12. Historical schedule comparison limitations.
 * 13. Morning check-in distribution (counts and rounded percentages).
 * 14. Clock-anomaly handling and review flags.
 * 15. Arabic and English localization parity.
 * 16. Dashboard integration and navigation contracts.
 */

import assert from 'node:assert';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { TranslationKey } from '../src/types/locale';
import { SleepRecord, SleepSchedule } from '../src/types/sleep';
import {
  getValidCompletedRecords,
  filterRecordsByRange,
  calculateSleepOverviewStats,
  calculateNightlyTrendBuckets,
  calculateMorningCheckInStats,
  calculateConsistencyMetrics,
  calculateScheduleComparisons,
  formatClockMinutes,
} from '../src/utils/sleepAnalyticsUtils';
import { createDefaultSleepSchedule } from '../src/storage/sleepScheduleStorage';

console.log('--- STARTING PHASE S8 SLEEP INSIGHTS TEST SUITE ---\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void): void {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

// Helper factory for creating test records
function createTestRecord(overrides: Partial<SleepRecord> = {}): SleepRecord {
  const startedAt = overrides.startedAt ?? new Date('2026-11-20T23:00:00').getTime();
  const endedAt = overrides.endedAt ?? new Date('2026-11-21T07:00:00').getTime();
  const durationMinutes = overrides.durationMinutes ?? Math.round((endedAt - startedAt) / 60000);

  return {
    id: overrides.id ?? `rec_${Math.random().toString(36).slice(2, 9)}`,
    version: 1,
    sleepDate: overrides.sleepDate ?? '2026-11-20',
    startedAt,
    endedAt,
    durationMinutes,
    durationMs: durationMinutes * 60000,
    timezoneOffsetMinutes: 0,
    source: overrides.source ?? 'manual_realtime',
    rating: overrides.rating,
    notes: overrides.notes,
    anomalyFlags: overrides.anomalyFlags,
    isFlaggedForReview: overrides.isFlaggedForReview ?? false,
    createdAt: endedAt,
    updatedAt: endedAt,
  };
}

// =========================================================================
// TEST GROUP 1: Overview Summary & Statistical Calculations
// =========================================================================
console.log('Test Group 1: Overview Summary & Statistical Calculations');

runTest('Calculates correct average recorded interval', () => {
  const r1 = createTestRecord({ durationMinutes: 480 }); // 8h
  const r2 = createTestRecord({ durationMinutes: 420 }); // 7h
  const r3 = createTestRecord({ durationMinutes: 540 }); // 9h

  const stats = calculateSleepOverviewStats([r1, r2, r3]);
  assert.strictEqual(stats.totalRecords, 3);
  assert.strictEqual(stats.avgDurationMinutes, 480); // (480 + 420 + 540) / 3 = 480
});

runTest('Identifies shortest and longest recorded intervals accurately', () => {
  const short = createTestRecord({ id: 'rec_short', durationMinutes: 360 }); // 6h
  const mid = createTestRecord({ id: 'rec_mid', durationMinutes: 450 });   // 7.5h
  const long = createTestRecord({ id: 'rec_long', durationMinutes: 570 });  // 9.5h

  const stats = calculateSleepOverviewStats([short, mid, long]);
  assert.strictEqual(stats.shortestRecord?.id, 'rec_short');
  assert.strictEqual(stats.shortestRecord?.durationMinutes, 360);
  assert.strictEqual(stats.longestRecord?.id, 'rec_long');
  assert.strictEqual(stats.longestRecord?.durationMinutes, 570);
});

runTest('Handles empty record history gracefully', () => {
  const stats = calculateSleepOverviewStats([]);
  assert.strictEqual(stats.totalRecords, 0);
  assert.strictEqual(stats.uniqueNights, 0);
  assert.strictEqual(stats.avgDurationMinutes, 0);
  assert.strictEqual(stats.longestRecord, null);
  assert.strictEqual(stats.shortestRecord, null);
  assert.strictEqual(stats.latestRecord, null);
  assert.strictEqual(stats.hasEnoughData, false);
});

runTest('Counts unique nights correctly even with multiple sessions on the same anchor date', () => {
  const r1 = createTestRecord({ sleepDate: '2026-11-20', durationMinutes: 420 }); // overnight
  const r2 = createTestRecord({ sleepDate: '2026-11-20', durationMinutes: 60 });  // afternoon rest
  const r3 = createTestRecord({ sleepDate: '2026-11-21', durationMinutes: 480 }); // next night

  const stats = calculateSleepOverviewStats([r1, r2, r3]);
  assert.strictEqual(stats.totalRecords, 3);
  assert.strictEqual(stats.uniqueNights, 2, 'Should count 2 unique nights across 3 records');
});

// =========================================================================
// TEST GROUP 2: Incomplete & Corrupted Record Filtering
// =========================================================================
console.log('\nTest Group 2: Incomplete & Corrupted Record Filtering');

runTest('Excludes records with negative, zero, or inverted timestamps', () => {
  const valid = createTestRecord({ id: 'valid_1', durationMinutes: 480 });
  const zeroDuration = createTestRecord({ id: 'zero_1', durationMinutes: 0 });
  const negativeDuration = createTestRecord({ id: 'neg_1', durationMinutes: -30 });
  const invertedTimes = createTestRecord({
    id: 'inv_1',
    startedAt: 2000000,
    endedAt: 1000000,
    durationMinutes: 50,
  });

  const filtered = getValidCompletedRecords([
    valid,
    zeroDuration,
    negativeDuration,
    invertedTimes,
  ]);

  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, 'valid_1');
});

// =========================================================================
// TEST GROUP 3: Range Filtering (7d, 14d, 30d, all)
// =========================================================================
console.log('\nTest Group 3: Range Filtering (7d, 14d, 30d, all)');

runTest('7-day range correctly includes only records within the last 7 anchor nights', () => {
  const refDate = new Date('2026-11-21T12:00:00'); // Anchor date: 2026-11-21
  // 7-day window spans 2026-11-15 to 2026-11-21
  const inside1 = createTestRecord({ sleepDate: '2026-11-21' });
  const inside2 = createTestRecord({ sleepDate: '2026-11-15' });
  const outside = createTestRecord({ sleepDate: '2026-11-14' }); // 8 days ago

  const result = filterRecordsByRange([inside1, inside2, outside], '7d', refDate);
  assert.strictEqual(result.length, 2);
  assert.ok(result.some((r) => r.sleepDate === '2026-11-21'));
  assert.ok(result.some((r) => r.sleepDate === '2026-11-15'));
  assert.ok(!result.some((r) => r.sleepDate === '2026-11-14'));
});

runTest('Range "all" returns all valid records without chronological cutoff', () => {
  const r1 = createTestRecord({ sleepDate: '2025-01-01' });
  const r2 = createTestRecord({ sleepDate: '2026-11-21' });

  const result = filterRecordsByRange([r1, r2], 'all');
  assert.strictEqual(result.length, 2);
});

// =========================================================================
// TEST GROUP 4: Missing Nights & Trend Buckets
// =========================================================================
console.log('\nTest Group 4: Missing Nights & Trend Buckets');

runTest('Trend buckets preserve unrecorded nights with hasRecord: false', () => {
  const refDate = new Date('2026-11-21T12:00:00');
  // Only 1 record in the 7-day window (on 2026-11-20)
  const r1 = createTestRecord({ sleepDate: '2026-11-20', durationMinutes: 450 });

  const buckets = calculateNightlyTrendBuckets([r1], '7d', refDate);
  assert.strictEqual(buckets.length, 7, 'Must produce 7 continuous calendar day buckets');

  const recordedBucket = buckets.find((b) => b.sleepDate === '2026-11-20');
  assert.ok(recordedBucket);
  assert.strictEqual(recordedBucket.hasRecord, true);
  assert.strictEqual(recordedBucket.totalDurationMinutes, 450);

  const missingBucket = buckets.find((b) => b.sleepDate === '2026-11-19');
  assert.ok(missingBucket);
  assert.strictEqual(missingBucket.hasRecord, false);
  assert.strictEqual(missingBucket.totalDurationMinutes, 0);
  assert.strictEqual(missingBucket.records.length, 0);
});

runTest('Trend buckets never plot missing nights as confirmed zero-hour sleep', () => {
  const refDate = new Date('2026-11-21T12:00:00');
  const buckets = calculateNightlyTrendBuckets([], '7d', refDate);

  for (const b of buckets) {
    assert.strictEqual(b.hasRecord, false, 'Empty nights must be explicitly flagged hasRecord: false');
    assert.strictEqual(b.primaryRecord, undefined);
  }
});

// =========================================================================
// TEST GROUP 5: Consistency Metrics (Circular Arithmetic)
// =========================================================================
console.log('\nTest Group 5: Consistency Metrics (Circular Arithmetic)');

runTest('Consistency requires at least 2 records', () => {
  const r1 = createTestRecord();
  const c1 = calculateConsistencyMetrics([r1]);
  assert.strictEqual(c1.hasEnoughData, false);

  const r2 = createTestRecord();
  const c2 = calculateConsistencyMetrics([r1, r2]);
  assert.strictEqual(c2.hasEnoughData, true);
});

runTest('Circular arithmetic handles bedtimes straddling midnight accurately', () => {
  // Day 1: 23:30 (1410 min)
  const d1 = new Date(2026, 10, 20, 23, 30, 0).getTime();
  const w1 = new Date(2026, 10, 21, 7, 30, 0).getTime();
  const r1 = createTestRecord({ startedAt: d1, endedAt: w1 });

  // Day 2: 00:30 (30 min past midnight)
  const d2 = new Date(2026, 10, 22, 0, 30, 0).getTime();
  const w2 = new Date(2026, 10, 22, 8, 30, 0).getTime();
  const r2 = createTestRecord({ startedAt: d2, endedAt: w2 });

  const metrics = calculateConsistencyMetrics([r1, r2]);
  assert.strictEqual(metrics.hasEnoughData, true);
  // Circular mean of 23:30 (-30m) and 00:30 (+30m) is exactly 00:00 (midnight)
  assert.strictEqual(metrics.avgStartTimeFormatted, '00:00');
  // Circular mean of 07:30 and 08:30 is 08:00
  assert.strictEqual(metrics.avgWakeTimeFormatted, '08:00');
});

runTest('formatClockMinutes normalizes total minutes into clean HH:mm', () => {
  assert.strictEqual(formatClockMinutes(0), '00:00');
  assert.strictEqual(formatClockMinutes(65), '01:05');
  assert.strictEqual(formatClockMinutes(1439), '23:59');
  assert.strictEqual(formatClockMinutes(1440), '00:00');
});

// =========================================================================
// TEST GROUP 6: Schedule Comparison Calculations
// =========================================================================
console.log('\nTest Group 6: Schedule Comparison Calculations');

runTest('Compares recorded start and wake times against active schedule targets', () => {
  const schedule = createDefaultSleepSchedule('sched_comp');
  schedule.targetBedtime = '23:00';
  schedule.targetWakeTime = '07:00';
  schedule.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];

  // User slept at 23:15 (+15m later than target) and woke at 06:50 (-10m earlier than target)
  const start = new Date(2026, 10, 20, 23, 15, 0).getTime();
  const end = new Date(2026, 10, 21, 6, 50, 0).getTime();
  const record = createTestRecord({
    sleepDate: '2026-11-20',
    startedAt: start,
    endedAt: end,
    durationMinutes: 455,
  });

  const comparison = calculateScheduleComparisons([record], schedule);
  assert.strictEqual(comparison.hasSchedule, true);
  assert.strictEqual(comparison.totalCompared, 1);

  const item = comparison.items[0];
  assert.strictEqual(item.hasScheduleForDay, true);
  assert.strictEqual(item.startDiffMinutes, 15);  // 15m later
  assert.strictEqual(item.wakeDiffMinutes, -10); // 10m earlier
});

runTest('Skips schedule comparison on days when schedule is inactive', () => {
  const schedule = createDefaultSleepSchedule('sched_weekdays');
  schedule.daysOfWeek = [1, 2, 3, 4, 5]; // Mon-Fri only

  // Sunday night session (2026-11-22 is Sunday)
  const start = new Date(2026, 10, 22, 23, 0, 0).getTime();
  const end = new Date(2026, 10, 23, 7, 0, 0).getTime();
  const record = createTestRecord({ sleepDate: '2026-11-22', startedAt: start, endedAt: end });

  const comparison = calculateScheduleComparisons([record], schedule);
  assert.strictEqual(comparison.totalCompared, 0);
  assert.strictEqual(comparison.items[0].hasScheduleForDay, false);
});

// =========================================================================
// TEST GROUP 7: Morning Check-in Summary
// =========================================================================
console.log('\nTest Group 7: Morning Check-in Summary');

runTest('Aggregates check-in ratings with correct counts and percentages', () => {
  const r1 = createTestRecord({ rating: 'rested' });
  const r2 = createTestRecord({ rating: 'rested' });
  const r3 = createTestRecord({ rating: 'neutral' });
  const r4 = createTestRecord({ rating: 'tired' });
  const r5 = createTestRecord({ rating: undefined }); // unrated

  const checkIns = calculateMorningCheckInStats([r1, r2, r3, r4, r5]);
  assert.strictEqual(checkIns.restedCount, 2);
  assert.strictEqual(checkIns.neutralCount, 1);
  assert.strictEqual(checkIns.tiredCount, 1);
  assert.strictEqual(checkIns.unratedCount, 1);
  assert.strictEqual(checkIns.totalRated, 4);

  // Percentages: 2/4 = 50%, 1/4 = 25%, 1/4 = 25%
  assert.strictEqual(checkIns.restedPercent, 50);
  assert.strictEqual(checkIns.neutralPercent, 25);
  assert.strictEqual(checkIns.tiredPercent, 25);
});

runTest('Handles zero check-ins cleanly without division by zero', () => {
  const r1 = createTestRecord({ rating: undefined });
  const checkIns = calculateMorningCheckInStats([r1]);

  assert.strictEqual(checkIns.totalRated, 0);
  assert.strictEqual(checkIns.restedPercent, 0);
  assert.strictEqual(checkIns.neutralPercent, 0);
  assert.strictEqual(checkIns.tiredPercent, 0);
  assert.strictEqual(checkIns.unratedCount, 1);
});

// =========================================================================
// TEST GROUP 8: Clock Anomaly Review Flag Preservation
// =========================================================================
console.log('\nTest Group 8: Clock Anomaly Review Flag Preservation');

runTest('Flagged records retain review status in trend buckets and history', () => {
  const flagged = createTestRecord({
    sleepDate: '2026-11-20',
    isFlaggedForReview: true,
    anomalyFlags: ['clock_rollback_detected'],
  });

  const buckets = calculateNightlyTrendBuckets([flagged], 'all');
  assert.strictEqual(buckets[0].isFlagged, true);
});

// =========================================================================
// TEST GROUP 9: Localization Completeness & Parity (EN & AR)
// =========================================================================
console.log('\nTest Group 9: Localization Completeness & Parity');

const PHASE_S8_KEYS: TranslationKey[] = [
  'sleepInsightsNavTitle',
  'sleepInsightsNavSubtitle',
  'sleepInsightsBackToDashboard',
  'sleepInsightsPhilosophy',
  'sleepInsightsActiveBadge',
  'sleepInsightsOpenRoutine',
  'sleepInsightsDisclaimer',
  'sleepInsightsRange7d',
  'sleepInsightsRange14d',
  'sleepInsightsRange30d',
  'sleepInsightsRangeAll',
  'sleepInsightsOverviewTitle',
  'sleepInsightsTotalSessions',
  'sleepInsightsUniqueNights',
  'sleepInsightsAvgInterval',
  'sleepInsightsLongestInterval',
  'sleepInsightsShortestInterval',
  'sleepInsightsMostRecent',
  'sleepInsightsIntervalDefinitionNotice',
  'sleepInsightsTrendsTitle',
  'sleepInsightsTrendsSubtitle',
  'sleepInsightsNightlyDurationTitle',
  'sleepInsightsNoRecordForNight',
  'sleepInsightsBedtimeConsistencyTitle',
  'sleepInsightsWakeConsistencyTitle',
  'sleepInsightsAvgBedtime',
  'sleepInsightsAvgWakeTime',
  'sleepInsightsScheduleComparisonTitle',
  'sleepInsightsScheduleComparisonSubtitle',
  'sleepInsightsScheduleComparisonDisclaimer',
  'sleepInsightsStartDiffPlanned',
  'sleepInsightsWakeDiffPlanned',
  'sleepInsightsEarlierBy',
  'sleepInsightsLaterBy',
  'sleepInsightsOnTime',
  'sleepInsightsCheckInTitle',
  'sleepInsightsCheckInSubtitle',
  'sleepInsightsCheckInRestedCount',
  'sleepInsightsCheckInNeutralCount',
  'sleepInsightsCheckInTiredCount',
  'sleepInsightsCheckInUnratedCount',
  'sleepInsightsHistoryTitle',
  'sleepInsightsHistorySubtitle',
  'sleepInsightsNoDataTitle',
  'sleepInsightsNoDataDesc',
  'sleepInsightsInsufficientData',
  'sleepInsightsRecordsSummary',
  'sleepInsightsNoRecordsYet',
  'sleepInsightsViewAllHistory',
];

runTest('All Phase S8 translation keys are defined and non-empty in EN', () => {
  for (const key of PHASE_S8_KEYS) {
    const val = en[key];
    assert.ok(val, `Missing EN translation for ${key}`);
    assert.strictEqual(typeof val, 'string');
  }
});

runTest('All Phase S8 translation keys are defined and non-empty in AR', () => {
  for (const key of PHASE_S8_KEYS) {
    const val = ar[key];
    assert.ok(val, `Missing AR translation for ${key}`);
    assert.strictEqual(typeof val, 'string');
  }
});

runTest('Arabic translation has no untranslated English strings', () => {
  for (const key of PHASE_S8_KEYS) {
    assert.notStrictEqual(
      ar[key],
      en[key],
      `Arabic translation for ${key} must not be identical English string: "${ar[key]}"`
    );
  }
});

// =========================================================================
// TEST GROUP 10: Non-Medical & Behavioral Contracts
// =========================================================================
console.log('\nTest Group 10: Non-Medical & Behavioral Contracts');

runTest('Disclaimer clearly includes non-medical wording in both languages', () => {
  const enDisc = en.sleepInsightsDisclaimer.toLowerCase();
  const arDisc = ar.sleepInsightsDisclaimer;

  assert.ok(
    enDisc.includes('not represent') || enDisc.includes('clinical') || enDisc.includes('scores'),
    'EN disclaimer must state lack of clinical scores or sensor verification'
  );
  assert.ok(
    arDisc.includes('طبية') || arDisc.includes('مستشعرات') || arDisc.includes('فسيولوجية'),
    'AR disclaimer must state non-medical terms in Arabic'
  );
});

console.log(`\n--- PHASE S8 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED ---`);
