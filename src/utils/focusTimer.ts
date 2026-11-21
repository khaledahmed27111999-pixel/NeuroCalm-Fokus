import { ActiveFocusSessionState, FocusMode } from '../types/focus';
import { calculateNextInterval } from './pomodoroSequence';
import { generateId } from './id';

/**
 * Format raw seconds into a calm, standard digital timer string (MM:SS or H:MM:SS).
 */
export function formatTimeDisplay(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format elapsed focus duration into a peaceful human-readable string.
 */
export function formatElapsedFocusDuration(totalSeconds: number, locale: 'en' | 'ar'): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;

  if (minutes === 0) {
    return locale === 'ar' ? `${seconds} ثانية` : `${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours === 0) {
    return locale === 'ar' ? `${remainingMins} دقيقة` : `${remainingMins} min`;
  }

  if (remainingMins === 0) {
    return locale === 'ar' ? `${hours} ساعة` : `${hours}h`;
  }

  return locale === 'ar'
    ? `${hours} ساعة و ${remainingMins} دقيقة`
    : `${hours}h ${remainingMins}m`;
}

/**
 * Factory for a clean, initial idle session.
 */
export function createDefaultIdleSession(
  durationMinutes: number = 25,
  mode: FocusMode = 'standard'
): ActiveFocusSessionState {
  const safeMinutes = Math.min(180, Math.max(1, Math.round(durationMinutes)));
  return {
    sessionId: generateId(),
    mode,
    status: 'idle',
    plannedDurationSeconds: safeMinutes * 60,
    accumulatedElapsedSeconds: 0,
    lastSavedWallTime: Date.now(),
    version: 1,
  };
}

/**
 * Reconcile a session's state on reload, visibility change, or window focus.
 * Paused sessions NEVER accumulate elapsed time.
 * Running sessions safely advance by wall-clock delta with backwards-clock protection.
 * Distinguishes Work interval completions (generating completionResult) from Break interval completions (never creating focus completion).
 */
export function reconcileSessionOnResume(
  session: ActiveFocusSessionState,
  currentWallTime: number = Date.now()
): ActiveFocusSessionState {
  // Paused, idle, completed, or ended_early sessions never accumulate time while away
  if (session.status !== 'running') {
    return session;
  }

  const wallDeltaMs = currentWallTime - session.lastSavedWallTime;

  // Clock was shifted backwards while tab was closed/asleep:
  // Discard negative delta, preserve accumulated elapsed seconds, and re-anchor.
  if (wallDeltaMs < 0) {
    return {
      ...session,
      lastSavedWallTime: currentWallTime,
    };
  }

  // Safe boundary check against extreme multi-day clock leaps
  const maxElapsedLimit = session.plannedDurationSeconds;
  const elapsedDeltaSeconds = Math.min(
    Math.floor(wallDeltaMs / 1000),
    maxElapsedLimit
  );

  const totalElapsed = session.accumulatedElapsedSeconds + elapsedDeltaSeconds;

  // Check if session naturally completed while tab was suspended or closed
  if (totalElapsed >= session.plannedDurationSeconds) {
    const isWork =
      session.mode === 'standard' ||
      !session.pomodoro ||
      session.pomodoro.intervalType === 'work';

    if (isWork) {
      const naturalCompletedAt =
        session.lastSavedWallTime +
        (session.plannedDurationSeconds - session.accumulatedElapsedSeconds) * 1000;

      let updatedPomodoro = session.pomodoro;
      if (updatedPomodoro) {
        const next = calculateNextInterval(updatedPomodoro);
        updatedPomodoro = {
          ...updatedPomodoro,
          sequenceStatus: 'transition_pending',
          isTransitionPending: true,
          cumulativeWorkIntervals: updatedPomodoro.cumulativeWorkIntervals + 1,
          nextIntervalType: next.nextIntervalType,
          nextPlannedDurationSeconds: next.nextDurationMinutes * 60,
        };
      }

      return {
        ...session,
        status: 'completed',
        accumulatedElapsedSeconds: session.plannedDurationSeconds,
        lastSavedWallTime: currentWallTime,
        pomodoro: updatedPomodoro,
        completionResult: {
          sessionId: session.sessionId,
          wasCompletedNaturally: true,
          actualElapsedSeconds: session.plannedDurationSeconds,
          plannedDurationSeconds: session.plannedDurationSeconds,
          taskId: session.taskId,
          taskTitle: session.taskTitle,
          completedAt: naturalCompletedAt,
          isArchived: false,
        },
      };
    }

    // Break interval naturally completed while tab was away
    // Breaks NEVER create FocusCompletionResult, NEVER touch focus history!
    let updatedPomodoro = session.pomodoro!;
    const next = calculateNextInterval(updatedPomodoro);
    updatedPomodoro = {
      ...updatedPomodoro,
      sequenceStatus: 'transition_pending',
      isTransitionPending: true,
      cycleIntervalNumber: next.nextCycleIntervalNumber,
      nextIntervalType: 'work',
      nextPlannedDurationSeconds: next.nextDurationMinutes * 60,
    };

    return {
      ...session,
      status: 'completed',
      accumulatedElapsedSeconds: session.plannedDurationSeconds,
      lastSavedWallTime: currentWallTime,
      pomodoro: updatedPomodoro,
      completionResult: undefined, // Breaks have NO FocusCompletionResult
    };
  }

  // Otherwise, advance accumulated time normally
  return {
    ...session,
    accumulatedElapsedSeconds: totalElapsed,
    lastSavedWallTime: currentWallTime,
  };
}
