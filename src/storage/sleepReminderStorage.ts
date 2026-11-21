/**
 * NeuroCalm & Fokus — Sleep Reminder State Persistence Service
 * Phase S3: Minimal, robust local-first storage for tracking handled reminder occurrences.
 * Prevents duplicate reminder deliveries, backlogs upon reopening, and bounded ID retention.
 */

import { ReminderState } from '../types/sleep';
import {
  SLEEP_REMINDERS_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  MAX_HANDLED_REMINDER_IDS,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';

export const DEFAULT_REMINDER_STATE: ReminderState = {
  version: CURRENT_SLEEP_SCHEMA_VERSION,
  handledOccurrenceIds: [],
  lastReconciledAt: 0,
  updatedAt: 0,
};

/**
 * Validates a ReminderState object defensively at runtime.
 */
export function isValidReminderState(item: unknown): item is ReminderState {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;

  if (s.version !== CURRENT_SLEEP_SCHEMA_VERSION) return false;
  if (!Array.isArray(s.handledOccurrenceIds)) return false;

  for (const id of s.handledOccurrenceIds) {
    if (typeof id !== 'string' || id.trim().length === 0) return false;
  }

  if (typeof s.lastReconciledAt !== 'number' || !Number.isFinite(s.lastReconciledAt)) return false;
  if (typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt)) return false;

  return true;
}

/**
 * Loads the persisted reminder state from localStorage with defensive fallback.
 */
export function loadReminderState(): ReminderState {
  try {
    if (!checkLocalStorageAvailable()) return { ...DEFAULT_REMINDER_STATE };

    const raw = localStorage.getItem(SLEEP_REMINDERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REMINDER_STATE };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_REMINDERS_STORAGE_KEY, raw);
      return { ...DEFAULT_REMINDER_STATE };
    }

    if (!isValidReminderState(parsed)) {
      quarantineCorruptedData(SLEEP_REMINDERS_STORAGE_KEY, raw);
      return { ...DEFAULT_REMINDER_STATE };
    }

    return parsed;
  } catch {
    return { ...DEFAULT_REMINDER_STATE };
  }
}

/**
 * Saves reminder state to localStorage, enforcing bounded capacity on handled IDs.
 */
export function saveReminderState(state: ReminderState): boolean {
  if (!checkLocalStorageAvailable()) return false;
  if (!isValidReminderState(state)) return false;

  try {
    // Retain only the most recent MAX_HANDLED_REMINDER_IDS
    const boundedIds = state.handledOccurrenceIds.slice(-MAX_HANDLED_REMINDER_IDS);
    const payload: ReminderState = {
      ...state,
      handledOccurrenceIds: boundedIds,
      updatedAt: Date.now(),
    };
    localStorage.setItem(SLEEP_REMINDERS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether an occurrence ID has already been handled.
 */
export function isOccurrenceHandled(occurrenceId: string): boolean {
  const state = loadReminderState();
  return state.handledOccurrenceIds.includes(occurrenceId);
}

/**
 * Marks an occurrence ID as handled and persists it idempotently.
 */
export function markOccurrenceHandled(occurrenceId: string): boolean {
  if (!occurrenceId || typeof occurrenceId !== 'string') return false;

  const current = loadReminderState();
  if (current.handledOccurrenceIds.includes(occurrenceId)) {
    return true; // Already handled
  }

  const updatedIds = [...current.handledOccurrenceIds, occurrenceId];
  return saveReminderState({
    ...current,
    handledOccurrenceIds: updatedIds,
  });
}

/**
 * Prunes handled IDs for deleted schedules or obsolete schedules.
 */
export function pruneObsoleteReminders(validScheduleIds: Set<string>): boolean {
  const current = loadReminderState();
  // An occurrence ID format is '{type}:{scheduleId}:{date}:{scheduledTimestamp}'
  const filteredIds = current.handledOccurrenceIds.filter((id) => {
    const parts = id.split(':');
    if (parts.length < 3) return false;
    const scheduleId = parts[1];
    return validScheduleIds.has(scheduleId);
  });

  if (filteredIds.length === current.handledOccurrenceIds.length) {
    return true; // No change needed
  }

  return saveReminderState({
    ...current,
    handledOccurrenceIds: filteredIds,
  });
}

/**
 * Clears all handled occurrence history.
 */
export function clearHandledOccurrences(): void {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_REMINDERS_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
}
