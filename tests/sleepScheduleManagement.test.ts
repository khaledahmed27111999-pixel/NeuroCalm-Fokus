/**
 * NeuroCalm & Fokus — Phase S7 Sleep Schedule Management & Configuration Test Suite
 * Automated tests for:
 * 1. Saving and editing target bedtime.
 * 2. Saving and editing target wake-up time.
 * 3. Selecting and toggling weekdays (presets, individual days, validation).
 * 4. Cross-midnight schedule duration and event resolution.
 * 5. Enabling and disabling the complete schedule while preserving settings.
 * 6. Bedtime reminder configuration, lead times, and backward midnight time calculations.
 * 7. Wake-up reminder independent configuration.
 * 8. Independent reminder settings orthogonality.
 * 9. Schedule changes and reminder occurrence identity distinction.
 * 10. Preventing duplicate or stale reminders (reconciliation and expiration).
 * 11. Anchor Night boundary compatibility and date assignment.
 * 12. Storage persistence, validation guards, and corrupted data recovery.
 * 13. Arabic and English localization coverage and parity.
 * 14. Dashboard integration helpers and schedule status calculations.
 */

import assert from 'node:assert';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { TranslationKey } from '../src/types/locale';
import {
  SleepSchedule,
  DayOfWeek,
  ALL_DAYS_OF_WEEK,
  WORKDAYS_OF_WEEK,
  WEEKEND_DAYS_OF_WEEK,
} from '../src/types/sleep';
import {
  isValidSleepSchedule,
  createDefaultSleepSchedule,
  loadSleepSchedules,
  saveSleepSchedules,
  saveSleepSchedule,
  deleteSleepSchedule,
} from '../src/storage/sleepScheduleStorage';
import {
  loadSleepPreferences,
  saveSleepPreferences,
  DEFAULT_SLEEP_PREFERENCES,
} from '../src/storage/sleepPreferencesStorage';
import {
  createReminderOccurrenceId,
  evaluateReminderOccurrence,
  REMINDER_EXPIRATION_WINDOW_MS,
} from '../src/utils/sleepReminderUtils';
import {
  calculateScheduleDurationMinutes,
  isCrossMidnightSchedule,
  calculateReminderClockTime,
  calculateNextBedtime,
  calculateNextWakeUp,
  resolveScheduleOccurrences,
} from '../src/utils/sleepScheduleUtils';
import {
  calculateAnchorDate,
  isValidAnchorBoundary,
  isValidTimeString,
  parseTimeString,
} from '../src/utils/sleepTimeUtils';
import { SLEEP_SCHEDULE_STORAGE_KEY } from '../src/storage/sleepStorageKeys';

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

console.log('--- STARTING PHASE S7 SLEEP SCHEDULE MANAGEMENT TEST SUITE ---\n');

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
// TEST GROUP 1: Bedtime & Wake-Up Configuration
// =========================================================================
console.log('Test Group 1: Bedtime & Wake-Up Configuration');

runTest('Saving and editing target bedtime updates schedule properly', () => {
  resetStorage();
  const schedule = createDefaultSleepSchedule('sched_1');
  assert.strictEqual(schedule.targetBedtime, '23:00');

  saveSleepSchedule(schedule);
  let loaded = loadSleepSchedules();
  assert.strictEqual(loaded[0].targetBedtime, '23:00');

  // Edit bedtime
  const updated: SleepSchedule = { ...loaded[0], targetBedtime: '22:30' };
  const saved = saveSleepSchedule(updated);
  assert.strictEqual(saved, true);

  loaded = loadSleepSchedules();
  assert.strictEqual(loaded[0].targetBedtime, '22:30');
});

runTest('Saving and editing target wake-up time works independently', () => {
  resetStorage();
  const schedule = createDefaultSleepSchedule('sched_1');
  saveSleepSchedule(schedule);

  const updated: SleepSchedule = { ...schedule, targetWakeTime: '06:15' };
  saveSleepSchedule(updated);

  const loaded = loadSleepSchedules();
  assert.strictEqual(loaded[0].targetWakeTime, '06:15');
  assert.strictEqual(loaded[0].targetBedtime, '23:00');
});

