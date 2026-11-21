import assert from 'node:assert';
import {
  formatTimeDisplay,
  formatElapsedFocusDuration,
  reconcileSessionOnResume,
  createDefaultIdleSession,
} from '../src/utils/focusTimer';
import { ActiveFocusSessionState } from '../src/types/focus';

console.log('--- Starting Phase 2B Core Focus Timer & Reconciliation Tests ---');

// 1. Time display formatting
{
  assert.strictEqual(formatTimeDisplay(0), '00:00');
  assert.strictEqual(formatTimeDisplay(9), '00:09');
  assert.strictEqual(formatTimeDisplay(60), '01:00');
  assert.strictEqual(formatTimeDisplay(65), '01:05');
  assert.strictEqual(formatTimeDisplay(1500), '25:00');
  assert.strictEqual(formatTimeDisplay(3599), '59:59');
  assert.strictEqual(formatTimeDisplay(3600), '1:00:00');
  assert.strictEqual(formatTimeDisplay(3665), '1:01:05');
  assert.strictEqual(formatTimeDisplay(7200), '2:00:00');
  assert.strictEqual(formatTimeDisplay(-10), '00:00', 'Negative seconds clamp to 00:00');
  console.log('✓ formatTimeDisplay handles MM:SS, H:MM:SS, and clamps negatives correctly');
}

// 2. Elapsed focus duration bilingual formatting
{
  // English
  assert.strictEqual(formatElapsedFocusDuration(0, 'en'), '0s');
  assert.strictEqual(formatElapsedFocusDuration(45, 'en'), '45s');
  assert.strictEqual(formatElapsedFocusDuration(60, 'en'), '1 min');
  assert.strictEqual(formatElapsedFocusDuration(1500, 'en'), '25 min');
  assert.strictEqual(formatElapsedFocusDuration(3600, 'en'), '1h');
  assert.strictEqual(formatElapsedFocusDuration(3690, 'en'), '1h 1m');

  // Arabic
  assert.strictEqual(formatElapsedFocusDuration(0, 'ar'), '0 ثانية');
  assert.strictEqual(formatElapsedFocusDuration(45, 'ar'), '45 ثانية');
  assert.strictEqual(formatElapsedFocusDuration(60, 'ar'), '1 دقيقة');
  assert.strictEqual(formatElapsedFocusDuration(1500, 'ar'), '25 دقيقة');
  assert.strictEqual(formatElapsedFocusDuration(3600, 'ar'), '1 ساعة');
  assert.strictEqual(formatElapsedFocusDuration(3690, 'ar'), '1 ساعة و 1 دقيقة');
  console.log('✓ formatElapsedFocusDuration renders accurate concise bilingual output');
}

// 3. Default Idle Session factory
{
  const idle25 = createDefaultIdleSession(25);
  assert.strictEqual(idle25.status, 'idle');
  assert.strictEqual(idle25.plannedDurationSeconds, 1500);
  assert.strictEqual(idle25.accumulatedElapsedSeconds, 0);

  const idleClampedLow = createDefaultIdleSession(-5);
  assert.strictEqual(idleClampedLow.plannedDurationSeconds, 60, 'Should clamp minimum to 1 minute');

  const idleClampedHigh = createDefaultIdleSession(300);
  assert.strictEqual(idleClampedHigh.plannedDurationSeconds, 180 * 60, 'Should clamp maximum to 180 minutes');
  console.log('✓ createDefaultIdleSession creates valid clamped sessions');
}

