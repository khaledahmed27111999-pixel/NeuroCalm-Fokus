/**
 * NeuroCalm & Fokus — Phase S4 Sleep Navigation & Dashboard Test Suite
 * Automated tests for:
 * 1. PillarTab navigation integration & Pillar 4 contracts.
 * 2. Translation key completeness, parity, and parameter interpolation in EN and AR.
 * 3. Sleep tracking state lifecycle, duplicate session prevention, and manual recording.
 * 4. Anchor date preservation during manual tracking.
 * 5. Next schedule calculations integration and empty state handling.
 * 6. Historical records display, reflections, and clock anomaly resilience.
 * 7. Planned quick-access module configurations (S5-S8).
 */

import assert from 'node:assert';
import { PillarTab, NavigationItem } from '../src/types/navigation';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import {
  ActiveSleepSession,
  SleepRecord,
  SleepSchedule,
  SleepPreferences,
  SleepRating,
} from '../src/types/sleep';
import {
  loadActiveSleepSession,
  startActiveSleepSession,
  clearActiveSleepSession,
  updateActiveSleepSession,
} from '../src/storage/sleepActiveStorage';
import {
  loadSleepRecords,
  saveSleepRecord,
  updateMorningReflection,
  clearSleepRecords,
} from '../src/storage/sleepRecordsStorage';
import {
  loadSleepSchedules,
  saveSleepSchedule,
  clearSleepSchedules,
  createDefaultSleepSchedule,
} from '../src/storage/sleepScheduleStorage';
import {
  loadSleepPreferences,
  saveSleepPreferences,
  DEFAULT_SLEEP_PREFERENCES,
} from '../src/storage/sleepPreferencesStorage';
import {
  calculateAnchorDate,
  calculateSleepDuration,
  DEFAULT_ANCHOR_BOUNDARY_TIME,
} from '../src/utils/sleepTimeUtils';
import {
  calculateNextBedtime,
  calculateNextWakeUp,
} from '../src/utils/sleepScheduleUtils';
import { formatDuration } from '../src/utils/dashboardMetrics';
import { generateId } from '../src/utils/id';

// --- IN-MEMORY MOCK LOCALSTORAGE FOR NODE.JS TEST HARNESS ---

class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockStorage = new MockStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage as unknown as Storage;

function resetStorage(): void {
  mockStorage.clear();
}

console.log('--- STARTING PHASE S4 SLEEP NAVIGATION & DASHBOARD TEST SUITE ---\n');

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

// =========================================================================
// TEST GROUP 1: PillarTab Navigation Integration
// =========================================================================
console.log('Test Group 1: Navigation Integration & Pillar 4 Contracts');

runTest('PillarTab includes sleep as the fourth pillar', () => {
  const tabs: PillarTab[] = ['plan', 'focus', 'recover', 'sleep'];
  assert.strictEqual(tabs.length, 4);
  assert.ok(tabs.includes('sleep'));
});

runTest('NavigationItem contract accepts sleep label and subtitle keys', () => {
  const sleepNavItem: NavigationItem = {
    id: 'sleep',
    labelKey: 'navSleep',
    descriptionKey: 'sleepSubtitle',
  };
  assert.strictEqual(sleepNavItem.id, 'sleep');
  assert.strictEqual(sleepNavItem.labelKey, 'navSleep');
  assert.strictEqual(sleepNavItem.descriptionKey, 'sleepSubtitle');
});

// =========================================================================
// TEST GROUP 2: Translation Completeness & Parity
// =========================================================================
console.log('\nTest Group 2: Translation Completeness & Parity');

runTest('English and Arabic dictionaries contain all Pillar 4 navigation keys', () => {
  assert.strictEqual(en.navSleep, 'Sleep');
  assert.strictEqual(ar.navSleep, 'النوم');

  assert.ok(en.sleepTitle.includes('Pillar 4: Sleep'));
  assert.ok(ar.sleepTitle.includes('الركن الرابع: النوم'));

  assert.ok(en.sleepSubtitle.length > 0);
  assert.ok(ar.sleepSubtitle.length > 0);

  assert.ok(en.sleepDescription.length > 0);
  assert.ok(ar.sleepDescription.length > 0);

  assert.ok(en.actionSleepMessage.length > 0);
  assert.ok(ar.actionSleepMessage.length > 0);
});

