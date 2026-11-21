/**
 * NeuroCalm & Fokus — Sleep Schedule Persistence Service
 * Phase S2: Local-first storage for user-defined bedtime and wake-up schedules.
 * Supports multiple weekday patterns with independent reminder settings.
 */

import { SleepSchedule, DayOfWeek } from '../types/sleep';
import { isValidTimeString } from '../utils/sleepTimeUtils';
import { generateId } from '../utils/id';
import {
  SLEEP_SCHEDULE_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';

/**
 * Validates a single SleepSchedule object defensively at runtime.
 */
export function isValidSleepSchedule(item: unknown): item is SleepSchedule {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;

  if (typeof s.id !== 'string' || s.id.trim().length === 0) return false;
  if (s.version !== CURRENT_SLEEP_SCHEMA_VERSION) return false;
  if (typeof s.enabled !== 'boolean') return false;

  if (!isValidTimeString(s.targetBedtime) || !isValidTimeString(s.targetWakeTime)) {
    return false;
  }

  if (!Array.isArray(s.daysOfWeek)) return false;
  const seenDays = new Set<number>();
  for (const day of s.daysOfWeek) {
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6 || seenDays.has(day)) {
      return false;
    }
    seenDays.add(day);
  }

  // Bedtime reminder validation
  if (!s.bedtimeReminder || typeof s.bedtimeReminder !== 'object') return false;
  const br = s.bedtimeReminder as Record<string, unknown>;
  if (typeof br.enabled !== 'boolean') return false;
  if (
    typeof br.leadTimeMinutes !== 'number' ||
    !Number.isFinite(br.leadTimeMinutes) ||
    br.leadTimeMinutes < 0 ||
    br.leadTimeMinutes > 180
  ) {
    return false;
  }

  // Wake reminder validation
  if (!s.wakeReminder || typeof s.wakeReminder !== 'object') return false;
  const wr = s.wakeReminder as Record<string, unknown>;
  if (typeof wr.enabled !== 'boolean') return false;

  // Timestamps
  if (typeof s.createdAt !== 'number' || !Number.isFinite(s.createdAt) || s.createdAt <= 0) {
    return false;
  }
  if (typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt) || s.updatedAt <= 0) {
    return false;
  }

  return true;
}

/**
 * Creates a clean default sleep schedule (e.g. 23:00 to 07:00, all days).
 */
export function createDefaultSleepSchedule(id: string = generateId()): SleepSchedule {
  const now = Date.now();
  return {
    id,
    version: CURRENT_SLEEP_SCHEMA_VERSION,
    enabled: true,
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    bedtimeReminder: {
      enabled: true,
      leadTimeMinutes: 30,
    },
    wakeReminder: {
      enabled: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Loads all sleep schedules from localStorage.
 * Returns empty array [] if no schedules have been created yet (empty initial state).
 */
export function loadSleepSchedules(): SleepSchedule[] {
  try {
    if (!checkLocalStorageAvailable()) return [];

    const raw = localStorage.getItem(SLEEP_SCHEDULE_STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_SCHEDULE_STORAGE_KEY, raw);
      return [];
    }

    if (!Array.isArray(parsed)) {
      quarantineCorruptedData(SLEEP_SCHEDULE_STORAGE_KEY, raw);
      return [];
    }

    return parsed.filter(isValidSleepSchedule);
  } catch {
    return [];
  }
}

/**
 * Saves all sleep schedules to localStorage.
 * Returns true on success, false on validation or write failure.
 */
export function saveSleepSchedules(schedules: SleepSchedule[]): boolean {
  try {
    if (!checkLocalStorageAvailable()) return false;
    if (!Array.isArray(schedules)) return false;

    // Reject entire payload if any schedule is invalid to prevent saving bad state
    for (const s of schedules) {
      if (!isValidSleepSchedule(s)) return false;
    }

    localStorage.setItem(SLEEP_SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
    return true;
  } catch {
    return false;
  }
}

/**
 * Upserts a single sleep schedule by ID.
 */
export function saveSleepSchedule(schedule: SleepSchedule): boolean {
  if (!isValidSleepSchedule(schedule)) return false;
  const current = loadSleepSchedules();
  const existingIdx = current.findIndex((s) => s.id === schedule.id);

  const updated = [...current];
  if (existingIdx >= 0) {
    updated[existingIdx] = { ...schedule, updatedAt: Date.now() };
  } else {
    updated.push({ ...schedule, updatedAt: Date.now() });
  }

  return saveSleepSchedules(updated);
}

/**
 * Deletes a sleep schedule by ID.
 */
export function deleteSleepSchedule(id: string): boolean {
  const current = loadSleepSchedules();
  const filtered = current.filter((s) => s.id !== id);
  if (filtered.length === current.length) return false;
  return saveSleepSchedules(filtered);
}

/**
 * Clears all persisted sleep schedules.
 */
export function clearSleepSchedules(): void {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_SCHEDULE_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
}

/**
 * Finds the active schedule for a specific day of the week (0 = Sunday, 6 = Saturday).
 * Returns undefined if no schedule is active for that day.
 */
export function findActiveScheduleForDay(
  schedules: SleepSchedule[],
  day: DayOfWeek
): SleepSchedule | undefined {
  return schedules.find((s) => s.enabled && s.daysOfWeek.includes(day));
}
