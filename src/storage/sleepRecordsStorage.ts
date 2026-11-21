/**
 * NeuroCalm & Fokus — Sleep Records Persistence Service
 * Phase S2: Local-first persistence for historical completed sleep records.
 * Supports manual realtime entries, retroactive entries, historical corrections,
 * and optional morning reflection tags.
 */

import {
  SleepRecord,
  SleepRating,
  SleepRecordCorrection,
} from '../types/sleep';
import { calculateSleepDuration } from '../utils/sleepTimeUtils';
import {
  SLEEP_RECORDS_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  MAX_SLEEP_RECORDS,
  EMERGENCY_TRIM_RECORDS,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
  isQuotaExceededError,
} from './sleepStorageKeys';

const VALID_RATINGS = new Set<string>(['rested', 'neutral', 'tired']);
const VALID_SOURCES = new Set<string>(['manual_realtime', 'manual_retroactive']);
const VALID_ANOMALY_FLAGS = new Set<string>([
  'end_before_start',
  'zero_or_negative_duration',
  'implausible_duration',
  'future_timestamp',
  'clock_rollback_detected',
]);

/**
 * Validates a single SleepRecord defensively at runtime.
 */
export function isValidSleepRecord(item: unknown): item is SleepRecord {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.trim().length === 0) return false;
  if (r.version !== CURRENT_SLEEP_SCHEMA_VERSION) return false;

  // Sleep date format: 'YYYY-MM-DD'
  if (typeof r.sleepDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.sleepDate)) {
    return false;
  }

  // Timestamps
  if (typeof r.startedAt !== 'number' || !Number.isFinite(r.startedAt) || r.startedAt <= 0) {
    return false;
  }
  if (typeof r.endedAt !== 'number' || !Number.isFinite(r.endedAt) || r.endedAt <= 0) {
    return false;
  }

  // Durations (allow zero or positive)
  if (typeof r.durationMinutes !== 'number' || !Number.isFinite(r.durationMinutes) || r.durationMinutes < 0) {
    return false;
  }
  if (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs)) {
    return false;
  }

  // Timezone offset in minutes (typically between -840 and +840)
  if (
    typeof r.timezoneOffsetMinutes !== 'number' ||
    !Number.isFinite(r.timezoneOffsetMinutes) ||
    r.timezoneOffsetMinutes < -840 ||
    r.timezoneOffsetMinutes > 840
  ) {
    return false;
  }

  // Source provenance
  if (typeof r.source !== 'string' || !VALID_SOURCES.has(r.source)) {
    return false;
  }

  // Optional rating
  if (r.rating !== undefined && (typeof r.rating !== 'string' || !VALID_RATINGS.has(r.rating))) {
    return false;
  }

  // Optional notes
  if (r.notes !== undefined && typeof r.notes !== 'string') {
    return false;
  }

  // Optional anomaly flags
  if (r.anomalyFlags !== undefined) {
    if (!Array.isArray(r.anomalyFlags)) return false;
    for (const flag of r.anomalyFlags) {
      if (typeof flag !== 'string' || !VALID_ANOMALY_FLAGS.has(flag)) {
        return false;
      }
    }
  }

  if (r.isFlaggedForReview !== undefined && typeof r.isFlaggedForReview !== 'boolean') {
    return false;
  }

  // Optional corrections audit trail
  if (r.corrections !== undefined) {
    if (!Array.isArray(r.corrections)) return false;
    for (const c of r.corrections) {
      if (!c || typeof c !== 'object') return false;
      const cor = c as Record<string, unknown>;
      if (typeof cor.originalStartedAt !== 'number' || typeof cor.originalEndedAt !== 'number') {
        return false;
      }
      if (typeof cor.editedAt !== 'number' || cor.editedAt <= 0) {
        return false;
      }
    }
  }

  // Record creation/update timestamps
  if (typeof r.createdAt !== 'number' || !Number.isFinite(r.createdAt) || r.createdAt <= 0) {
    return false;
  }
  if (typeof r.updatedAt !== 'number' || !Number.isFinite(r.updatedAt) || r.updatedAt <= 0) {
    return false;
  }

  return true;
}

/**
 * Loads all historical sleep records from localStorage.
 * Returns records sorted by startedAt descending (newest first).
 * Quarantines corrupted data if JSON parsing fails.
 */