runTest('All Phase S4 translation keys exist in both English and Arabic', () => {
  const requiredS4Keys = [
    'navSleep',
    'sleepTitle',
    'sleepSubtitle',
    'sleepDescription',
    'actionSleepMessage',
    'sleepStatusTitle',
    'sleepStatusIdle',
    'sleepStatusIdleDesc',
    'sleepStatusTracking',
    'sleepStatusTrackingDesc',
    'sleepStartAction',
    'sleepWakeAction',
    'sleepCancelAction',
    'sleepCancelConfirmTitle',
    'sleepCancelConfirmMessage',
    'sleepCancelConfirmKeep',
    'sleepCancelConfirmDiscard',
    'sleepSessionStartedAt',
    'sleepSessionElapsed',
    'sleepAnchorNight',
    'sleepIntentionNotesPlaceholder',
    'sleepLatestCompletedTitle',
    'sleepLatestCompletedNone',
    'sleepLatestCompletedInterval',
    'sleepNextScheduleTitle',
    'sleepNextBedtimeLabel',
    'sleepNextWakeLabel',
    'sleepNoScheduleTitle',
    'sleepNoScheduleDesc',
    'sleepReminderLeadNotice',
    'sleepQuickAccessTitle',
    'sleepQuickAccessSubtitle',
    'sleepModulePrepTitle',
    'sleepModulePrepDesc',
    'sleepModulePrepBadge',
    'sleepModuleSoundsTitle',
    'sleepModuleSoundsDesc',
    'sleepModuleSoundsBadge',
    'sleepModuleScheduleTitle',
    'sleepModuleScheduleDesc',
    'sleepModuleScheduleBadge',
    'sleepModuleInsightsTitle',
    'sleepModuleInsightsDesc',
    'sleepModuleInsightsBadge',
    'sleepModuleUnavailableNotice',
    'sleepRecentActivityTitle',
    'sleepRecentActivitySubtitle',
    'sleepRecentEmptyTitle',
    'sleepRecentEmptyDesc',
    'sleepRecordSourceRealtime',
    'sleepRecordSourceRetroactive',
    'sleepRecordRatingRested',
    'sleepRecordRatingNeutral',
    'sleepRecordRatingTired',
    'sleepRecordFlaggedNotice',
    'sleepRecordDurationFormat',
    'sleepReflectionPrompt',
    'sleepReflectionOptional',
    'sleepReflectionSave',
    'sleepReflectionSkip',
    'sleepActiveSessionAlert',
    'sleepRecordEditedBadge',
  ] as const;

  for (const key of requiredS4Keys) {
    assert.ok(key in en, `Missing English translation for ${key}`);
    assert.ok(key in ar, `Missing Arabic translation for ${key}`);
    assert.ok(typeof en[key] === 'string' && en[key].trim().length > 0, `Empty English string for ${key}`);
    assert.ok(typeof ar[key] === 'string' && ar[key].trim().length > 0, `Empty Arabic string for ${key}`);
  }
});

runTest('Parameter substitution in sleepReminderLeadNotice works in EN and AR', () => {
  const enTemplate = en.sleepReminderLeadNotice;
  const arTemplate = ar.sleepReminderLeadNotice;

  const enResult = enTemplate.replace('{minutes}', '30');
  const arResult = arTemplate.replace('{minutes}', '30');

  assert.ok(enResult.includes('30 min before'));
  assert.ok(arResult.includes('30 دقيقة'));
});

// =========================================================================
// TEST GROUP 3: Manual Sleep Recording Lifecycle & Invariant Protection
// =========================================================================
console.log('\nTest Group 3: Manual Sleep Recording Lifecycle & Invariant Protection');

runTest('Idle state: No active session initially exists', () => {
  resetStorage();
  const session = loadActiveSleepSession();
  assert.strictEqual(session, null);
});

runTest('Started Sleep creates active session with valid anchor date and timestamp', () => {
  resetStorage();
  const now = new Date(2026, 10, 21, 23, 15, 0).getTime(); // Nov 21 23:15
  const anchor = calculateAnchorDate(now, '06:00');

  const newSession: ActiveSleepSession = {
    id: 'active_session_1',
    version: 1,
    status: 'tracking',
    startedAt: now,
    sleepDate: anchor,
    timezoneOffsetMinutes: 0,
    createdAt: now,
    notes: 'Wind-down reading before rest',
  };

  const startRes = startActiveSleepSession(newSession);
  assert.strictEqual(startRes.success, true);
  assert.strictEqual(startRes.isDuplicate, false);

  const loaded = loadActiveSleepSession();
  assert.ok(loaded);
  assert.strictEqual(loaded.id, 'active_session_1');
  assert.strictEqual(loaded.sleepDate, '2026-11-21');
  assert.strictEqual(loaded.notes, 'Wind-down reading before rest');
});