// 4. Session Reconciliation on Resume / Reload
{
  // A. Paused session: MUST NEVER accumulate elapsed time regardless of elapsed wall clock!
  const now = Date.now();
  const pausedSession: ActiveFocusSessionState = {
    sessionId: 'session-paused-1',
    status: 'paused',
    plannedDurationSeconds: 1500,
    accumulatedElapsedSeconds: 300,
    lastSavedWallTime: now - 3600_000, // 1 hour ago
  };

  const reconciledPaused = reconcileSessionOnResume(pausedSession);
  assert.strictEqual(reconciledPaused.status, 'paused', 'Paused state remains paused');
  assert.strictEqual(
    reconciledPaused.accumulatedElapsedSeconds,
    300,
    'Paused session must freeze elapsed seconds across time'
  );
  console.log('✓ Paused session correctly preserves exact frozen accumulated time during sleep/reload');

  // B. Running session: normal elapsed time
  const runningSession: ActiveFocusSessionState = {
    sessionId: 'session-running-1',
    status: 'running',
    plannedDurationSeconds: 1500,
    accumulatedElapsedSeconds: 200,
    lastSavedWallTime: now - 50_000, // 50 seconds elapsed
  };

  const reconciledRunning = reconcileSessionOnResume(runningSession);
  assert.strictEqual(reconciledRunning.status, 'running');
  assert(
    reconciledRunning.accumulatedElapsedSeconds >= 250 &&
      reconciledRunning.accumulatedElapsedSeconds <= 252,
    `Expected ~250s, got ${reconciledRunning.accumulatedElapsedSeconds}`
  );
  console.log('✓ Running session correctly accumulates elapsed wall-clock seconds on resume');

  // C. Running session overshoot: triggers natural completion
  const overshootingSession: ActiveFocusSessionState = {
    sessionId: 'session-overshoot-1',
    status: 'running',
    plannedDurationSeconds: 1500,
    accumulatedElapsedSeconds: 1400,
    lastSavedWallTime: now - 300_000, // 300 seconds elapsed (1400 + 300 = 1700 > 1500)
    taskId: 'task-123',
    taskTitle: 'Deep Work Task',
  };

  const reconciledCompleted = reconcileSessionOnResume(overshootingSession);
  assert.strictEqual(reconciledCompleted.status, 'completed');
  assert.strictEqual(reconciledCompleted.accumulatedElapsedSeconds, 1500);
  assert(reconciledCompleted.completionResult !== undefined);
  assert.strictEqual(reconciledCompleted.completionResult?.wasCompletedNaturally, true);
  assert.strictEqual(reconciledCompleted.completionResult?.actualElapsedSeconds, 1500);
  assert.strictEqual(reconciledCompleted.completionResult?.taskId, 'task-123');
  assert.strictEqual(reconciledCompleted.completionResult?.taskTitle, 'Deep Work Task');
  console.log('✓ Running session overshoot converts cleanly to completed state with exact result payload');

  // D. System clock anomaly: clock moved backwards (negative wall delta)
  const backwardClockSession: ActiveFocusSessionState = {
    sessionId: 'session-backwards-1',
    status: 'running',
    plannedDurationSeconds: 1500,
    accumulatedElapsedSeconds: 400,
    lastSavedWallTime: now + 60_000, // In the future (clock shifted back)
  };

  const reconciledBackwards = reconcileSessionOnResume(backwardClockSession);
  assert.strictEqual(reconciledBackwards.status, 'running');
  assert.strictEqual(
    reconciledBackwards.accumulatedElapsedSeconds,
    400,
    'Negative delta must be ignored to prevent time travel'
  );
  console.log('✓ Negative wall delta (backward system clock) is safely rejected');

  // E. Already completed / ended_early state preserves exactly
  const completedState: ActiveFocusSessionState = {
    sessionId: 'session-done-1',
    status: 'completed',
    plannedDurationSeconds: 1500,
    accumulatedElapsedSeconds: 1500,
    lastSavedWallTime: now - 100_000,
    completionResult: {
      sessionId: 'session-done-1',
      wasCompletedNaturally: true,
      actualElapsedSeconds: 1500,
      plannedDurationSeconds: 1500,
      completedAt: now - 100_000,
    },
  };

  const reconciledDone = reconcileSessionOnResume(completedState);
  assert.strictEqual(reconciledDone.status, 'completed');
  assert.strictEqual(reconciledDone.accumulatedElapsedSeconds, 1500);
  console.log('✓ Completed session state is completely stable across reloads');
}

// 5. Persistent Latest Completed Session Result (Survives UI Dismissal)
{
  if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, String(val)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    };
  }

  const { saveLatestCompletedResult, loadLatestCompletedResult } = await import('../src/storage/focusStorage');

  const result1 = {
    sessionId: 'session-persist-1',
    wasCompletedNaturally: true,
    actualElapsedSeconds: 1500,
    plannedDurationSeconds: 1500,
    taskId: 'task-100',
    taskTitle: 'Persisted Architecture Task',
    completedAt: Date.now(),
  };

  // Save latest result
  saveLatestCompletedResult(result1);

  // Load latest result
  const loaded = loadLatestCompletedResult();
  assert(loaded !== null, 'Loaded latest completed result must not be null');
  assert.strictEqual(loaded?.sessionId, 'session-persist-1');
  assert.strictEqual(loaded?.actualElapsedSeconds, 1500);
  assert.strictEqual(loaded?.taskTitle, 'Persisted Architecture Task');

  // Verify that an active session reset to idle DOES NOT delete the latest completed result
  const idleWithPreservedResult: ActiveFocusSessionState = {
    ...createDefaultIdleSession(25),
    completionResult: loaded,
  };
  assert(idleWithPreservedResult.completionResult !== undefined);
  assert.strictEqual(idleWithPreservedResult.completionResult?.sessionId, 'session-persist-1');
  assert.strictEqual(loadLatestCompletedResult()?.sessionId, 'session-persist-1');

  // Verify updating with a subsequent session result
  const result2 = {
    sessionId: 'session-persist-2',
    wasCompletedNaturally: false,
    actualElapsedSeconds: 900,
    plannedDurationSeconds: 1500,
    completedAt: Date.now() + 1000,
  };
  saveLatestCompletedResult(result2);
  const loaded2 = loadLatestCompletedResult();
  assert.strictEqual(loaded2?.sessionId, 'session-persist-2');
  assert.strictEqual(loaded2?.wasCompletedNaturally, false);
  console.log('✓ Latest completed session result persistence verified across UI dismissal');
}

console.log('ALL PHASE 2B UNIT TESTS PASSED!');
