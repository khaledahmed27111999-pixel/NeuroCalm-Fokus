/**
 * NeuroCalm & Fokus — Sleep Preparation Daily Progress Persistence Service
 * Phase S5: Local-first persistence for tonight's wind-down routine checklist states.
 * Tracks completed and skipped items bound to the active evening's anchor date.
 * Automatically starts fresh when a new calendar evening arrives.
 */

import {
  SLEEP_PREP_PROGRESS_STORAGE_KEY,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';

export type PrepItemStatus = 'pending' | 'completed' | 'skipped';

export interface SleepPrepDailyProgress {
  anchorDate: string; // 'YYYY-MM-DD'
  itemStatuses: Record<string, PrepItemStatus>;
  updatedAt: number;
}

const VALID_STATUSES = new Set<string>(['pending', 'completed', 'skipped']);

/**
 * Validates a SleepPrepDailyProgress object defensively.
 */
export function isValidPrepDailyProgress(item: unknown): item is SleepPrepDailyProgress {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;

  if (typeof p.anchorDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.anchorDate)) {
    return false;
  }
  if (!p.itemStatuses || typeof p.itemStatuses !== 'object') {
    return false;
  }

  const statuses = p.itemStatuses as Record<string, unknown>;
  for (const [key, val] of Object.entries(statuses)) {
    if (typeof key !== 'string' || typeof val !== 'string' || !VALID_STATUSES.has(val)) {
      return false;
    }
  }

  if (typeof p.updatedAt !== 'number' || !Number.isFinite(p.updatedAt)) {
    return false;
  }

  return true;
}

/**
 * Loads today's checklist item statuses.
 * If the stored progress belongs to a previous anchor night, returns empty {}
 * so the new evening starts with a clean slate without destroying configuration.
 */
export function loadSleepPrepDailyProgress(currentAnchorDate: string): Record<string, PrepItemStatus> {
  try {
    if (!checkLocalStorageAvailable()) return {};

    const raw = localStorage.getItem(SLEEP_PREP_PROGRESS_STORAGE_KEY);
    if (!raw) return {};

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_PREP_PROGRESS_STORAGE_KEY, raw);
      return {};
    }

    if (!isValidPrepDailyProgress(parsed)) {
      quarantineCorruptedData(SLEEP_PREP_PROGRESS_STORAGE_KEY, raw);
      return {};
    }

    // Anchor Date check: if progress was saved for a previous night, start fresh
    if (parsed.anchorDate !== currentAnchorDate) {
      return {};
    }

    return parsed.itemStatuses;
  } catch {
    return {};
  }
}

/**
 * Saves tonight's checklist item statuses.
 */
export function saveSleepPrepDailyProgress(
  anchorDate: string,
  itemStatuses: Record<string, PrepItemStatus>
): boolean {
  if (!checkLocalStorageAvailable()) return false;

  const payload: SleepPrepDailyProgress = {
    anchorDate,
    itemStatuses,
    updatedAt: Date.now(),
  };

  if (!isValidPrepDailyProgress(payload)) return false;

  try {
    localStorage.setItem(SLEEP_PREP_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears tonight's checklist progress.
 */
export function clearSleepPrepDailyProgress(): void {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_PREP_PROGRESS_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
}