runTest('Duplicate session prevention: Rejects second active session when one is running', () => {
  // Session is already running from previous test
  const duplicateSession: ActiveSleepSession = {
    id: 'active_session_2',
    version: 1,
    status: 'tracking',
    startedAt: Date.now(),
    sleepDate: '2026-11-21',
    timezoneOffsetMinutes: 0,
    createdAt: Date.now(),
  };

  const startRes = startActiveSleepSession(duplicateSession);
  assert.strictEqual(startRes.success, false);
  assert.strictEqual(startRes.isDuplicate, true);
  assert.strictEqual(startRes.activeSession.id, 'active_session_1');
});

runTest('Woke Up completes session, creates SleepRecord in history, and clears active session', () => {
  const active = loadActiveSleepSession();
  assert.ok(active);

  // Woke up 8 hours later
  const endedAt = active.startedAt + 8 * 60 * 60 * 1000;
  const calc = calculateSleepDuration(active.startedAt, endedAt, endedAt);

  const record: SleepRecord = {
    id: generateId(),
    version: 1,
    sleepDate: active.sleepDate,
    startedAt: active.startedAt,
    endedAt,
    durationMinutes: calc.durationMinutes,
    durationMs: calc.durationMs,
    timezoneOffsetMinutes: active.timezoneOffsetMinutes,
    source: 'manual_realtime',
    notes: active.notes,
    createdAt: endedAt,
    updatedAt: endedAt,
  };

  const saved = saveSleepRecord(record);
  assert.strictEqual(saved, true);

  clearActiveSleepSession();
  assert.strictEqual(loadActiveSleepSession(), null);

  const records = loadSleepRecords();
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].sleepDate, '2026-11-21');
  assert.strictEqual(records[0].durationMinutes, 480);
  assert.strictEqual(records[0].source, 'manual_realtime');
  assert.strictEqual(records[0].notes, 'Wind-down reading before rest');
});

runTest('Session cancellation: Discards active session without saving a corrupted record', () => {
  resetStorage();

  const cancelSession: ActiveSleepSession = {
    id: 'active_session_cancel',
    version: 1,
    status: 'tracking',
    startedAt: Date.now(),
    sleepDate: '2026-11-21',
    timezoneOffsetMinutes: 0,
    createdAt: Date.now(),
  };

  startActiveSleepSession(cancelSession);
  assert.ok(loadActiveSleepSession());

  // User cancels tracking
  clearActiveSleepSession();
  assert.strictEqual(loadActiveSleepSession(), null);

  const records = loadSleepRecords();
  assert.strictEqual(records.length, 0); // No record created!
});

// =========================================================================
// TEST GROUP 4: Anchor Date Calculation in Manual Tracking
// =========================================================================
console.log('\nTest Group 4: Anchor Date Calculation in Manual Tracking');

runTest('Evening session (23:30 on Nov 21) anchors to 2026-11-21', () => {
  const eveningMs = new Date(2026, 10, 21, 23, 30, 0).getTime();
  const anchor = calculateAnchorDate(eveningMs, '06:00');
  assert.strictEqual(anchor, '2026-11-21');
});

runTest('Post-midnight session (02:15 on Nov 22) anchors to previous night 2026-11-21', () => {
  const postMidnightMs = new Date(2026, 10, 22, 2, 15, 0).getTime();
  const anchor = calculateAnchorDate(postMidnightMs, '06:00');
  assert.strictEqual(anchor, '2026-11-21');
});

runTest('Morning session after boundary (07:00 on Nov 22) anchors to 2026-11-22', () => {
  const morningMs = new Date(2026, 10, 22, 7, 0, 0).getTime();
  const anchor = calculateAnchorDate(morningMs, '06:00');
  assert.strictEqual(anchor, '2026-11-22');
});

// =========================================================================
// TEST GROUP 5: Next Schedule Calculations Integration
// =========================================================================
console.log('\nTest Group 5: Next Schedule Calculations Integration');

runTest('Empty schedules array returns null for bedtime and wake-up', () => {
  const nextBed = calculateNextBedtime([]);
  const nextWake = calculateNextWakeUp([]);
  assert.strictEqual(nextBed, null);
  assert.strictEqual(nextWake, null);
});

