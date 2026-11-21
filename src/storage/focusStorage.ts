import {
  ActiveFocusSessionState,
  FocusCompletionResult,
  FocusHistoryRecord,
  FocusMode,
  FocusSessionStatus,
} from '../types/focus';
import { PomodoroIntervalType, PomodoroSequenceState, PomodoroSequenceStatus } from '../types/pomodoro';
import { requestFocusMutationLock } from '../utils/focusConcurrency';
import {
  archiveFocusResultInternal,
  LATEST_COMPLETED_KEY,
} from './focusHistoryStorage';

export { LATEST_COMPLETED_KEY };

const STORAGE_KEY = 'neurocalm_focus_active_v1';

const VALID_STATUSES: Set<FocusSessionStatus> = new Set([
  'idle',
  'running',
  'paused',
  'completed',
  'ended_early',
]);

const VALID_INTERVAL_TYPES: Set<PomodoroIntervalType> = new Set([
  'work',
  'short_break',
  'long_break',
]);

const VALID_SEQUENCE_STATUSES: Set<PomodoroSequenceStatus> = new Set([
  'active',
  'transition_pending',
  'stopped',
]);

function validatePomodoroState(data: unknown): PomodoroSequenceState | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const p = data as Record<string, unknown>;

  if (p.patternId !== 'classic' && p.patternId !== 'deep_work' && p.patternId !== 'custom') {
    return undefined;
  }
  if (!VALID_SEQUENCE_STATUSES.has(p.sequenceStatus as PomodoroSequenceStatus)) {
    return undefined;
  }
  if (!VALID_INTERVAL_TYPES.has(p.intervalType as PomodoroIntervalType)) {
    return undefined;
  }
  if (!Number.isInteger(p.cycleIntervalNumber) || (p.cycleIntervalNumber as number) < 1) {
    return undefined;
  }
  if (!Number.isInteger(p.cumulativeWorkIntervals) || (p.cumulativeWorkIntervals as number) < 0) {
    return undefined;
  }
  if (!Number.isInteger(p.intervalsBeforeLongBreak) || (p.intervalsBeforeLongBreak as number) < 1) {
    return undefined;
  }
  if (typeof p.autoStartBreaks !== 'boolean' || typeof p.autoStartWork !== 'boolean') {
    return undefined;
  }
  if (typeof p.isTransitionPending !== 'boolean') {
    return undefined;
  }

  return {
    patternId: p.patternId as PomodoroSequenceState['patternId'],
    sequenceStatus: p.sequenceStatus as PomodoroSequenceStatus,
    intervalType: p.intervalType as PomodoroIntervalType,
    cycleIntervalNumber: p.cycleIntervalNumber as number,
    cumulativeWorkIntervals: p.cumulativeWorkIntervals as number,
    intervalsBeforeLongBreak: p.intervalsBeforeLongBreak as number,
    customConfig: p.customConfig as PomodoroSequenceState['customConfig'],
    autoStartBreaks: p.autoStartBreaks as boolean,
    autoStartWork: p.autoStartWork as boolean,
    isTransitionPending: p.isTransitionPending as boolean,
    nextIntervalType: p.nextIntervalType as PomodoroIntervalType | undefined,
    nextPlannedDurationSeconds:
      typeof p.nextPlannedDurationSeconds === 'number' ? p.nextPlannedDurationSeconds : undefined,
  };
}

/**
 * Validate and safely load the active focus session state from localStorage.
 */
