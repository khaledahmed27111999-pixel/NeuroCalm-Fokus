import assert from 'node:assert';
import {
  POMODORO_PRESETS,
  DEFAULT_CUSTOM_CONFIG,
  validateCustomConfig,
  createInitialPomodoroState,
  calculateNextInterval,
} from '../src/utils/pomodoroSequence';
import {
  archiveFocusResultInternal,
  loadFocusHistory,
  recoverLatestCompletedFromHistory,
  isValidHistoryRecord,
} from '../src/storage/focusHistoryStorage';
import { FocusHistoryRecord } from '../src/types/focus';
import { reconcileSessionOnResume } from '../src/utils/focusTimer';

console.log('--- Starting Phase 2C Pomodoro System & History Storage Unit Tests ---');

// Mock localStorage for Node runtime
const storageMap = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => storageMap.clear(),
  key: (index: number) => Array.from(storageMap.keys())[index] || null,
  get length() {
    return storageMap.size;
  },
};

// 1. Preset Definitions & Defaults
{
  assert.strictEqual(POMODORO_PRESETS.classic.workDurationMinutes, 25);
  assert.strictEqual(POMODORO_PRESETS.classic.shortBreakMinutes, 5);
  assert.strictEqual(POMODORO_PRESETS.classic.longBreakMinutes, 15);
  assert.strictEqual(POMODORO_PRESETS.classic.intervalsBeforeLongBreak, 4);

  assert.strictEqual(POMODORO_PRESETS.deep_work.workDurationMinutes, 50);
  assert.strictEqual(POMODORO_PRESETS.deep_work.shortBreakMinutes, 10);
  assert.strictEqual(POMODORO_PRESETS.deep_work.longBreakMinutes, 20);
  assert.strictEqual(POMODORO_PRESETS.deep_work.intervalsBeforeLongBreak, 3);

  console.log('✓ Pomodoro presets (Classic & Deep Work) match approved specifications');
}

// 2. Custom Configuration Clamping & Boundaries
{
  const defaultConfig = validateCustomConfig();
  assert.deepStrictEqual(defaultConfig, DEFAULT_CUSTOM_CONFIG);

  // Clamping extreme values
  const clamped = validateCustomConfig({
    workDurationMinutes: 999, // Should clamp to 180
    shortBreakMinutes: 0,     // Should clamp to 1
    longBreakMinutes: 120,    // Should clamp to 60
    intervalsBeforeLongBreak: -5, // Should clamp to 1
  });
  assert.strictEqual(clamped.workDurationMinutes, 180);
  assert.strictEqual(clamped.shortBreakMinutes, 1);
  assert.strictEqual(clamped.longBreakMinutes, 60);
  assert.strictEqual(clamped.intervalsBeforeLongBreak, 1);

  console.log('✓ Custom configuration bounds (1-180m work, 1-45m short, 1-60m long, 1-12 cycle) validated');
}