export function loadSleepRecords(): SleepRecord[] {
  try {
    if (!checkLocalStorageAvailable()) return [];

    const raw = localStorage.getItem(SLEEP_RECORDS_STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_RECORDS_STORAGE_KEY, raw);
      return [];
    }

    if (!Array.isArray(parsed)) {
      quarantineCorruptedData(SLEEP_RECORDS_STORAGE_KEY, raw);
      return [];
    }

    const validRecords = parsed.filter(isValidSleepRecord);
    // Sort newest first
    return validRecords.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

/**
 * Internal helper to write records with quota protection.
 */
function writeSleepRecordsToStorage(records: SleepRecord[]): boolean {
  try {
    // Bound to MAX_SLEEP_RECORDS
    let toSave = records.slice(0, MAX_SLEEP_RECORDS);
    try {
      localStorage.setItem(SLEEP_RECORDS_STORAGE_KEY, JSON.stringify(toSave));
      return true;
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        // Emergency trim: retain EMERGENCY_TRIM_RECORDS newest records
        toSave = toSave.slice(0, EMERGENCY_TRIM_RECORDS);
        localStorage.setItem(SLEEP_RECORDS_STORAGE_KEY, JSON.stringify(toSave));
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Saves a completed sleep record to history.
 * If a record with the same ID exists, updates it. Otherwise prepends it.
 * Enforces bounded storage capacity and quota safety.
 */
export function saveSleepRecord(record: SleepRecord): boolean {
  if (!isValidSleepRecord(record)) return false;
  if (!checkLocalStorageAvailable()) return false;

  const records = loadSleepRecords();
  const existingIdx = records.findIndex((r) => r.id === record.id);

  let updated: SleepRecord[];
  if (existingIdx >= 0) {
    updated = [...records];
    updated[existingIdx] = { ...record, updatedAt: Date.now() };
  } else {
    updated = [record, ...records];
  }

  // Keep sorted newest first
  updated.sort((a, b) => b.startedAt - a.startedAt);
  return writeSleepRecordsToStorage(updated);
}

/**
 * Updates an existing historical sleep record.
 * Supports updating timestamps, rating, notes, and records an audit trail.
 */
export function updateSleepRecord(
  id: string,
  updates: {
    startedAt?: number;
    endedAt?: number;
    sleepDate?: string;
    rating?: SleepRating;
    notes?: string;
    reason?: string;
  }
): boolean {
  if (!checkLocalStorageAvailable()) return false;

  const records = loadSleepRecords();
  const recordIndex = records.findIndex((r) => r.id === id);
  if (recordIndex < 0) return false;

  const target = records[recordIndex];
  const newStartedAt = updates.startedAt ?? target.startedAt;
  const newEndedAt = updates.endedAt ?? target.endedAt;

  // Re-calculate duration if timestamps changed
  const calc = calculateSleepDuration(newStartedAt, newEndedAt);

  const corrections: SleepRecordCorrection[] = target.corrections ? [...target.corrections] : [];
  if (updates.startedAt !== undefined || updates.endedAt !== undefined) {
    corrections.push({
      originalStartedAt: target.startedAt,
      originalEndedAt: target.endedAt,
      editedAt: Date.now(),
      reason: updates.reason,
    });
  }

  const updatedRecord: SleepRecord = {
    ...target,
    sleepDate: updates.sleepDate ?? target.sleepDate,
    startedAt: newStartedAt,
    endedAt: newEndedAt,
    durationMs: calc.durationMs,
    durationMinutes: calc.durationMinutes,
    anomalyFlags: calc.anomalies.length > 0 ? calc.anomalies : undefined,
    isFlaggedForReview: calc.isFlaggedForReview,
    rating: updates.rating !== undefined ? updates.rating : target.rating,
    notes: updates.notes !== undefined ? updates.notes.slice(0, 280) : target.notes,
    corrections: corrections.length > 0 ? corrections : undefined,
    updatedAt: Date.now(),
  };

  if (!isValidSleepRecord(updatedRecord)) return false;

  records[recordIndex] = updatedRecord;
  records.sort((a, b) => b.startedAt - a.startedAt);
  return writeSleepRecordsToStorage(records);
}

/**
 * Updates or removes the optional morning reflection rating and notes.
 */
export function updateMorningReflection(
  id: string,
  rating: SleepRating | undefined,
  notes?: string
): boolean {
  const records = loadSleepRecords();
  const recordIndex = records.findIndex((r) => r.id === id);
  if (recordIndex < 0) return false;

  const target = records[recordIndex];
  const updatedRecord: SleepRecord = {
    ...target,
    rating,
    notes: notes !== undefined ? notes.slice(0, 280) : target.notes,
    updatedAt: Date.now(),
  };

  if (!isValidSleepRecord(updatedRecord)) return false;

  records[recordIndex] = updatedRecord;
  return writeSleepRecordsToStorage(records);
}

/**
 * Deletes a historical sleep record by ID.
 */
export function deleteSleepRecord(id: string): boolean {
  if (!checkLocalStorageAvailable()) return false;

  const records = loadSleepRecords();
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length === records.length) return false;

  return writeSleepRecordsToStorage(filtered);
}

/**
 * Clears all persisted sleep records.
 */
export function clearSleepRecords(): void {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_RECORDS_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
}
