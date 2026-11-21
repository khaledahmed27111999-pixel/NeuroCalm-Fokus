/**
 * NeuroCalm & Fokus — Sleep Data Schema Migration Engine
 * Phase S2: Migration strategy and unsupported schema version protection.
 * Ensures forward compatibility, upgrades legacy unversioned payloads,
 * and preserves unsupported future versions without silent data destruction.
 */

import { SleepRecord, SleepPreferences } from '../types/sleep';
import {
  CURRENT_SLEEP_SCHEMA_VERSION,
  SLEEP_RECORDS_STORAGE_KEY,
  SLEEP_PREFERENCES_STORAGE_KEY,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';
import { isValidSleepRecord } from './sleepRecordsStorage';
import { isValidSleepPreferences, DEFAULT_SLEEP_PREFERENCES } from './sleepPreferencesStorage';

export interface MigrationResult {
  migrated: boolean;
  recordsCount: number;
  unsupportedVersionsFound: boolean;
}

/**
 * Checks and migrates sleep records if stored under an unversioned or legacy schema.
 * If a future unsupported schema version (e.g. > CURRENT_SLEEP_SCHEMA_VERSION) is found,
 * it preserves the payload and flags unsupportedVersionsFound without overwriting.
 */
export function migrateSleepRecords(): MigrationResult {
  if (!checkLocalStorageAvailable()) {
    return { migrated: false, recordsCount: 0, unsupportedVersionsFound: false };
  }

  const raw = localStorage.getItem(SLEEP_RECORDS_STORAGE_KEY);
  if (!raw) {
    return { migrated: false, recordsCount: 0, unsupportedVersionsFound: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantineCorruptedData(SLEEP_RECORDS_STORAGE_KEY, raw);
    return { migrated: false, recordsCount: 0, unsupportedVersionsFound: false };
  }

  if (!Array.isArray(parsed)) {
    quarantineCorruptedData(SLEEP_RECORDS_STORAGE_KEY, raw);
    return { migrated: false, recordsCount: 0, unsupportedVersionsFound: false };
  }

  let needsSave = false;
  let unsupportedFound = false;
  const migratedRecords: SleepRecord[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;

    // Check for future unsupported version
    if (typeof rec.version === 'number' && rec.version > CURRENT_SLEEP_SCHEMA_VERSION) {
      unsupportedFound = true;
      // Do not mutate or drop future records; quarantine to protect user data
      quarantineCorruptedData(`neurocalm_sleep_unsupported_v${rec.version}`, JSON.stringify(rec));
      continue;
    }

    // Unversioned legacy payload migration
    if (rec.version === undefined) {
      rec.version = CURRENT_SLEEP_SCHEMA_VERSION;
      needsSave = true;
    }

    // Default durationMs derivation if missing from an early prototype
    if (rec.durationMs === undefined && typeof rec.startedAt === 'number' && typeof rec.endedAt === 'number') {
      rec.durationMs = rec.endedAt - rec.startedAt;
      needsSave = true;
    }

    // Default timezoneOffset if missing
    if (rec.timezoneOffsetMinutes === undefined) {
      rec.timezoneOffsetMinutes = new Date().getTimezoneOffset();
      needsSave = true;
    }

    // Default source provenance if missing
    if (rec.source === undefined) {
      rec.source = 'manual_realtime';
      needsSave = true;
    }

    if (isValidSleepRecord(rec)) {
      migratedRecords.push(rec);
    }
  }

  if (needsSave && !unsupportedFound) {
    try {
      localStorage.setItem(SLEEP_RECORDS_STORAGE_KEY, JSON.stringify(migratedRecords));
      return { migrated: true, recordsCount: migratedRecords.length, unsupportedVersionsFound: false };
    } catch {
      return { migrated: false, recordsCount: migratedRecords.length, unsupportedVersionsFound: false };
    }
  }

  return {
    migrated: false,
    recordsCount: migratedRecords.length,
    unsupportedVersionsFound: unsupportedFound,
  };
}

/**
 * Checks and migrates sleep preferences if stored under an unversioned schema.
 */
export function migrateSleepPreferences(): boolean {
  if (!checkLocalStorageAvailable()) return false;

  const raw = localStorage.getItem(SLEEP_PREFERENCES_STORAGE_KEY);
  if (!raw) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Record<string, unknown>;

  if (typeof p.version === 'number' && p.version > CURRENT_SLEEP_SCHEMA_VERSION) {
    // Unsupported future version; leave untouched
    return false;
  }

  if (p.version === undefined) {
    const candidate: SleepPreferences = {
      ...DEFAULT_SLEEP_PREFERENCES,
      ...p,
      version: CURRENT_SLEEP_SCHEMA_VERSION,
      updatedAt: Date.now(),
    };
    if (isValidSleepPreferences(candidate)) {
      localStorage.setItem(SLEEP_PREFERENCES_STORAGE_KEY, JSON.stringify(candidate));
      return true;
    }
  }

  return false;
}