runTest('Invalid time strings are rejected defensively', () => {
  assert.strictEqual(isValidTimeString('24:00'), false);
  assert.strictEqual(isValidTimeString('12:60'), false);
  assert.strictEqual(isValidTimeString('abc'), false);
  assert.strictEqual(isValidTimeString(''), false);
  assert.strictEqual(isValidTimeString('23:59'), true);
  assert.strictEqual(isValidTimeString('00:00'), true);
});

// =========================================================================
// TEST GROUP 2: Weekday Selection & Presets
// =========================================================================
console.log('\nTest Group 2: Weekday Selection & Presets');

runTest('All 7 weekdays are selectable and sortable', () => {
  resetStorage();
  const schedule = createDefaultSleepSchedule('sched_1');
  schedule.daysOfWeek = [4, 1, 5]; // Thursday, Monday, Friday
  schedule.daysOfWeek.sort((a, b) => a - b);
  saveSleepSchedule(schedule);

  const loaded = loadSleepSchedules();
  assert.deepStrictEqual(loaded[0].daysOfWeek, [1, 4, 5]);
});

runTest('Workdays and Weekends presets match expected days', () => {
  assert.deepStrictEqual(WORKDAYS_OF_WEEK, [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(WEEKEND_DAYS_OF_WEEK, [0, 6]);
  assert.strictEqual(ALL_DAYS_OF_WEEK.length, 7);
});

runTest('Schedule with duplicate days is rejected by validation', () => {
  const schedule = createDefaultSleepSchedule('bad_sched');
  (schedule.daysOfWeek as number[]) = [1, 2, 2, 3];
  assert.strictEqual(isValidSleepSchedule(schedule), false);
});

// =========================================================================
// TEST GROUP 3: Cross-Midnight Schedule Behavior & Duration
// =========================================================================
console.log('\nTest Group 3: Cross-Midnight Schedule Behavior & Duration');

runTest('Calculates correct duration for evening to morning schedule (crosses midnight)', () => {
  // Bedtime 23:00 to Wake 07:00 -> 8 hours (480 minutes)
  const duration = calculateScheduleDurationMinutes('23:00', '07:00');
  assert.strictEqual(duration, 480);
  assert.strictEqual(isCrossMidnightSchedule('23:00', '07:00'), true);
});

runTest('Calculates correct duration for late night to morning schedule (crosses midnight)', () => {
  // Bedtime 23:30 to Wake 06:45 -> 7 hours 15 minutes (435 minutes)
  const duration = calculateScheduleDurationMinutes('23:30', '06:45');
  assert.strictEqual(duration, 435);
  assert.strictEqual(isCrossMidnightSchedule('23:30', '06:45'), true);
});

runTest('Calculates correct duration for post-midnight bedtime (same morning rest)', () => {
  // Bedtime 01:00 to Wake 09:30 -> 8 hours 30 minutes (510 minutes)
  const duration = calculateScheduleDurationMinutes('01:00', '09:30');
  assert.strictEqual(duration, 510);
  assert.strictEqual(isCrossMidnightSchedule('01:00', '09:30'), false);
});

runTest('Resolves exact dates across midnight for an anchor date', () => {
  const schedule = createDefaultSleepSchedule('sched_1');
  schedule.targetBedtime = '23:15';
  schedule.targetWakeTime = '07:30';

  const anchorDate = new Date(2026, 10, 21); // Nov 21, 2026
  const occurrences = resolveScheduleOccurrences(schedule, anchorDate);
  assert.ok(occurrences);

  assert.strictEqual(occurrences.bedtimeDate.getDate(), 21);
  assert.strictEqual(occurrences.bedtimeDate.getHours(), 23);
  assert.strictEqual(occurrences.bedtimeDate.getMinutes(), 15);

  assert.strictEqual(occurrences.wakeDate.getDate(), 22); // Next calendar day
  assert.strictEqual(occurrences.wakeDate.getHours(), 7);
  assert.strictEqual(occurrences.wakeDate.getMinutes(), 30);
});

// =========================================================================
// TEST GROUP 4: Enabling and Disabling Schedule
// =========================================================================
console.log('\nTest Group 4: Enabling and Disabling Schedule');

runTest('Disabling schedule preserves configuration without deletion', () => {
  resetStorage();
  const schedule = createDefaultSleepSchedule('sched_1');
  schedule.targetBedtime = '22:45';
  schedule.enabled = true;
  saveSleepSchedule(schedule);

  // Toggle disabled
  const disabledSchedule = { ...schedule, enabled: false };
  saveSleepSchedule(disabledSchedule);

  const loaded = loadSleepSchedules();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].enabled, false);
  assert.strictEqual(loaded[0].targetBedtime, '22:45');
});