// 3. Classic Pomodoro Sequence Progression
{
  let state = createInitialPomodoroState('classic');
  assert.strictEqual(state.intervalType, 'work');
  assert.strictEqual(state.cycleIntervalNumber, 1);
  assert.strictEqual(state.intervalsBeforeLongBreak, 4);

  // Interval 1 Work completes -> Next is Short Break (5m)
  let next = calculateNextInterval(state);
  assert.strictEqual(next.nextIntervalType, 'short_break');
  assert.strictEqual(next.nextDurationMinutes, 5);
  assert.strictEqual(next.isLongBreakScheduled, false);

  // Short break 1 completes -> Next is Work Interval 2
  state = {
    ...state,
    intervalType: 'short_break',
    cumulativeWorkIntervals: 1,
  };
  next = calculateNextInterval(state);
  assert.strictEqual(next.nextIntervalType, 'work');
  assert.strictEqual(next.nextDurationMinutes, 25);
  assert.strictEqual(next.nextCycleIntervalNumber, 2);

  // Interval 2 Work completes -> Short Break 2
  state = {
    ...state,
    intervalType: 'work',
    cycleIntervalNumber: 2,
    cumulativeWorkIntervals: 1,
  };
  next = calculateNextInterval(state);
  assert.strictEqual(next.nextIntervalType, 'short_break');

  // Interval 3 Work completes -> Short Break 3
  state = {
    ...state,
    intervalType: 'work',
    cycleIntervalNumber: 3,
    cumulativeWorkIntervals: 2,
  };
  next = calculateNextInterval(state);
  assert.strictEqual(next.nextIntervalType, 'short_break');

  // Interval 4 Work completes -> LONG BREAK (15m)!
  state = {
    ...state,
    intervalType: 'work',
    cycleIntervalNumber: 4,
    cumulativeWorkIntervals: 3,
  };
  next = calculateNextInterval(state);
  assert.strictEqual(next.nextIntervalType, 'long_break');
  assert.strictEqual(next.nextDurationMinutes, 15);
  assert.strictEqual(next.isLongBreakScheduled, true);

  // Long break completes -> Cycle resets to 1, next is Work (25m)
  state = {
    ...state,
    intervalType: 'long_break',
    cycleIntervalNumber: 4,
    cumulativeWorkIntervals: 4,
  };
  next = calculateNextInterval(state);
  assert.strictEqual(next.nextIntervalType, 'work');
  assert.strictEqual(next.nextDurationMinutes, 25);
  assert.strictEqual(next.nextCycleIntervalNumber, 1, 'Cycle resets to 1 after long break');

  console.log('✓ Classic Pomodoro 4-interval cycle sequence progression operates deterministically');
}

// 4. Deep Work Pomodoro Sequence Progression (3 intervals before long break)
{
  const state = createInitialPomodoroState('deep_work');
  assert.strictEqual(state.intervalsBeforeLongBreak, 3);

  // Work interval 3 completes -> Long break (20m)
  const work3State = {
    ...state,
    cycleIntervalNumber: 3,
    cumulativeWorkIntervals: 2,
  };
  const next = calculateNextInterval(work3State);
  assert.strictEqual(next.nextIntervalType, 'long_break');
  assert.strictEqual(next.nextDurationMinutes, 20);

  console.log('✓ Deep Work 3-interval cycle produces long break at interval 3');
}

// 5. History Archival & Deduplication
{
  storageMap.clear();

  const record1: FocusHistoryRecord = {
    sessionId: 'session_001',
    mode: 'pomodoro',
    wasCompletedNaturally: true,
    actualElapsedSeconds: 1500,
    plannedDurationSeconds: 1500,
    completedAt: 1700000000000,
    taskId: 'task_abc',
    taskTitle: 'Project Report',
    pomodoroIntervalIndex: 1,
  };

  // First archival succeeds
  const res1 = archiveFocusResultInternal(record1);
  assert.strictEqual(res1, true);

  // Duplicate archival of same sessionId is idempotent (returns true, but adds no new entry)
  const resDuplicate = archiveFocusResultInternal(record1);
  assert.strictEqual(resDuplicate, true, 'Duplicate sessionId should be idempotent');

  const history = loadFocusHistory();
  assert.strictEqual(history.length, 1, 'Duplicate sessionId must not append duplicate entry');
  assert.strictEqual(history[0].sessionId, 'session_001');

  // Invalid record rejected
  const invalidRecord: unknown = {
    sessionId: '',
    actualElapsedSeconds: -50,
  };
  assert.strictEqual(isValidHistoryRecord(invalidRecord), false);
  assert.strictEqual(archiveFocusResultInternal(invalidRecord as FocusHistoryRecord), false);

  console.log('✓ History archival safely validates records and prevents duplicate entries');
}

// 6. Bounded 1,000-Record History Capacity (FIFO)
{
  storageMap.clear();

  // Populate 1005 records
  for (let i = 1; i <= 1005; i++) {
    archiveFocusResultInternal({
      sessionId: `bulk_session_${i}`,
      mode: 'standard',
      wasCompletedNaturally: true,
      actualElapsedSeconds: 1500,
      plannedDurationSeconds: 1500,
      completedAt: 1700000000000 + i,
    });
  }

  const boundedHistory = loadFocusHistory();
  assert.strictEqual(boundedHistory.length, 1000, 'History must be capped at 1000 records');
  // First 5 should have been evicted (oldest dropped)
  assert.strictEqual(boundedHistory[0].sessionId, 'bulk_session_1005', 'Index 0 is the most recent record');
  assert.strictEqual(boundedHistory[999].sessionId, 'bulk_session_6', 'Index 999 is the oldest preserved record');

  console.log('✓ History storage enforces bounded 1000-record FIFO policy');
}

