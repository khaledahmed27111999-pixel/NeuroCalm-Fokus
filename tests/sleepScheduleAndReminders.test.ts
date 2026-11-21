/**
 * NeuroCalm & Fokus — Phase S3 Sleep Schedule State Engine & Reminder Logic Test Suite
 * Comprehensive automated verification for schedule calculations, next bedtime/wake derivations,
 * reminder eligibility, duplicate prevention, expiration windows, backlog prevention,
 * and persistence reconciliation.
 */

import assert from 'node:assert';
import {
  DayOfWeek,
  SleepSchedule,
} from '../src/types/sleep';
import {
  getScheduleForDate,
  resolveScheduleOccurrences,
  calculateNextBedtime,
  calculateNextWakeUp,
} from '../src/utils/sleepScheduleUtils';
import {
  createReminderOccurrenceId,
  evaluateReminderOccurrence,
  reconcileReminders,
  REMINDER_EXPIRATION_WINDOW_MS,
} from '../src/utils/sleepReminderUtils';
import {
  loadReminderState,
  saveReminderState,
  markOccurrenceHandled,
  isOccurrenceHandled,
  pruneObsoleteReminders,
  clearHandledOccurrences,
  DEFAULT_REMINDER_STATE,
} from '../src/storage/sleepReminderStorage';
import {
  SLEEP_REMINDERS_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  MAX_HANDLED_REMINDER_IDS,
} from '../src/storage/sleepStorageKeys';

// --- IN-MEMORY MOCK LOCALSTORAGE FOR NODE TEST RUNNER ---

class MockStorage {
  private store: Map<string, string> = new Map();
  public shouldSimulateQuotaError = false;

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldSimulateQuotaError) {
      const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      throw err;
    }
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

const mockStorage = new MockStorage();
(globalThis as unknown as { localStorage: MockStorage }).localStorage = mockStorage;

console.log('=== NEUROCALM & FOKUS — PHASE S3 SLEEP SCHEDULE & REMINDER TEST SUITE ===\n');