export function loadActiveFocusSession(): ActiveFocusSessionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if (typeof parsed.sessionId !== 'string' || !parsed.sessionId.trim()) {
      return null;
    }

    if (!VALID_STATUSES.has(parsed.status)) {
      return null;
    }

    if (
      typeof parsed.plannedDurationSeconds !== 'number' ||
      parsed.plannedDurationSeconds <= 0
    ) {
      return null;
    }

    if (
      typeof parsed.accumulatedElapsedSeconds !== 'number' ||
      parsed.accumulatedElapsedSeconds < 0
    ) {
      return null;
    }

    if (typeof parsed.lastSavedWallTime !== 'number' || parsed.lastSavedWallTime <= 0) {
      return null;
    }

    const mode: FocusMode = parsed.mode === 'pomodoro' ? 'pomodoro' : 'standard';
    const version: number = typeof parsed.version === 'number' && parsed.version > 0 ? parsed.version : 1;

    // Validate optional completionResult if present
    let completionResult: FocusCompletionResult | undefined = undefined;
    if (parsed.completionResult) {
      const cr = parsed.completionResult;
      if (
        typeof cr.sessionId === 'string' &&
        typeof cr.wasCompletedNaturally === 'boolean' &&
        typeof cr.actualElapsedSeconds === 'number' &&
        cr.actualElapsedSeconds >= 0 &&
        typeof cr.plannedDurationSeconds === 'number' &&
        cr.plannedDurationSeconds > 0 &&
        typeof cr.completedAt === 'number'
      ) {
        completionResult = {
          sessionId: cr.sessionId,
          wasCompletedNaturally: cr.wasCompletedNaturally,
          actualElapsedSeconds: cr.actualElapsedSeconds,
          plannedDurationSeconds: cr.plannedDurationSeconds,
          taskId: typeof cr.taskId === 'string' ? cr.taskId : undefined,
          taskTitle: typeof cr.taskTitle === 'string' ? cr.taskTitle : undefined,
          completedAt: cr.completedAt,
          isArchived: typeof cr.isArchived === 'boolean' ? cr.isArchived : false,
        };
      }
    }

    const pomodoro = validatePomodoroState(parsed.pomodoro);

    return {
      sessionId: parsed.sessionId,
      mode,
      status: parsed.status,
      plannedDurationSeconds: parsed.plannedDurationSeconds,
      accumulatedElapsedSeconds: parsed.accumulatedElapsedSeconds,
      lastSavedWallTime: parsed.lastSavedWallTime,
      version,
      taskId: typeof parsed.taskId === 'string' ? parsed.taskId : undefined,
      taskTitle: typeof parsed.taskTitle === 'string' ? parsed.taskTitle : undefined,
      pomodoro,
      completionResult,
    };
  } catch {
    // Return null cleanly on corrupted JSON or security restrictions
    return null;
  }
}

/**
 * Safely persist the active focus session state to localStorage.
 */
export function saveActiveFocusSession(state: ActiveFocusSessionState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Fail silently on quota or storage access error
  }
}

/**
 * Clear the active focus session from localStorage.
 */
export function clearActiveFocusSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

/**
 * Safely persist the latest completed focus session result to localStorage.
 * Survives active session resets so it remains available for single-session UI consumers.
 */
export function saveLatestCompletedResult(result: FocusCompletionResult): void {
  try {
    const serialized = JSON.stringify(result);
    localStorage.setItem(LATEST_COMPLETED_KEY, serialized);
  } catch {
    // Fail silently
  }
}

/**
 * Safely load the latest completed focus session result from localStorage.
 */
export function loadLatestCompletedResult(): FocusCompletionResult | null {
  try {
    const raw = localStorage.getItem(LATEST_COMPLETED_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if (
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.wasCompletedNaturally !== 'boolean' ||
      typeof parsed.actualElapsedSeconds !== 'number' ||
      parsed.actualElapsedSeconds < 0 ||
      typeof parsed.plannedDurationSeconds !== 'number' ||
      typeof parsed.completedAt !== 'number'
    ) {
      return null;
    }

    return parsed as FocusCompletionResult;
  } catch {
    return null;
  }
}

/**
 * Public archival function acquiring the exclusive mutation lock.
 */
export async function archiveFocusResultPublic(record: FocusHistoryRecord): Promise<boolean> {
  return requestFocusMutationLock(async () => {
    return archiveFocusResultInternal(record);
  });
}
