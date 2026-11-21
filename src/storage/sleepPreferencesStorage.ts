/**
 * NeuroCalm & Fokus — Sleep General Preferences Persistence Service
 * Phase S2: Local-first persistence for user-configurable anchor-night boundary,
 * morning reflection toggle, wind-down lead duration, and notification preferences.
 */

import { SleepPreferences } from '../types/sleep';
import {
  DEFAULT_ANCHOR_BOUNDARY_TIME,
  isValidAnchorBoundary,
} from '../utils/sleepTimeUtils';
import {
  SLEEP_PREFERENCES_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';

export const DEFAULT_SLEEP_PREFERENCES: SleepPreferences = {
  version: CURRENT_SLEEP_SCHEMA_VERSION,
  anchorBoundaryTime: DEFAULT_ANCHOR_BOUNDARY_TIME,
  morningCheckInEnabled: true,
  defaultPrepDurationMinutes: 30,
  notificationDismissedNotice: false,
  updatedAt: 0,
};

/**
 * Validates a SleepPreferences object defensively at runtime.
 */
export function isValidSleepPreferences(item: unknown): item is SleepPreferences {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;

  if (p.version !== CURRENT_SLEEP_SCHEMA_VERSION) return false;

  // Anchor boundary time: valid 'HH:mm' between 02:00 and 12:00
  if (!isValidAnchorBoundary(p.anchorBoundaryTime)) {
    return false;
  }

  if (typeof p.morningCheckInEnabled !== 'boolean') return false;
  if (p.preferredSoundPresetId !== undefined && typeof p.preferredSoundPresetId !== 'string') {
    return false;
  }

  if (
    typeof p.defaultPrepDurationMinutes !== 'number' ||
    !Number.isFinite(p.defaultPrepDurationMinutes) ||
    p.defaultPrepDurationMinutes < 5 ||
    p.defaultPrepDurationMinutes > 120
  ) {
    return false;
  }

  if (typeof p.notificationDismissedNotice !== 'boolean') return false;
  if (typeof p.updatedAt !== 'number' || !Number.isFinite(p.updatedAt)) return false;

  return true;
}

/**
 * Loads sleep preferences from localStorage with fallback to default settings.
 */
export function loadSleepPreferences(): SleepPreferences {
  try {
    if (!checkLocalStorageAvailable()) return { ...DEFAULT_SLEEP_PREFERENCES };

    const raw = localStorage.getItem(SLEEP_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SLEEP_PREFERENCES };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_PREFERENCES_STORAGE_KEY, raw);
      return { ...DEFAULT_SLEEP_PREFERENCES };
    }

    if (!isValidSleepPreferences(parsed)) {
      quarantineCorruptedData(SLEEP_PREFERENCES_STORAGE_KEY, raw);
      return { ...DEFAULT_SLEEP_PREFERENCES };
    }

    return parsed;
  } catch {
    return { ...DEFAULT_SLEEP_PREFERENCES };
  }
}

/**
 * Saves partial or full sleep preferences to localStorage.
 */
export function saveSleepPreferences(updates: Partial<SleepPreferences>): boolean {
  if (!checkLocalStorageAvailable()) return false;

  const current = loadSleepPreferences();
  const candidate: SleepPreferences = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };

  if (!isValidSleepPreferences(candidate)) return false;

  try {
    localStorage.setItem(SLEEP_PREFERENCES_STORAGE_KEY, JSON.stringify(candidate));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets sleep preferences to factory defaults.
 */
export function resetSleepPreferences(): SleepPreferences {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_PREFERENCES_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
  return { ...DEFAULT_SLEEP_PREFERENCES };
}