runTest('Disabled schedule produces no upcoming next events', () => {
  const schedule = createDefaultSleepSchedule('sched_disabled');
  schedule.enabled = false;
  const refDate = new Date(2026, 10, 21, 12, 0, 0);

  const nextBed = calculateNextBedtime([schedule], refDate);
  assert.strictEqual(nextBed, null);

  const nextWake = calculateNextWakeUp([schedule], refDate);
  assert.strictEqual(nextWake, null);
});

// =========================================================================
// TEST GROUP 5: Reminders Configuration & Lead Time Calculations
// =========================================================================
console.log('\nTest Group 5: Reminders Configuration & Lead Time Calculations');

runTest('Calculates reminder clock time wrapping backward past midnight', () => {
  // Standard: 23:00 with 30m lead -> 22:30
  assert.strictEqual(calculateReminderClockTime('23:00', 30), '22:30');
  // Wrapping: 00:15 with 30m lead -> 23:45
  assert.strictEqual(calculateReminderClockTime('00:15', 30), '23:45');
  // Wrapping: 00:00 with 45m lead -> 23:15
  assert.strictEqual(calculateReminderClockTime('00:00', 45), '23:15');
  // Edge: 01:00 with 60m lead -> 00:00
  assert.strictEqual(calculateReminderClockTime('01:00', 60), '00:00');
});

runTest('Bedtime and wake-up reminders are independently toggled', () => {
  resetStorage();
  const schedule = createDefaultSleepSchedule('sched_rem');
  schedule.bedtimeReminder.enabled = false;
  schedule.wakeReminder.enabled = true;
  saveSleepSchedule(schedule);

  const loaded = loadSleepSchedules();
  assert.strictEqual(loaded[0].bedtimeReminder.enabled, false);
  assert.strictEqual(loaded[0].wakeReminder.enabled, true);
});

// =========================================================================
// TEST GROUP 6: Schedule Changes & Reminder Identity Safeguards
// =========================================================================
console.log('\nTest Group 6: Schedule Changes & Reminder Identity Safeguards');

runTest('createReminderOccurrenceId binds to scheduled timestamp to prevent collision', () => {
  const id1 = createReminderOccurrenceId('bedtime_prep', 'sched_1', '2026-11-21', 1763758800000);
  const id2 = createReminderOccurrenceId('bedtime_prep', 'sched_1', '2026-11-21', 1763762400000);

  assert.notStrictEqual(id1, id2, 'Changing scheduled timestamp must produce distinct occurrence ID');
});

runTest('Handling old occurrence does not suppress new schedule occurrence', () => {
  const handledIds = new Set<string>();
  const oldScheduledTime = new Date(2026, 10, 21, 21, 30, 0).getTime();
  const oldId = createReminderOccurrenceId('bedtime_prep', 'sched_1', '2026-11-21', oldScheduledTime);
  handledIds.add(oldId);

  // User changed bedtime, moving reminder to 22:30
  const newScheduledTime = new Date(2026, 10, 21, 22, 30, 0).getTime();
  const newId = createReminderOccurrenceId('bedtime_prep', 'sched_1', '2026-11-21', newScheduledTime);

  assert.strictEqual(handledIds.has(oldId), true);
  assert.strictEqual(handledIds.has(newId), false, 'New scheduled occurrence must not be marked handled');
});

