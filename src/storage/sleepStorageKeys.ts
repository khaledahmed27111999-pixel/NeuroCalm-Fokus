/**
 * NeuroCalm & Fokus — Sleep Storage Keys & Persistence Constants
 * Phase S2: Dedicated namespaced keys, schema version constants,
 * capacity bounds, and defensive corruption quarantining.
 */

export const SLEEP_SCHEDULE_STORAGE_KEY = 'neurocalm_sleep_schedule_v1';
export const SLEEP_RECORDS_STORAGE_KEY = 'neurocalm_sleep_records_v1';
export const SLEEP_ACTIVE_STORAGE_KEY = 'neurocalm_sleep_active_v1';
export const SLEEP_PREP_STORAGE_KEY = 'neurocalm_sleep_prep_v1';
export const SLEEP_PREP_PROGRESS_STORAGE_KEY = 'neurocalm_sleep_prep_progress_v1';
export const SLEEP_PREFERENCES_STORAGE_KEY = 'neurocalm_sleep_prefs_v1';
export const SLEEP_REMINDERS_STORAGE_KEY = 'neurocalm_sleep_reminders_v1';

export const CURRENT_SLEEP_SCHEMA_VERSION = 1;

/** Maximum historical sleep records retained in localStorage before bounded pruning */
export const MAX_SLEEP_RECORDS = 500;

/** Retained entries during an emergency quota pruning event */
export const EMERGENCY_TRIM_RECORDS = 250;

/** Maximum handled reminder occurrence IDs retained in memory/storage */
export const MAX_HANDLED_REMINDER_IDS = 100;

/**
 * Safely test for localStorage availability in the current environment.
 * Handles private browsing mode, disabled storage, and SSR contexts.
 */
export function checkLocalStorageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const testKey = '__neurocalm_sleep_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Quarantines corrupted stored payload under a timestamped key
 * to prevent silent data destruction while allowing recovery.
 */
export function quarantineCorruptedData(keyPrefix: string, rawData: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const quarantineKey = `${keyPrefix}_corrupt_${Date.now()}`;
    localStorage.setItem(quarantineKey, rawData);
  } catch {
    // Fail silently if storage is completely full
  }
}

/**
 * Determines whether an error is a browser QuotaExceededError.
 */
export function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014)
  );
}