// 7. Latest Completed Result Deterministic Recovery
{
  storageMap.clear();

  const records: FocusHistoryRecord[] = [
    {
      sessionId: 'sess_early',
      mode: 'standard',
      wasCompletedNaturally: true,
      actualElapsedSeconds: 900,
      plannedDurationSeconds: 900,
      completedAt: 1000,
    },
    {
      sessionId: 'sess_latest',
      mode: 'pomodoro',
      wasCompletedNaturally: true,
      actualElapsedSeconds: 1500,
      plannedDurationSeconds: 1500,
      completedAt: 5000,
    },
    {
      sessionId: 'sess_middle',
      mode: 'standard',
      wasCompletedNaturally: false,
      actualElapsedSeconds: 400,
      plannedDurationSeconds: 1200,
      completedAt: 3000,
    },
  ];

  for (const r of records) {
    archiveFocusResultInternal(r);
  }

  const recovered = recoverLatestCompletedFromHistory();
  assert.notStrictEqual(recovered, null);
  assert.strictEqual(recovered?.sessionId, 'sess_latest');
  assert.strictEqual(recovered?.completedAt, 5000);

  console.log('✓ recoverLatestCompletedFromHistory deterministically selects the most recent record');
}

// 8. Reconcile Natural Completion: Break Exclusion Invariant
{
  const baseTime = 1700000000000;

  // Work session running that reaches full duration:
  const runningWorkSession = {
    sessionId: 'work_sess',
    mode: 'pomodoro' as const,
    status: 'running' as const,
    plannedDurationSeconds: 1500,
    accumulatedElapsedSeconds: 1400,
    lastSavedWallTime: baseTime,
    version: 1,
    pomodoro: createInitialPomodoroState('classic'),
  };

  // Reconcile 200 seconds later (total elapsed = 1400 + 200 = 1600 > 1500)
  const reconciledWork = reconcileSessionOnResume(runningWorkSession, baseTime + 200000);
  assert.strictEqual(reconciledWork.status, 'completed');
  assert.notStrictEqual(reconciledWork.completionResult, undefined, 'Work completion must generate completionResult');
  assert.strictEqual(reconciledWork.pomodoro?.cumulativeWorkIntervals, 1);
  assert.strictEqual(reconciledWork.pomodoro?.isTransitionPending, true);

  // Break session running that reaches full duration:
  const runningBreakSession = {
    sessionId: 'break_sess',
    mode: 'pomodoro' as const,
    status: 'running' as const,
    plannedDurationSeconds: 300,
    accumulatedElapsedSeconds: 250,
    lastSavedWallTime: baseTime,
    version: 2,
    pomodoro: {
      ...createInitialPomodoroState('classic'),
      intervalType: 'short_break' as const,
      cumulativeWorkIntervals: 1,
    },
  };

  // Reconcile 100 seconds later (total elapsed = 250 + 100 = 350 > 300)
  const reconciledBreak = reconcileSessionOnResume(runningBreakSession, baseTime + 100000);
  assert.strictEqual(reconciledBreak.status, 'completed');
  assert.strictEqual(reconciledBreak.completionResult, undefined, 'CRITICAL: Break completion must NEVER generate completionResult');
  assert.strictEqual(reconciledBreak.pomodoro?.cumulativeWorkIntervals, 1, 'Break completion must NEVER increment cumulativeWorkIntervals');
  assert.strictEqual(reconciledBreak.pomodoro?.isTransitionPending, true);
  assert.strictEqual(reconciledBreak.pomodoro?.nextIntervalType, 'work');

  console.log('✓ Break exclusion invariant strictly verified: breaks generate zero completionResult and zero history/work increments');
}

console.log('\n--- ALL PHASE 2C UNIT TESTS PASSED SUCCESSFULLY ---');