runTest('evaluateReminderOccurrence identifies expired reminders outside 15m window', () => {
  const schedule = createDefaultSleepSchedule('sched_1');
  const scheduledTime = 1000000000;
  const nowOverdue = scheduledTime + REMINDER_EXPIRATION_WINDOW_MS + 1000; // Overdue by 16 minutes

  const evaluated = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule,
    scheduleDateStr: '2026-11-21',
    scheduledTimestamp: scheduledTime,
    referenceNow: nowOverdue,
    handledOccurrenceIds: new Set(),
  });

  assert.strictEqual(evaluated.status, 'expired');
  assert.strictEqual(evaluated.isExpired, true);
  assert.strictEqual(evaluated.isDue, false);
});

// =========================================================================
// TEST GROUP 7: Anchor Night Compatibility
// =========================================================================
console.log('\nTest Group 7: Anchor Night Compatibility');

runTest('Validates anchor boundary times between 02:00 and 12:00', () => {
  assert.strictEqual(isValidAnchorBoundary('06:00'), true);
  assert.strictEqual(isValidAnchorBoundary('02:00'), true);
  assert.strictEqual(isValidAnchorBoundary('12:00'), true);
  assert.strictEqual(isValidAnchorBoundary('01:59'), false);
  assert.strictEqual(isValidAnchorBoundary('12:01'), false);
  assert.strictEqual(isValidAnchorBoundary('22:00'), false);
});

runTest('Anchor date assigns post-midnight session to previous evening', () => {
  // Session starting Nov 22 at 02:30 with 06:00 boundary belongs to Nov 21
  const earlyMorning = new Date(2026, 10, 22, 2, 30, 0).getTime();
  const anchorDate = calculateAnchorDate(earlyMorning, '06:00');
  assert.strictEqual(anchorDate, '2026-11-21');
});

runTest('Anchor date assigns post-boundary session to current calendar date', () => {
  // Session starting Nov 22 at 06:01 belongs to Nov 22
  const morning = new Date(2026, 10, 22, 6, 1, 0).getTime();
  const anchorDate = calculateAnchorDate(morning, '06:00');
  assert.strictEqual(anchorDate, '2026-11-22');
});

// =========================================================================
// TEST GROUP 8: Storage Persistence & Corruption Recovery
// =========================================================================
console.log('\nTest Group 8: Storage Persistence & Corruption Recovery');

runTest('Corrupted JSON in localStorage is quarantined and returns safe fallback', () => {
  resetStorage();
  localStorage.setItem(SLEEP_SCHEDULE_STORAGE_KEY, '{invalid json');

  const loaded = loadSleepSchedules();
  assert.deepStrictEqual(loaded, []);
});

runTest('Invalid schedule schema objects are filtered out cleanly', () => {
  resetStorage();
  const valid = createDefaultSleepSchedule('valid_1');
  const invalid = { id: 'bad', targetBedtime: '99:99' }; // Invalid time

  localStorage.setItem(SLEEP_SCHEDULE_STORAGE_KEY, JSON.stringify([valid, invalid]));
  const loaded = loadSleepSchedules();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 'valid_1');
});

runTest('deleteSleepSchedule removes the target schedule', () => {
  resetStorage();
  const s1 = createDefaultSleepSchedule('s1');
  const s2 = createDefaultSleepSchedule('s2');
  saveSleepSchedules([s1, s2]);

  deleteSleepSchedule('s1');
  const remaining = loadSleepSchedules();
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, 's2');
});

// =========================================================================
// TEST GROUP 9: Localization Completeness & Parity (EN & AR)
// =========================================================================
console.log('\nTest Group 9: Localization Completeness & Parity');