runTest('Active schedule calculates next upcoming bedtime and wake-up correctly', () => {
  const schedule: SleepSchedule = {
    id: 'sched_daily',
    version: 1,
    enabled: true,
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    bedtimeReminder: { enabled: true, leadTimeMinutes: 30 },
    wakeReminder: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Reference time: 14:00 on Nov 21
  const refDate = new Date(2026, 10, 21, 14, 0, 0);
  const nextBed = calculateNextBedtime([schedule], refDate);
  const nextWake = calculateNextWakeUp([schedule], refDate);

  assert.ok(nextBed);
  assert.strictEqual(nextBed.formattedTime, '23:00');
  assert.strictEqual(nextBed.scheduleDate, '2026-11-21');

  assert.ok(nextWake);
  assert.strictEqual(nextWake.formattedTime, '07:00');
});

runTest('Disabled schedule is ignored in calculations', () => {
  const disabledSchedule: SleepSchedule = {
    id: 'sched_disabled',
    version: 1,
    enabled: false,
    targetBedtime: '22:00',
    targetWakeTime: '06:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    bedtimeReminder: { enabled: false, leadTimeMinutes: 30 },
    wakeReminder: { enabled: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const nextBed = calculateNextBedtime([disabledSchedule]);
  assert.strictEqual(nextBed, null);
});

// =========================================================================
// TEST GROUP 6: Recent Activity History, Formatting & Reflections
// =========================================================================
console.log('\nTest Group 6: Recent Activity History & Reflections');

runTest('formatDuration outputs non-judgmental duration in EN and AR', () => {
  assert.strictEqual(formatDuration(480, 'en'), '8h');
  assert.strictEqual(formatDuration(480, 'ar'), '8 س');

  assert.strictEqual(formatDuration(465, 'en'), '7h 45m');
  assert.strictEqual(formatDuration(465, 'ar'), '7 س 45 د');

  assert.strictEqual(formatDuration(30, 'en'), '30m');
  assert.strictEqual(formatDuration(30, 'ar'), '30 د');
});

runTest('Updating morning reflection adds gentle rating without modifying timestamps', () => {
  resetStorage();

  const record: SleepRecord = {
    id: 'rec_reflect_1',
    version: 1,
    sleepDate: '2026-11-21',
    startedAt: 1763931600000,
    endedAt: 1763960400000,
    durationMinutes: 480,
    durationMs: 480 * 60 * 1000,
    timezoneOffsetMinutes: 0,
    source: 'manual_realtime',
    createdAt: 1763960400000,
    updatedAt: 1763960400000,
  };

  saveSleepRecord(record);

  // User adds reflection upon waking
  const updated = updateMorningReflection('rec_reflect_1', 'rested', 'Slept deeply after reading');
  assert.strictEqual(updated, true);

  const loaded = loadSleepRecords();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].rating, 'rested');
  assert.strictEqual(loaded[0].notes, 'Slept deeply after reading');
  assert.strictEqual(loaded[0].startedAt, 1763931600000); // Unaltered!
  assert.strictEqual(loaded[0].endedAt, 1763960400000);   // Unaltered!
});

runTest('Clock anomaly detection flags record for review without dropping data', () => {
  resetStorage();

  // Simulated clock rollback: endedAt < startedAt
  const startedAt = Date.now();
  const endedAt = startedAt - 3600000;
  const calc = calculateSleepDuration(startedAt, endedAt, startedAt);

  assert.strictEqual(calc.isFlaggedForReview, true);
  assert.ok(calc.anomalies.includes('end_before_start'));

  const flaggedRecord: SleepRecord = {
    id: 'rec_anomaly_1',
    version: 1,
    sleepDate: '2026-11-21',
    startedAt,
    endedAt,
    durationMinutes: calc.durationMinutes,
    durationMs: calc.durationMs,
    timezoneOffsetMinutes: 0,
    source: 'manual_realtime',
    anomalyFlags: calc.anomalies,
    isFlaggedForReview: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const saved = saveSleepRecord(flaggedRecord);
  assert.strictEqual(saved, true);

  const loaded = loadSleepRecords();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].isFlaggedForReview, true);
  assert.deepStrictEqual(loaded[0].anomalyFlags, ['end_before_start']);
});

// =========================================================================
// TEST GROUP 7: Quick Access Planned Modules Contract
// =========================================================================
console.log('\nTest Group 7: Quick Access Planned Modules Contract');

runTest('All 4 planned modules have explicit planned badges and descriptions', () => {
  const modules = [
    { title: en.sleepModulePrepTitle, badge: en.sleepModulePrepBadge },
    { title: en.sleepModuleSoundsTitle, badge: en.sleepModuleSoundsBadge },
    { title: en.sleepModuleScheduleTitle, badge: en.sleepModuleScheduleBadge },
    { title: en.sleepModuleInsightsTitle, badge: en.sleepModuleInsightsBadge },
  ];

  assert.strictEqual(modules.length, 4);
  assert.ok(modules[0].badge.includes('Phase S5'));
  assert.ok(modules[1].badge.includes('Phase S6'));
  assert.ok(modules[2].badge.includes('Phase S7'));
  assert.ok(modules[3].badge.includes('Phase S8'));
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! ---`);
