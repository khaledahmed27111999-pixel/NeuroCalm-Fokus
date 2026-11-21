/**
 * NeuroCalm & Fokus — Active Sleep Session Persistence Service
 * Phase S2: Local-first persistence for in-progress sleep tracking sessions.
 * Preserves active session across page reloads and browser restarts.
 * Enforces the strict invariant that only ONE active manual sleep session can exist at a time.
 */

import { ActiveSleepSession } from '../types/sleep';
import {
  SLEEP_ACTIVE_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';

/**
 * Validates an ActiveSleepSession defensively at runtime.
 */
export function isValidActiveSleepSession(item: unknown): item is ActiveSleepSession {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;

  if (typeof s.id !== 'string' || s.id.trim().length === 0) return false;
  if (s.version !== CURRENT_SLEEP_SCHEMA_VERSION) return false;
  if (s.status !== 'tracking') return false;

  // Sleep date format: 'YYYY-MM-DD'
  if (typeof s.sleepDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.sleepDate)) {
    return false;
  }

  // Timestamps
  if (typeof s.startedAt !== 'number' || !Number.isFinite(s.startedAt) || s.startedAt <= 0) {
    return false;
  }
  if (typeof s.createdAt !== 'number' || !Number.isFinite(s.createdAt) || s.createdAt <= 0) {
    return false;
  }

  // Timezone offset
  if (
    typeof s.timezoneOffsetMinutes !== 'number' ||
    !Number.isFinite(s.timezoneOffsetMinutes) ||
    s.timezoneOffsetMinutes < -840 ||
    s.timezoneOffsetMinutes > 840
  ) {
    return false;
  }

  // Optional notes
  if (s.notes !== undefined && typeof s.notes !== 'string') {
    return false;
  }

  return true;
}

/**
 * Loads the active sleep tracking session from localStorage.
 * Returns null if no session is active or if stored data is corrupted.
 */
export function loadActiveSleepSession(): ActiveSleepSession | null {
  try {
    if (!checkLocalStorageAvailable()) return null;

    const raw = localStorage.getItem(SLEEP_ACTIVE_STORAGE_KEY);
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_ACTIVE_STORAGE_KEY, raw);
      return null;
    }

    if (!isValidActiveSleepSession(parsed)) {
      quarantineCorruptedData(SLEEP_ACTIVE_STORAGE_KEY, raw);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export interface StartSessionResult {
  success: boolean;
  activeSession: ActiveSleepSession;
  isDuplicate: boolean;
  error?: string;
}

/**
 * Starts an active sleep session.
 * Invariant enforcement:
 * - If an active session already exists, rejects the new start request and returns the existing session.
 * - Prevents creating duplicate active sessions.
 */
export function startActiveSleepSession(session: ActiveSleepSession): StartSessionResult {
  if (!isValidActiveSleepSession(session)) {
    return {
      success: false,
      activeSession: session,
      isDuplicate: false,
      error: 'Invalid session payload',
    };
  }

  const existing = loadActiveSleepSession();
  if (existing) {
    // An active session already exists! Prevent duplicate overwrite.
    return {
      success: false,
      activeSession: existing,
      isDuplicate: true,
      error: 'An active sleep session is already in progress',
    };
  }

  try {
    if (!checkLocalStorageAvailable()) {
      return {
        success: false,
        activeSession: session,
        isDuplicate: false,
        error: 'Storage unavailable',
      };
    }

    localStorage.setItem(SLEEP_ACTIVE_STORAGE_KEY, JSON.stringify(session));
    return {
      success: true,
      activeSession: session,
      isDuplicate: false,
    };
  } catch {
    return {
      success: false,
      activeSession: session,
      isDuplicate: false,
      error: 'Write failure',
    };
  }
}

/**
 * Updates properties on the active sleep session (e.g. notes).
 */
export function updateActiveSleepSession(updates: { notes?: string }): boolean {
  const current = loadActiveSleepSession();
  if (!current) return false;

  const updated: ActiveSleepSession = {
    ...current,
    notes: updates.notes !== undefined ? updates.notes.slice(0, 280) : current.notes,
  };

  if (!isValidActiveSleepSession(updated)) return false;

  try {
    localStorage.setItem(SLEEP_ACTIVE_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears the active sleep session upon wake-up or explicit cancellation.
 */
export function clearActiveSleepSession(): void {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_ACTIVE_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
}
