import { FocusCompletionResult, FocusHistoryRecord } from '../types/focus';

export const HISTORY_STORAGE_KEY = 'neurocalm_focus_history_v1';
export const LATEST_COMPLETED_KEY = 'neurocalm_focus_latest_completed_v1';
export const MAX_HISTORY_ENTRIES = 1000;
export const EMERGENCY_TRIM_ENTRIES = 500;

/**
 * Strict schema validator for focus history entries.
 * Allows actualElapsedSeconds to be 0 (e.g. user ended immediately).
 */
export function isValidHistoryRecord(data: unknown): data is FocusHistoryRecord {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;

  if (typeof r.sessionId !== 'string' || !r.sessionId.trim()) return false;
  if (r.mode !== 'standard' && r.mode !== 'pomodoro') return false;
  if (typeof r.wasCompletedNaturally !== 'boolean') return false;

  if (!Number.isInteger(r.actualElapsedSeconds) || (r.actualElapsedSeconds as number) < 0) return false;
  if (!Number.isInteger(r.plannedDurationSeconds) || (r.plannedDurationSeconds as number) <= 0) return false;
  if (typeof r.completedAt !== 'number' || !Number.isFinite(r.completedAt) || r.completedAt <= 0) return false;

  if (r.taskId !== undefined && typeof r.taskId !== 'string') return false;
  if (r.taskTitle !== undefined && typeof r.taskTitle !== 'string') return false;
  if (
    r.pomodoroIntervalIndex !== undefined &&
    (!Number.isInteger(r.pomodoroIntervalIndex) || (r.pomodoroIntervalIndex as number) < 1)
  ) {
    return false;
  }

  return true;
}

/**
 * Safely load all focus history records from localStorage.
 * Quarantines corrupted records to prevent silent data destruction.
 */
export function loadFocusHistory(): FocusHistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Quarantine corrupted payload
      try {
        const quarantineKey = `neurocalm_focus_history_corrupt_${Date.now()}`;
        localStorage.setItem(quarantineKey, raw);
      } catch {}
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidHistoryRecord);
  } catch {
    return [];
  }
}

/**
 * INTERNAL HELPER: Appends a completed focus session result to history.
 * Non-reentrant: assumes the caller already owns the mutation lock or runs in a safe context.
 * Bounded to 1,000 records; handles QuotaExceededError with graceful emergency trimming.
 */
export function archiveFocusResultInternal(record: FocusHistoryRecord): boolean {
  if (!isValidHistoryRecord(record)) return false;

  try {
    const history = loadFocusHistory();

    // Idempotent rejection: if sessionId already exists, return true immediately
    if (history.some((r) => r.sessionId === record.sessionId)) {
      return true;
    }

    // Prepend new record (most recent first) and cap at MAX_HISTORY_ENTRIES
    let candidate = [record, ...history];
    if (candidate.length > MAX_HISTORY_ENTRIES) {
      candidate = candidate.slice(0, MAX_HISTORY_ENTRIES);
    }

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(candidate));
      return true;
    } catch (err: unknown) {
      // QuotaExceededError handling
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22);

      if (isQuota) {
        try {
          // Emergency trim: retain latest 500 records
          const emergencyCandidate = [record, ...history.slice(0, EMERGENCY_TRIM_ENTRIES - 1)];
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(emergencyCandidate));
          return true;
        } catch {
          // Hard device exhaustion: fail gracefully without throwing
          return false;
        }
      }
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Deterministically recover the latest completed result from history.
 * Tie-breaking: greatest completedAt, then greatest actualElapsedSeconds, then sessionId.
 * Never replaces an existing latest completed buffer with an older one.
 */
export function recoverLatestCompletedFromHistory(): FocusCompletionResult | null {
  try {
    const history = loadFocusHistory();
    if (history.length === 0) return null;

    // Filter valid work or standard completions
    const candidates = [...history].sort((a, b) => {
      if (b.completedAt !== a.completedAt) {
        return b.completedAt - a.completedAt; // 1. Descending completedAt
      }
      if (b.actualElapsedSeconds !== a.actualElapsedSeconds) {
        return b.actualElapsedSeconds - a.actualElapsedSeconds; // 2. Descending actualElapsedSeconds
      }
      return b.sessionId.localeCompare(a.sessionId); // 3. Stable lexicographical comparison
    });

    const top = candidates[0];
    return {
      sessionId: top.sessionId,
      wasCompletedNaturally: top.wasCompletedNaturally,
      actualElapsedSeconds: top.actualElapsedSeconds,
      plannedDurationSeconds: top.plannedDurationSeconds,
      taskId: top.taskId,
      taskTitle: top.taskTitle,
      completedAt: top.completedAt,
      isArchived: true,
    };
  } catch {
    return null;
  }
}
