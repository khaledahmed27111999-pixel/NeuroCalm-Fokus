/**
 * NeuroCalm & Fokus — Sleep Time & Date Utilities
 * Phase S2: Pure, deterministic calendar date arithmetic,
 * configurable anchor-night boundary calculations, duration calculations,
 * and clock anomaly detection.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * Wall-clock timestamps (such as Unix epoch milliseconds via Date.now())
 * are NOT monotonic. They are subject to manual system-clock adjustments,
 * NTP synchronization steps, leap seconds, and local timezone shifts.
 * Conversely, performance.now() is monotonic within its active runtime
 * context, but cannot be persisted across browser reloads or device reboots.
 *
 * Therefore, sleep records persist Unix epoch timestamps (ms) for cross-session
 * durability, compute durations derived from wall-clock deltas (endedAt - startedAt),
 * and explicitly detect and flag anomalies for user review rather than silently
 * fabricating or mutating timestamps.
 */

import { SleepAnomalyFlag } from '../types/sleep';

export const DEFAULT_ANCHOR_BOUNDARY_TIME = '06:00';
export const MIN_ANCHOR_BOUNDARY_TIME = '02:00';
export const MAX_ANCHOR_BOUNDARY_TIME = '12:00';

/** Maximum plausible duration for a single continuous sleep record (24 hours in ms) */
export const MAX_PLAUSIBLE_SLEEP_DURATION_MS = 24 * 60 * 60 * 1000;

/** Tolerance buffer for device clock jitter when checking future timestamps (2 minutes) */
export const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * Validates a 24-hour time string in 'HH:mm' format (00:00 to 23:59).
 */
export function isValidTimeString(timeStr: unknown): timeStr is string {
  if (typeof timeStr !== 'string') return false;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
  return match !== null;
}

/**
 * Parses a 24-hour time string ('HH:mm') into hours and minutes integers.
 * Returns null if the format is invalid.
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  if (!isValidTimeString(timeStr)) return null;
  const [hStr, mStr] = timeStr.trim().split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

/**
 * Validates whether an anchor boundary time is acceptable (between 02:00 and 12:00).
 * Prevents setting afternoon or late evening hours as morning boundaries.
 */
export function isValidAnchorBoundary(boundaryStr: unknown): boolean {
  if (!isValidTimeString(boundaryStr)) return false;
  const parsed = parseTimeString(boundaryStr);
  if (!parsed) return false;
  const totalMinutes = parsed.hours * 60 + parsed.minutes;
  const minMinutes = 2 * 60;  // 02:00
  const maxMinutes = 12 * 60; // 12:00
  return totalMinutes >= minMinutes && totalMinutes <= maxMinutes;
}

/**
 * Format a Date object into a local 'YYYY-MM-DD' calendar string.
 * Uses local calendar getters to remain timezone-agnostic and avoid UTC offsets.
 */
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add calendar days to a Date object using calendar date arithmetic.
 * Avoids raw millisecond manipulation to remain safe across Daylight Saving Time shifts.
 */
export function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculates the local anchor date ('YYYY-MM-DD') for a sleep session.
 *
 * Rules:
 * 1. A session starting at or after the boundary (e.g. 06:00) belongs to that calendar date.
 * 2. A session starting after midnight but strictly before the boundary (e.g. 02:00, 05:59)
 *    belongs to the PRECEDING calendar evening (calendar date minus 1 day).
 * 3. Boundary equality: A session starting at exactly the boundary (e.g. 06:00:00.000)
 *    belongs to the current calendar date.
 *
 * @param startedAtMs - Unix epoch timestamp (ms)
 * @param boundaryTimeStr - Local time boundary string ('HH:mm', default '06:00')
 * @param timezoneOffsetMinutes - Optional timezone offset (in minutes) at the time of recording.
 *                                If omitted, the runtime's local timezone is used.
 */
export function calculateAnchorDate(
  startedAtMs: number,
  boundaryTimeStr: string = DEFAULT_ANCHOR_BOUNDARY_TIME,
  timezoneOffsetMinutes?: number
): string {
  const boundary = parseTimeString(boundaryTimeStr) ?? { hours: 6, minutes: 0 };
  const boundaryTotalMinutes = boundary.hours * 60 + boundary.minutes;

  let localDate: Date;
  let localHours: number;
  let localMinutes: number;

  if (timezoneOffsetMinutes !== undefined) {
    // Reconstruct the exact local date/time of the original recording context
    // Local time = UTC time - timezoneOffsetMinutes
    const utcMs = startedAtMs;
    const targetLocalMs = utcMs - timezoneOffsetMinutes * 60 * 1000;
    const d = new Date(targetLocalMs);
    localHours = d.getUTCHours();
    localMinutes = d.getUTCMinutes();
    localDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  } else {
    localDate = new Date(startedAtMs);
    localHours = localDate.getHours();
    localMinutes = localDate.getMinutes();
  }

  const sessionTotalMinutes = localHours * 60 + localMinutes;

  // If the session commenced after midnight but before the configured morning boundary,
  // it belongs to the previous evening's rest.
  if (sessionTotalMinutes < boundaryTotalMinutes) {
    const precedingDate = addDaysToDate(localDate, -1);
    return formatLocalDateString(precedingDate);
  }

  return formatLocalDateString(localDate);
}

export interface SleepDurationCalculationResult {
  durationMs: number;
  durationMinutes: number;
  anomalies: SleepAnomalyFlag[];
  isFlaggedForReview: boolean;
}

/**
 * Calculates recorded sleep duration from start and end timestamps.
 * Detects clock discrepancies, negative intervals, and biologically implausible durations.
 *
 * @param startedAt - Wall-clock start timestamp in epoch ms
 * @param endedAt - Wall-clock end timestamp in epoch ms
 * @param referenceNow - Current timestamp for future-timestamp sanity check
 */
export function calculateSleepDuration(
  startedAt: number,
  endedAt: number,
  referenceNow: number = Date.now()
): SleepDurationCalculationResult {
  const anomalies: SleepAnomalyFlag[] = [];

  const durationMs = endedAt - startedAt;

  if (endedAt < startedAt) {
    anomalies.push('end_before_start');
  } else if (durationMs === 0) {
    anomalies.push('zero_or_negative_duration');
  } else if (durationMs > MAX_PLAUSIBLE_SLEEP_DURATION_MS) {
    // Sleep exceeding 24 hours continuously without waking is biologically implausible
    // and indicates an unended session or corrupted timestamp.
    anomalies.push('implausible_duration');
  }

  if (startedAt > referenceNow + FUTURE_TOLERANCE_MS || endedAt > referenceNow + FUTURE_TOLERANCE_MS) {
    anomalies.push('future_timestamp');
  }

  const durationMinutes = Math.max(0, Math.round(durationMs / (60 * 1000)));

  return {
    durationMs,
    durationMinutes,
    anomalies,
    isFlaggedForReview: anomalies.length > 0,
  };
}