const PHASE_S7_KEYS: TranslationKey[] = [
  'sleepScheduleNavTitle',
  'sleepScheduleNavSubtitle',
  'sleepScheduleBackToDashboard',
  'sleepSchedulePhilosophy',
  'sleepScheduleActiveBadge',
  'sleepScheduleOpenRoutine',
  'sleepScheduleEnabled',
  'sleepScheduleDisabled',
  'sleepScheduleToggleActive',
  'sleepScheduleBedtimeSection',
  'sleepScheduleBedtimeHint',
  'sleepScheduleWakeSection',
  'sleepScheduleWakeHint',
  'sleepScheduleDurationEstimated',
  'sleepScheduleCrossesMidnight',
  'sleepScheduleSameDay',
  'sleepScheduleDaysSection',
  'sleepScheduleDaysHint',
  'sleepScheduleSelectAllDays',
  'sleepScheduleSelectWorkdays',
  'sleepScheduleSelectWeekends',
  'sleepScheduleRemindersSection',
  'sleepScheduleBedtimeReminder',
  'sleepScheduleBedtimeReminderDesc',
  'sleepScheduleWakeReminder',
  'sleepScheduleWakeReminderDesc',
  'sleepScheduleReminderLead15',
  'sleepScheduleReminderLead30',
  'sleepScheduleReminderLead45',
  'sleepScheduleReminderLead60',
  'sleepScheduleReminderLeadLabel',
  'sleepScheduleCalculatedReminderTime',
  'sleepScheduleNotificationNotice',
  'sleepScheduleAnchorSection',
  'sleepScheduleAnchorBoundary',
  'sleepScheduleAnchorHint',
  'sleepScheduleMorningCheckIn',
  'sleepScheduleMorningCheckInDesc',
  'sleepScheduleSaveSuccess',
  'sleepScheduleValidationInvalidTime',
  'sleepScheduleValidationNoDays',
  'sleepScheduleValidationInvalidAnchor',
  'sleepScheduleResetDefaults',
  'sleepScheduleConfigureButton',
  'sleepScheduleEditButton',
  'sleepScheduleSummaryDays',
  'sleepScheduleSaveChanges',
  'daySunday',
  'dayMonday',
  'dayTuesday',
  'dayWednesday',
  'dayThursday',
  'dayFriday',
  'daySaturday',
  'daySunShort',
  'dayMonShort',
  'dayTueShort',
  'dayWedShort',
  'dayThuShort',
  'dayFriShort',
  'daySatShort',
];

runTest('All Phase S7 translation keys are defined and non-empty in EN', () => {
  for (const key of PHASE_S7_KEYS) {
    const val = en[key];
    assert.ok(val, `Missing EN key: ${key}`);
    assert.strictEqual(typeof val, 'string');
  }
});

runTest('All Phase S7 translation keys are defined and non-empty in AR', () => {
  for (const key of PHASE_S7_KEYS) {
    const val = ar[key];
    assert.ok(val, `Missing AR key: ${key}`);
    assert.strictEqual(typeof val, 'string');
  }
});

runTest('No untranslated fallback English strings remain in Arabic translation', () => {
  for (const key of PHASE_S7_KEYS) {
    assert.notStrictEqual(
      ar[key],
      en[key],
      `Arabic translation for ${key} must not be identical English string: "${ar[key]}"`
    );
  }
});

// =========================================================================
// TEST GROUP 10: Dashboard Integration Contracts
// =========================================================================
console.log('\nTest Group 10: Dashboard Integration Contracts');

runTest('Next upcoming bedtime calculates correctly for current reference date', () => {
  const schedule = createDefaultSleepSchedule('sched_active');
  schedule.targetBedtime = '23:00';
  schedule.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];

  // At 20:00 on Nov 21, next bedtime is tonight at 23:00
  const refDate = new Date(2026, 10, 21, 20, 0, 0);
  const nextBed = calculateNextBedtime([schedule], refDate);
  assert.ok(nextBed);
  assert.strictEqual(nextBed.formattedTime, '23:00');
  assert.strictEqual(nextBed.scheduleDate, '2026-11-21');
});

runTest('Next upcoming wake-up calculates correctly when user is already asleep', () => {
  const schedule = createDefaultSleepSchedule('sched_active');
  schedule.targetBedtime = '23:00';
  schedule.targetWakeTime = '07:00';
  schedule.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];

  // At 02:00 on Nov 22 (asleep), next wake-up is at 07:00 on Nov 22
  const refDate = new Date(2026, 10, 22, 2, 0, 0);
  const nextWake = calculateNextWakeUp([schedule], refDate);
  assert.ok(nextWake);
  assert.strictEqual(nextWake.formattedTime, '07:00');
});

console.log(`\n--- PHASE S7 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED ---`);