// Helper to construct a test schedule
function createTestSchedule(overrides: Partial<SleepSchedule> = {}): SleepSchedule {
  return {
    id: 'test_sched_1',
    version: CURRENT_SLEEP_SCHEMA_VERSION,
    enabled: true,
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    bedtimeReminder: { enabled: true, leadTimeMinutes: 30 },
    wakeReminder: { enabled: true },
    createdAt: 1763700000000,
    updatedAt: 1763700000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TEST GROUP 1: Schedule Resolution & Occurrence Derivation
// ---------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Schedule Resolution & Local Calendar Semantics ---');
{
  const workdaysSchedule = createTestSchedule({
    id: 'workdays',
    targetBedtime: '22:30',
    targetWakeTime: '06:30',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  });

  const weekendSchedule = createTestSchedule({
    id: 'weekend',
    targetBedtime: '00:30',
    targetWakeTime: '09:00',
    daysOfWeek: [0, 6], // Sun, Sat
  });

  const allSchedules = [workdaysSchedule, weekendSchedule];

  // 1. Resolve for Monday (Day 1)
  const mondayDate = new Date(2026, 10, 23, 10, 0, 0); // Monday Nov 23, 2026
  const monSched = getScheduleForDate(allSchedules, mondayDate);
  assert.strictEqual(monSched?.id, 'workdays');

  // 2. Resolve for Saturday (Day 6)
  const saturdayDate = new Date(2026, 10, 28, 10, 0, 0); // Saturday Nov 28, 2026
  const satSched = getScheduleForDate(allSchedules, saturdayDate);
  assert.strictEqual(satSched?.id, 'weekend');

  // 3. Disabled schedule skipping
  const disabledSchedule = createTestSchedule({
    id: 'disabled',
    enabled: false,
    daysOfWeek: [1],
  });
  assert.strictEqual(getScheduleForDate([disabledSchedule], mondayDate), undefined);

  // 4. Occurrence derivation for standard evening bedtime (22:30) and morning wake (06:30)
  const occ1 = resolveScheduleOccurrences(workdaysSchedule, mondayDate);
  assert.notStrictEqual(occ1, null);
  assert.strictEqual(occ1?.scheduleDateStr, '2026-11-23');
  assert.strictEqual(occ1?.bedtimeDate.getHours(), 22);
  assert.strictEqual(occ1?.bedtimeDate.getMinutes(), 30);
  assert.strictEqual(occ1?.bedtimeDate.getDate(), 23, 'Bedtime is on Nov 23 evening');
  assert.strictEqual(occ1?.wakeDate.getHours(), 6);
  assert.strictEqual(occ1?.wakeDate.getMinutes(), 30);
  assert.strictEqual(occ1?.wakeDate.getDate(), 24, 'Wake is on Nov 24 morning');

  // 5. Occurrence derivation for post-midnight bedtime (00:30)
  const occ2 = resolveScheduleOccurrences(weekendSchedule, saturdayDate);
  assert.notStrictEqual(occ2, null);
  assert.strictEqual(occ2?.scheduleDateStr, '2026-11-28');
  assert.strictEqual(occ2?.bedtimeDate.getHours(), 0);
  assert.strictEqual(occ2?.bedtimeDate.getMinutes(), 30);
  assert.strictEqual(occ2?.bedtimeDate.getDate(), 29, 'Bedtime occurs on Sunday Nov 29 00:30 (post-midnight of Nov 28)');
  assert.strictEqual(occ2?.wakeDate.getHours(), 9);
  assert.strictEqual(occ2?.wakeDate.getDate(), 29, 'Wake occurs on Sunday Nov 29 09:00');

  console.log('✓ Section 1 Passed: Schedule resolution, multi-weekday matching, and midnight occurrence mapping verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 2: Next Bedtime Calculation
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Next Bedtime Calculation ---');
{
  const sched = createTestSchedule({
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  });

  // 1. Afternoon on Monday: Next bedtime is Monday evening 23:00
  const monAfternoon = new Date(2026, 10, 23, 14, 0, 0); // Mon Nov 23 14:00
  const nextBed1 = calculateNextBedtime([sched], monAfternoon);
  assert.notStrictEqual(nextBed1, null);
  assert.strictEqual(nextBed1?.scheduleDate, '2026-11-23');
  assert.strictEqual(new Date(nextBed1!.timestamp).getHours(), 23);
  assert.strictEqual(new Date(nextBed1!.timestamp).getDate(), 23);

  // 2. Late night Monday (23:30): Monday bedtime has passed. Next bedtime is Tuesday evening 23:00!
  const monLate = new Date(2026, 10, 23, 23, 30, 0); // Mon Nov 23 23:30
  const nextBed2 = calculateNextBedtime([sched], monLate);
  assert.notStrictEqual(nextBed2, null);
  assert.strictEqual(nextBed2?.scheduleDate, '2026-11-24', 'Must advance to Tuesday');
  assert.strictEqual(new Date(nextBed2!.timestamp).getDate(), 24);

  // 3. Friday late night (23:30): Friday bedtime has passed. Sat/Sun disabled. Next bedtime is Monday Nov 30!
  const friLate = new Date(2026, 10, 27, 23, 30, 0); // Fri Nov 27 23:30
  const nextBed3 = calculateNextBedtime([sched], friLate);
  assert.notStrictEqual(nextBed3, null);
  assert.strictEqual(nextBed3?.scheduleDate, '2026-11-30', 'Must skip weekend to next Monday');

  // 4. Entire schedule disabled: Returns null
  const disabledSched = createTestSchedule({ enabled: false });
  assert.strictEqual(calculateNextBedtime([disabledSched], monAfternoon), null);

  // 5. Empty schedule list: Returns null
  assert.strictEqual(calculateNextBedtime([], monAfternoon), null);

  console.log('✓ Section 2 Passed: Next bedtime calculations, passed event advancement, and weekend skips verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 3: Next Wake-Up Calculation
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Next Wake-Up Calculation ---');
{
  const sched = createTestSchedule({
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  });

  // 1. Afternoon on Monday: Next wake-up is Tuesday morning 07:00 (associated with Monday anchor night)
  const monAfternoon = new Date(2026, 10, 23, 14, 0, 0);
  const nextWake1 = calculateNextWakeUp([sched], monAfternoon);
  assert.notStrictEqual(nextWake1, null);
  assert.strictEqual(nextWake1?.scheduleDate, '2026-11-23');
  assert.strictEqual(new Date(nextWake1!.timestamp).getHours(), 7);
  assert.strictEqual(new Date(nextWake1!.timestamp).getDate(), 24, 'Wake is Tuesday morning Nov 24');

  // 2. Early Tuesday morning (05:00): User is asleep. Tuesday 07:00 wake-up is in the future (> 05:00).
  // Next wake-up must return Tuesday morning 07:00!
  const tueEarly = new Date(2026, 10, 24, 5, 0, 0); // Tue Nov 24 05:00
  const nextWake2 = calculateNextWakeUp([sched], tueEarly);
  assert.notStrictEqual(nextWake2, null);
  assert.strictEqual(nextWake2?.scheduleDate, '2026-11-23', 'Still belongs to Monday night rest');
  assert.strictEqual(new Date(nextWake2!.timestamp).getDate(), 24);
  assert.strictEqual(new Date(nextWake2!.timestamp).getHours(), 7);

  // 3. Tuesday morning after wake time (08:00): Tuesday 07:00 has passed. Next wake is Wednesday 07:00!
  const tueAfter = new Date(2026, 10, 24, 8, 0, 0); // Tue Nov 24 08:00
  const nextWake3 = calculateNextWakeUp([sched], tueAfter);
  assert.notStrictEqual(nextWake3, null);
  assert.strictEqual(nextWake3?.scheduleDate, '2026-11-24', 'Advances to Tuesday night rest');
  assert.strictEqual(new Date(nextWake3!.timestamp).getDate(), 25, 'Wake is Wednesday morning Nov 25');

  console.log('✓ Section 3 Passed: Next wake-up calculations and pre-dawn morning awareness verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 4: Reminder Occurrence Identifiers & Duplicate Prevention
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Stable Occurrence Identifiers & Duplicate Prevention ---');
{
  const ts1 = 1763937000000;
  const ts2 = 1763967600000;

  // 1. Identifier format: includes scheduledTimestamp to bind to the specific scheduled occurrence
  const id1 = createReminderOccurrenceId('bedtime_prep', 'sched_main', '2026-11-23', ts1);
  const id2 = createReminderOccurrenceId('wake_up', 'sched_main', '2026-11-23', ts2);
  assert.strictEqual(id1, `bedtime_prep:sched_main:2026-11-23:${ts1}`);
  assert.strictEqual(id2, `wake_up:sched_main:2026-11-23:${ts2}`);
  assert.notStrictEqual(id1, id2, 'Bedtime and wake identifiers must be distinct');

  // 2. Deterministic: repeated calls with same params yield identical string
  assert.strictEqual(id1, createReminderOccurrenceId('bedtime_prep', 'sched_main', '2026-11-23', ts1));

  // 3. Different scheduled timestamp yields distinct identifier
  const id3 = createReminderOccurrenceId('bedtime_prep', 'sched_main', '2026-11-23', ts1 + 3600000);
  assert.notStrictEqual(id1, id3, 'Different scheduled times must produce distinct occurrence IDs');

  console.log('✓ Section 4 Passed: Stable occurrence identifiers verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 5: Reminder Eligibility, Lead Time & Expiration Windows
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 5: Reminder Eligibility & Expiration Windows ---');
{
  const sched = createTestSchedule({
    id: 'sched_reminder',
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    bedtimeReminder: { enabled: true, leadTimeMinutes: 30 }, // Reminder at 22:30
    wakeReminder: { enabled: true },
  });

  // Bedtime Nov 23 23:00 -> Scheduled prep reminder is Nov 23 22:30:00
  const scheduledPrepMs = new Date(2026, 10, 23, 22, 30, 0).getTime();
  const handledIds = new Set<string>();

  // 1. Not yet due (22:15, 15 minutes before scheduled reminder)
  const refEarly = new Date(2026, 10, 23, 22, 15, 0).getTime();
  const ev1 = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule: sched,
    scheduleDateStr: '2026-11-23',
    scheduledTimestamp: scheduledPrepMs,
    referenceNow: refEarly,
    handledOccurrenceIds: handledIds,
    leadTimeMinutes: 30,
  });
  assert.strictEqual(ev1.status, 'not_due');
  assert.strictEqual(ev1.isDue, false);

  // 2. Exactly due at scheduled timestamp (22:30:00)
  const refExact = scheduledPrepMs;
  const ev2 = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule: sched,
    scheduleDateStr: '2026-11-23',
    scheduledTimestamp: scheduledPrepMs,
    referenceNow: refExact,
    handledOccurrenceIds: handledIds,
    leadTimeMinutes: 30,
  });
  assert.strictEqual(ev2.status, 'due');
  assert.strictEqual(ev2.isDue, true);

  // 3. Due within tolerance window (22:38, 8 minutes into 15m window)
  const refWithinWindow = scheduledPrepMs + 8 * 60 * 1000;
  const ev3 = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule: sched,
    scheduleDateStr: '2026-11-23',
    scheduledTimestamp: scheduledPrepMs,
    referenceNow: refWithinWindow,
    handledOccurrenceIds: handledIds,
    leadTimeMinutes: 30,
  });
  assert.strictEqual(ev3.status, 'due');
  assert.strictEqual(ev3.isDue, true);

  // 4. Already handled: user acknowledged it earlier
  handledIds.add(ev2.id);
  const evHandled = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule: sched,
    scheduleDateStr: '2026-11-23',
    scheduledTimestamp: scheduledPrepMs,
    referenceNow: refWithinWindow,
    handledOccurrenceIds: handledIds,
    leadTimeMinutes: 30,
  });
  assert.strictEqual(evHandled.status, 'already_handled');
  assert.strictEqual(evHandled.isDue, false);
  assert.strictEqual(evHandled.isHandled, true);

  // 5. Expired: user opens app at 23:00 (30 minutes after scheduled reminder, beyond 15m window)
  const unhandledIds = new Set<string>();
  const refExpired = scheduledPrepMs + 30 * 60 * 1000;
  const evExpired = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule: sched,
    scheduleDateStr: '2026-11-23',
    scheduledTimestamp: scheduledPrepMs,
    referenceNow: refExpired,
    handledOccurrenceIds: unhandledIds,
    leadTimeMinutes: 30,
  });
  assert.strictEqual(evExpired.status, 'expired');
  assert.strictEqual(evExpired.isDue, false, 'Expired reminder must NEVER be due');
  assert.strictEqual(evExpired.isExpired, true);

  // 6. Reminder disabled in settings
  const disabledPrepSched = createTestSchedule({
    bedtimeReminder: { enabled: false, leadTimeMinutes: 30 },
  });
  const evDisabled = evaluateReminderOccurrence({
    reminderType: 'bedtime_prep',
    schedule: disabledPrepSched,
    scheduleDateStr: '2026-11-23',
    scheduledTimestamp: scheduledPrepMs,
    referenceNow: refExact,
    handledOccurrenceIds: unhandledIds,
  });
  assert.strictEqual(evDisabled.status, 'disabled');
  assert.strictEqual(evDisabled.isDue, false);

  console.log('✓ Section 5 Passed: Reminder eligibility, due states, tolerance windows, and disabled behavior verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 6: Backlog Prevention & Missed Reminders After Inactivity
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 6: No Notification Backlog Upon App Reopening ---');
{
  const sched = createTestSchedule({
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    bedtimeReminder: { enabled: true, leadTimeMinutes: 30 },
    wakeReminder: { enabled: true },
  });

  // Scenario: User closes app on Monday at 18:00.
  // Reopens app on Thursday at 14:00 (almost 3 days later).
  // Zero past reminders must be flagged as due!
  const thursdayAfternoon = new Date(2026, 10, 26, 14, 0, 0).getTime();
  const handledIds = new Set<string>();

  const result = reconcileReminders([sched], handledIds, thursdayAfternoon);
  assert.strictEqual(result.dueReminders.length, 0, 'Must NOT produce any backlog of missed reminders');

  // Next bedtime must point forward to Thursday evening 23:00
  assert.strictEqual(result.nextBedtime?.scheduleDate, '2026-11-26');
  // Next wake-up must point forward to Friday morning 07:00
  assert.strictEqual(result.nextWakeUp?.scheduleDate, '2026-11-26');

  console.log('✓ Section 6 Passed: Zero notification backlog verified after extended application inactivity.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 7: Reminder State Storage & Bounded Handled IDs
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 7: Reminder State Storage & Bounded Capacity ---');
{
  mockStorage.clear();

  // 1. Initial state
  const initial = loadReminderState();
  assert.deepStrictEqual(initial.handledOccurrenceIds, []);

  // 2. Mark occurrence handled
  const occId1 = 'bedtime_prep:sched_1:2026-11-23';
  assert.strictEqual(markOccurrenceHandled(occId1), true);
  assert.strictEqual(isOccurrenceHandled(occId1), true);

  // 3. Idempotent marking: re-marking does not duplicate
  assert.strictEqual(markOccurrenceHandled(occId1), true);
  assert.strictEqual(loadReminderState().handledOccurrenceIds.length, 1);

  // 4. Capacity bounding: retain only MAX_HANDLED_REMINDER_IDS (100)
  const overflowState = {
    version: CURRENT_SLEEP_SCHEMA_VERSION,
    handledOccurrenceIds: Array.from({ length: 150 }, (_, i) => `occ_${i}`),
    lastReconciledAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveReminderState(overflowState);

  const loadedState = loadReminderState();
  assert.strictEqual(loadedState.handledOccurrenceIds.length, MAX_HANDLED_REMINDER_IDS, 'Bounded to 100 IDs');
  assert.strictEqual(loadedState.handledOccurrenceIds[0], 'occ_50', 'Retained the newest 100 entries');

  // 5. Prune obsolete reminders when schedules change
  pruneObsoleteReminders(new Set(['valid_sched']));
  // All 'occ_*' IDs don't match format 'type:valid_sched:date' -> pruned
  assert.strictEqual(loadReminderState().handledOccurrenceIds.length, 0);

  // 6. Clear
  markOccurrenceHandled(occId1);
  clearHandledOccurrences();
  assert.strictEqual(loadReminderState().handledOccurrenceIds.length, 0);

  console.log('✓ Section 7 Passed: Reminder persistence, idempotency, bounded retention, and pruning verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 8: Schedule Change & Invalidation of Obsolete Future Reminders
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 8: Dynamic Schedule Updates & Immediate Invalidation ---');
{
  // Initial schedule: bedtime 22:00
  let currentSchedule = createTestSchedule({
    id: 'dynamic_sched',
    targetBedtime: '22:00',
    targetWakeTime: '06:00',
  });

  const refTime = new Date(2026, 10, 23, 14, 0, 0).getTime(); // 14:00
  const initialNext = calculateNextBedtime([currentSchedule], new Date(refTime));
  assert.strictEqual(initialNext?.formattedTime, '22:00');

  // User updates schedule bedtime to 23:30
  currentSchedule = {
    ...currentSchedule,
    targetBedtime: '23:30',
    updatedAt: Date.now(),
  };

  // Immediate recalculation uses new bedtime
  const updatedNext = calculateNextBedtime([currentSchedule], new Date(refTime));
  assert.strictEqual(updatedNext?.formattedTime, '23:30');
  assert.strictEqual(new Date(updatedNext!.timestamp).getMinutes(), 30);

  console.log('✓ Section 8 Passed: Dynamic schedule updates invalidate obsolete calculations immediately.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 9: Rapid Reconciliation & Multi-Check Idempotency
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 9: Rapid Reconciliation & Multi-Check Idempotency ---');
{
  const sched = createTestSchedule({
    id: 'rapid_sched',
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    bedtimeReminder: { enabled: true, leadTimeMinutes: 30 },
  });

  // Time is 22:31:00 (reminder is due!)
  const refNow = new Date(2026, 10, 23, 22, 31, 0).getTime();
  const handledIds = new Set<string>();

  // Check 1: Due
  const r1 = reconcileReminders([sched], handledIds, refNow);
  assert.strictEqual(r1.dueReminders.length, 1);
  const dueId = r1.dueReminders[0].id;

  // Caller marks handled
  handledIds.add(dueId);

  // Check 2 (1 second later, 22:31:01): Must NOT be due again!
  const r2 = reconcileReminders([sched], handledIds, refNow + 1000);
  assert.strictEqual(r2.dueReminders.length, 0);

  // Check 3 (59 seconds later, within same minute): Still NOT due
  const r3 = reconcileReminders([sched], handledIds, refNow + 59000);
  assert.strictEqual(r3.dueReminders.length, 0);

  console.log('✓ Section 9 Passed: Multi-check and within-same-minute idempotency verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 10: Local Date Boundary & Daylight Saving Safety
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 10: Local Date Boundary & Calendar Arithmetic ---');
{
  const sched = createTestSchedule({
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
  });

  // Test across month boundary: Oct 31 to Nov 1
  const oct31_afternoon = new Date(2026, 9, 31, 14, 0, 0); // Oct 31 14:00
  const nextBedOct = calculateNextBedtime([sched], oct31_afternoon);
  assert.strictEqual(nextBedOct?.scheduleDate, '2026-10-31');

  const nextWakeOct = calculateNextWakeUp([sched], oct31_afternoon);
  assert.strictEqual(nextWakeOct?.scheduleDate, '2026-10-31');
  const wakeDate = new Date(nextWakeOct!.timestamp);
  assert.strictEqual(wakeDate.getMonth(), 10, 'Wake-up is in November (month 10)');
  assert.strictEqual(wakeDate.getDate(), 1, 'Wake-up is on Nov 1');

  console.log('✓ Section 10 Passed: Calendar month boundary calculations verified.');
}

// ---------------------------------------------------------------------------
// TEST GROUP 11: Phase S3-Fix Reminder Identity & Schedule-Change Regressions
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 11: Reminder Identity Correction & Schedule-Change Regressions ---');
{
  // Test 1 — Bedtime Changed After Reminder Was Handled
  {
    // Monday Nov 23 schedule: bedtime 22:00, leadTime 30m -> reminder at 21:30
    const schedOrig = createTestSchedule({
      id: 'sched_fix_1',
      targetBedtime: '22:00',
      targetWakeTime: '06:00',
      daysOfWeek: [1], // Monday
      bedtimeReminder: { enabled: true, leadTimeMinutes: 30 },
    });

    const handledIds = new Set<string>();
    const refAt2130 = new Date(2026, 10, 23, 21, 30, 0).getTime();

    // 1. Reconcile at 21:30: Reminder is due
    const r1 = reconcileReminders([schedOrig], handledIds, refAt2130);
    assert.strictEqual(r1.dueReminders.length, 1);
    const origId = r1.dueReminders[0].id;
    assert.strictEqual(origId.startsWith('bedtime_prep:sched_fix_1:2026-11-23:'), true);

    // 2. Original reminder is marked handled
    handledIds.add(origId);

    // 3. User changes bedtime to 23:30 (lead time remains 30m -> new reminder should be at 23:00)
    const schedUpdated = {
      ...schedOrig,
      targetBedtime: '23:30',
      updatedAt: Date.now(),
    };

    // 4. Reconcile at 23:00 (the new reminder time)
    const refAt2300 = new Date(2026, 10, 23, 23, 0, 0).getTime();
    const r2 = reconcileReminders([schedUpdated], handledIds, refAt2300);

    // 5. Must NOT be classified as already_handled; must become eligible and due!
    assert.strictEqual(r2.dueReminders.length, 1, 'Updated reminder must become due at new time');
    const newId = r2.dueReminders[0].id;
    assert.notStrictEqual(newId, origId, 'New reminder must have a distinct occurrence ID');
    assert.strictEqual(r2.dueReminders[0].status, 'due');
    assert.strictEqual(r2.dueReminders[0].isDue, true);
  }

  // Test 2 — Same Occurrence Remains Idempotent
  {
    const sched = createTestSchedule({
      id: 'sched_fix_2',
      targetBedtime: '22:00',
      targetWakeTime: '06:00',
      daysOfWeek: [1],
      bedtimeReminder: { enabled: true, leadTimeMinutes: 30 },
    });

    const handledIds = new Set<string>();
    const refAt2130 = new Date(2026, 10, 23, 21, 30, 0).getTime();

    const r1 = reconcileReminders([sched], handledIds, refAt2130);
    assert.strictEqual(r1.dueReminders.length, 1);
    const id = r1.dueReminders[0].id;

    // Repeated reconciliation with unchanged schedule generates EXACT same ID
    const r2 = reconcileReminders([sched], handledIds, refAt2130);
    assert.strictEqual(r2.dueReminders[0].id, id, 'ID must remain strictly identical across evaluations');

    // Once marked handled, subsequent evaluations return isDue: false
    handledIds.add(id);
    const r3 = reconcileReminders([sched], handledIds, refAt2130 + 1000);
    assert.strictEqual(r3.dueReminders.length, 0);
    const handledEvent = r3.allEvaluatedEvents.find((e) => e.id === id);
    assert.strictEqual(handledEvent?.status, 'already_handled');
  }

  // Test 3 — Lead-Time Modification
  {
    const schedOrig = createTestSchedule({
      id: 'sched_fix_3',
      targetBedtime: '23:00',
      targetWakeTime: '07:00',
      daysOfWeek: [1],
      bedtimeReminder: { enabled: true, leadTimeMinutes: 15 }, // Reminder at 22:45
    });

    const handledIds = new Set<string>();
    const refAt2245 = new Date(2026, 10, 23, 22, 45, 0).getTime();

    const r1 = reconcileReminders([schedOrig], handledIds, refAt2245);
    assert.strictEqual(r1.dueReminders.length, 1);
    handledIds.add(r1.dueReminders[0].id);

    // User updates lead time to 45m (bedtime 23:00 -> new reminder at 22:15)
    // Suppose on a subsequent day (Tuesday Nov 24), lead time 45m produces a distinct ID
    const schedNewLead = {
      ...schedOrig,
      daysOfWeek: [1, 2],
      bedtimeReminder: { enabled: true, leadTimeMinutes: 45 },
    };

    const refTue2215 = new Date(2026, 10, 24, 22, 15, 0).getTime();
    const r2 = reconcileReminders([schedNewLead], handledIds, refTue2215);
    assert.strictEqual(r2.dueReminders.length, 1);
    assert.strictEqual(r2.dueReminders[0].leadTimeMinutes, 45);
    assert.strictEqual(r2.dueReminders[0].status, 'due');
  }

  // Test 4 — Wake-Up Time Modification
  {
    const schedOrig = createTestSchedule({
      id: 'sched_fix_4',
      targetBedtime: '23:00',
      targetWakeTime: '06:00', // Wake-up at 06:00
      daysOfWeek: [1],
    });

    const handledIds = new Set<string>();
    const refAt0600 = new Date(2026, 10, 24, 6, 0, 0).getTime(); // Tuesday morning 06:00

    const r1 = reconcileReminders([schedOrig], handledIds, refAt0600);
    const wakeReminderOrig = r1.dueReminders.find((e) => e.reminderType === 'wake_up');
    assert.notStrictEqual(wakeReminderOrig, undefined);
    const origWakeId = wakeReminderOrig!.id;

    // Mark handled
    handledIds.add(origWakeId);

    // User changes wake-up time from 06:00 to 07:30
    const schedUpdated = {
      ...schedOrig,
      targetWakeTime: '07:30',
    };

    // Reconcile at 07:30
    const refAt0730 = new Date(2026, 10, 24, 7, 30, 0).getTime();
    const r2 = reconcileReminders([schedUpdated], handledIds, refAt0730);
    const wakeReminderUpdated = r2.dueReminders.find((e) => e.reminderType === 'wake_up');
    assert.notStrictEqual(wakeReminderUpdated, undefined);
    assert.notStrictEqual(wakeReminderUpdated?.id, origWakeId, 'New wake time must produce distinct ID');
    assert.strictEqual(wakeReminderUpdated?.status, 'due');
  }

  // Test 5 — Unchanged Schedule
  {
    const sched = createTestSchedule({
      id: 'sched_fix_5',
      targetBedtime: '23:00',
      targetWakeTime: '07:00',
      daysOfWeek: [1],
    });

    const handledIds = new Set<string>();
    const refAt2230 = new Date(2026, 10, 23, 22, 30, 0).getTime();

    const r1 = reconcileReminders([sched], handledIds, refAt2230);
    const id = r1.dueReminders[0].id;
    handledIds.add(id);

    // Calling reconciliation later with unchanged schedule keeps previously handled reminder suppressed
    const r2 = reconcileReminders([sched], handledIds, refAt2230 + 5000);
    assert.strictEqual(r2.dueReminders.length, 0);
    const ev = r2.allEvaluatedEvents.find((e) => e.id === id);
    assert.strictEqual(ev?.status, 'already_handled');
  }

  // Test 6 — Date/Boundary Safety with Post-Midnight Bedtime
  {
    // Post-midnight bedtime: Saturday night schedule with 00:30 bedtime (occurs Sunday morning 00:30)
    const schedMidnight = createTestSchedule({
      id: 'sched_fix_6',
      targetBedtime: '00:30',
      targetWakeTime: '09:00',
      daysOfWeek: [6], // Saturday
      bedtimeReminder: { enabled: true, leadTimeMinutes: 30 }, // Prep reminder at Sunday 00:00 (midnight)
    });

    const handledIds = new Set<string>();
    // Sunday Nov 29 00:00:00 (midnight) is the scheduled reminder time for Saturday Nov 28 night!
    const refMidnight = new Date(2026, 10, 29, 0, 0, 0).getTime();

    const r = reconcileReminders([schedMidnight], handledIds, refMidnight);
    const prepEvent = r.dueReminders.find((e) => e.reminderType === 'bedtime_prep');
    assert.notStrictEqual(prepEvent, undefined);
    assert.strictEqual(prepEvent?.scheduleDate, '2026-11-28', 'Anchor date must remain Saturday Nov 28');
    assert.strictEqual(prepEvent?.scheduledTimestamp, refMidnight, 'Scheduled timestamp is Sunday 00:00:00');
    assert.strictEqual(prepEvent?.id, `bedtime_prep:sched_fix_6:2026-11-28:${refMidnight}`);
    assert.strictEqual(prepEvent?.isDue, true);
  }

  console.log('✓ Section 11 Passed: All 6 reminder identity correction scenarios verified successfully.');
}

console.log('\n========================================================================');
console.log('ALL PHASE S3 SLEEP SCHEDULE & REMINDER TESTS PASSED SUCCESSFULLY!');
console.log('========================================================================\n');
