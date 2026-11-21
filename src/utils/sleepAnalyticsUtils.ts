/**
 * NeuroCalm & Fokus — Sleep Analytics & Insights Utilities
 * Phase S8: Pure, deterministic descriptive metrics,
 * range filtering, circular clock arithmetic, schedule comparisons,
 * and trend bucket aggregations.
 *
 * IMPORTANT:
 * Recorded intervals reflect manual timestamps ("Started Sleep" to "Woke Up").
 * They are never treated as verified physiological sleep duration,
 * and no medical scoring or sleep stages are calculated.
 */

import {
  SleepRecord,
  SleepRating,
  SleepSchedule,
  DayOfWeek,
} from '../types/sleep';
import {
  formatLocalDateString,
  addDaysToDate,
  calculateAnchorDate,
} from './sleepTimeUtils';
import { resolveScheduleOccurrences } from './sleepScheduleUtils';

export type AnalyticsTimeRange = '7d' | '14d' | '30d' | 'all';

export interface SleepOverviewStats {
  totalRecords: number;
  uniqueNights: number;
  avgDurationMinutes: number;
  longestRecord: SleepRecord | null;
  shortestRecord: SleepRecord | null;
  latestRecord: SleepRecord | null;
  hasEnoughData: boolean;
}

export interface NightlyTrendBucket {
  sleepDate: string;
  dayOfWeek: DayOfWeek;
  totalDurationMinutes: number;
  records: SleepRecord[];
  hasRecord: boolean;
  primaryRecord?: SleepRecord;
  rating?: SleepRating;
  isFlagged?: boolean;
}

export interface MorningCheckInStats {
  restedCount: number;
  neutralCount: number;
  tiredCount: number;
  unratedCount: number;
  totalRated: number;
  restedPercent: number;
  neutralPercent: number;
  tiredPercent: number;
}

export interface ConsistencyMetrics {
  hasEnoughData: boolean;
  avgStartTimeFormatted: string;
  avgWakeTimeFormatted: string;
  startStdDevMinutes: number;
  wakeStdDevMinutes: number;
}

export interface ScheduleComparisonItem {
  record: SleepRecord;
  hasScheduleForDay: boolean;
  plannedBedtime?: string;
  plannedWakeTime?: string;
  startDiffMinutes?: number; // positive = later than planned, negative = earlier
  wakeDiffMinutes?: number;  // positive = later than planned, negative = earlier
}

export interface ScheduleComparisonStats {
  hasSchedule: boolean;
  totalCompared: number;
  items: ScheduleComparisonItem[];
  avgStartDiffMinutes: number;
  avgWakeDiffMinutes: number;
}

/**
 * Filters records to keep only valid, completed sessions.
 * Excludes records with negative or zero durations.
 */
export function getValidCompletedRecords(records: SleepRecord[]): SleepRecord[] {
  if (!Array.isArray(records)) return [];
  return records.filter(
    (r) =>
      r &&
      typeof r.startedAt === 'number' &&
      typeof r.endedAt === 'number' &&
      typeof r.durationMinutes === 'number' &&
      r.durationMinutes > 0 &&
      r.startedAt < r.endedAt
  );
}

/**
 * Filters completed records by time range relative to an anchor date.
 */
export function filterRecordsByRange(
  records: SleepRecord[],
  range: AnalyticsTimeRange,
  referenceDate: Date = new Date(),
  anchorBoundary: string = '06:00'
): SleepRecord[] {
  const valid = getValidCompletedRecords(records);
  if (range === 'all') return valid;

  const daysCount = range === '7d' ? 7 : range === '14d' ? 14 : 30;
  const currentAnchorDateStr = calculateAnchorDate(referenceDate.getTime(), anchorBoundary);

  // Compute oldest anchor date string in range
  const currentAnchor = new Date(`${currentAnchorDateStr}T12:00:00`);
  const oldestAnchor = addDaysToDate(currentAnchor, -(daysCount - 1));
  const oldestAnchorStr = formatLocalDateString(oldestAnchor);

  return valid.filter(
    (r) => r.sleepDate >= oldestAnchorStr && r.sleepDate <= currentAnchorDateStr
  );
}

/**
 * Calculates high-level descriptive summary statistics.
 */
export function calculateSleepOverviewStats(records: SleepRecord[]): SleepOverviewStats {
  const valid = getValidCompletedRecords(records);
  if (valid.length === 0) {
    return {
      totalRecords: 0,
      uniqueNights: 0,
      avgDurationMinutes: 0,
      longestRecord: null,
      shortestRecord: null,
      latestRecord: null,
      hasEnoughData: false,
    };
  }

  const uniqueNights = new Set(valid.map((r) => r.sleepDate)).size;
  const totalMinutes = valid.reduce((acc, r) => acc + r.durationMinutes, 0);
  const avgDurationMinutes = Math.round(totalMinutes / valid.length);

  let longestRecord = valid[0];
  let shortestRecord = valid[0];

  for (const r of valid) {
    if (r.durationMinutes > longestRecord.durationMinutes) {
      longestRecord = r;
    }
    if (r.durationMinutes < shortestRecord.durationMinutes) {
      shortestRecord = r;
    }
  }

  // Records are sorted newest first; find the one with latest startedAt
  const latestRecord = valid.reduce((latest, r) => (r.startedAt > latest.startedAt ? r : latest), valid[0]);

  return {
    totalRecords: valid.length,
    uniqueNights,
    avgDurationMinutes,
    longestRecord,
    shortestRecord,
    latestRecord,
    hasEnoughData: true,
  };
}

/**
 * Groups records into chronological calendar day buckets.
 * CRITICAL: Empty nights are explicitly flagged with hasRecord: false.
 * They are NEVER populated with 0 hours of actual sleep.
 */
export function calculateNightlyTrendBuckets(
  records: SleepRecord[],
  range: AnalyticsTimeRange,
  referenceDate: Date = new Date(),
  anchorBoundary: string = '06:00'
): NightlyTrendBucket[] {
  const valid = getValidCompletedRecords(records);

  // Group valid records by anchor date
  const recordsByDate = new Map<string, SleepRecord[]>();
  for (const r of valid) {
    const list = recordsByDate.get(r.sleepDate) || [];
    list.push(r);
    recordsByDate.set(r.sleepDate, list);
  }

  if (range === 'all') {
    // Return all dates that have at least one record, sorted chronologically
    const sortedDates = Array.from(recordsByDate.keys()).sort();
    return sortedDates.map((dateStr) => {
      const recs = recordsByDate.get(dateStr) || [];
      const d = new Date(`${dateStr}T12:00:00`);
      const totalMins = recs.reduce((acc, r) => acc + r.durationMinutes, 0);
      const primary = recs.reduce((prev, curr) => (curr.durationMinutes > prev.durationMinutes ? curr : prev), recs[0]);
      return {
        sleepDate: dateStr,
        dayOfWeek: d.getDay() as DayOfWeek,
        totalDurationMinutes: totalMins,
        records: recs,
        hasRecord: true,
        primaryRecord: primary,
        rating: primary?.rating,
        isFlagged: recs.some((r) => r.isFlaggedForReview),
      };
    });
  }

  // For fixed window (7d, 14d, 30d): construct calendar sequence from oldest to current
  const daysCount = range === '7d' ? 7 : range === '14d' ? 14 : 30;
  const currentAnchorStr = calculateAnchorDate(referenceDate.getTime(), anchorBoundary);
  const currentAnchorDate = new Date(`${currentAnchorStr}T12:00:00`);

  const buckets: NightlyTrendBucket[] = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = addDaysToDate(currentAnchorDate, -i);
    const dateStr = formatLocalDateString(targetDate);
    const recs = recordsByDate.get(dateStr) || [];
    const hasRecord = recs.length > 0;
    const totalMins = hasRecord ? recs.reduce((acc, r) => acc + r.durationMinutes, 0) : 0;
    const primary = hasRecord
      ? recs.reduce((prev, curr) => (curr.durationMinutes > prev.durationMinutes ? curr : prev), recs[0])
      : undefined;

    buckets.push({
      sleepDate: dateStr,
      dayOfWeek: targetDate.getDay() as DayOfWeek,
      totalDurationMinutes: totalMins,
      records: recs,
      hasRecord,
      primaryRecord: primary,
      rating: primary?.rating,
      isFlagged: recs.some((r) => r.isFlaggedForReview),
    });
  }

  return buckets;
}

/**
 * Summarizes the distribution of optional morning reflection ratings.
 */
export function calculateMorningCheckInStats(records: SleepRecord[]): MorningCheckInStats {
  const valid = getValidCompletedRecords(records);
  let rested = 0;
  let neutral = 0;
  let tired = 0;
  let unrated = 0;

  for (const r of valid) {
    if (r.rating === 'rested') rested++;
    else if (r.rating === 'neutral') neutral++;
    else if (r.rating === 'tired') tired++;
    else unrated++;
  }

  const totalRated = rested + neutral + tired;
  const restedPercent = totalRated > 0 ? Math.round((rested / totalRated) * 100) : 0;
  const neutralPercent = totalRated > 0 ? Math.round((neutral / totalRated) * 100) : 0;
  const tiredPercent = totalRated > 0 ? Math.round((tired / totalRated) * 100) : 0;

  return {
    restedCount: rested,
    neutralCount: neutral,
    tiredCount: tired,
    unratedCount: unrated,
    totalRated,
    restedPercent,
    neutralPercent,
    tiredPercent,
  };
}

/**
 * Circular clock arithmetic helper.
 * Computes average clock time (0 to 1439 minutes) on a 24-hour cycle.
 */
function calculateCircularMeanMinutes(minuteValues: number[]): number {
  if (minuteValues.length === 0) return 0;

  let sumSin = 0;
  let sumCos = 0;

  for (const val of minuteValues) {
    const angle = (val / (24 * 60)) * 2 * Math.PI;
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }

  const avgSin = sumSin / minuteValues.length;
  const avgCos = sumCos / minuteValues.length;
  let avgAngle = Math.atan2(avgSin, avgCos);

  if (avgAngle < 0) {
    avgAngle += 2 * Math.PI;
  }

  return Math.round((avgAngle / (2 * Math.PI)) * 24 * 60) % (24 * 60);
}

/**
 * Format total minutes (0-1439) into 'HH:mm' string.
 */
export function formatClockMinutes(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates start-time and wake-up consistency metrics using circular statistics.
 */
export function calculateConsistencyMetrics(records: SleepRecord[]): ConsistencyMetrics {
  const valid = getValidCompletedRecords(records);
  if (valid.length < 2) {
    return {
      hasEnoughData: false,
      avgStartTimeFormatted: '—',
      avgWakeTimeFormatted: '—',
      startStdDevMinutes: 0,
      wakeStdDevMinutes: 0,
    };
  }

  const startMinutesList: number[] = [];
  const wakeMinutesList: number[] = [];

  for (const r of valid) {
    const startDate = new Date(r.startedAt);
    const startMins = startDate.getHours() * 60 + startDate.getMinutes();
    startMinutesList.push(startMins);

    const wakeDate = new Date(r.endedAt);
    const wakeMins = wakeDate.getHours() * 60 + wakeDate.getMinutes();
    wakeMinutesList.push(wakeMins);
  }

  const avgStartMins = calculateCircularMeanMinutes(startMinutesList);
  const avgWakeMins = calculateCircularMeanMinutes(wakeMinutesList);

  // Compute circular dispersion in minutes relative to the mean
  const computeDispersion = (list: number[], mean: number): number => {
    let sumSqDiff = 0;
    for (const val of list) {
      let diff = Math.abs(val - mean);
      if (diff > 12 * 60) {
        diff = 24 * 60 - diff;
      }
      sumSqDiff += diff * diff;
    }
    return Math.round(Math.sqrt(sumSqDiff / list.length));
  };

  return {
    hasEnoughData: true,
    avgStartTimeFormatted: formatClockMinutes(avgStartMins),
    avgWakeTimeFormatted: formatClockMinutes(avgWakeMins),
    startStdDevMinutes: computeDispersion(startMinutesList, avgStartMins),
    wakeStdDevMinutes: computeDispersion(wakeMinutesList, avgWakeMins),
  };
}

/**
 * Compares completed records against a configured sleep schedule.
 * Accounts for day-of-week active settings and anchor dates.
 */
export function calculateScheduleComparisons(
  records: SleepRecord[],
  schedule?: SleepSchedule
): ScheduleComparisonStats {
  const valid = getValidCompletedRecords(records);
  if (!schedule || !schedule.enabled || valid.length === 0) {
    return {
      hasSchedule: Boolean(schedule?.enabled),
      totalCompared: 0,
      items: [],
      avgStartDiffMinutes: 0,
      avgWakeDiffMinutes: 0,
    };
  }

  const items: ScheduleComparisonItem[] = [];
  let totalStartDiff = 0;
  let totalWakeDiff = 0;
  let comparedCount = 0;

  for (const record of valid) {
    const anchorDate = new Date(`${record.sleepDate}T12:00:00`);
    const dayOfWeek = anchorDate.getDay() as DayOfWeek;

    if (!schedule.daysOfWeek.includes(dayOfWeek)) {
      items.push({
        record,
        hasScheduleForDay: false,
      });
      continue;
    }

    const occurrences = resolveScheduleOccurrences(schedule, anchorDate);
    if (!occurrences) {
      items.push({
        record,
        hasScheduleForDay: false,
      });
      continue;
    }

    const startDiffMinutes = Math.round(
      (record.startedAt - occurrences.bedtimeDate.getTime()) / 60000
    );
    const wakeDiffMinutes = Math.round(
      (record.endedAt - occurrences.wakeDate.getTime()) / 60000
    );

    totalStartDiff += startDiffMinutes;
    totalWakeDiff += wakeDiffMinutes;
    comparedCount++;

    items.push({
      record,
      hasScheduleForDay: true,
      plannedBedtime: schedule.targetBedtime,
      plannedWakeTime: schedule.targetWakeTime,
      startDiffMinutes,
      wakeDiffMinutes,
    });
  }

  return {
    hasSchedule: true,
    totalCompared: comparedCount,
    items,
    avgStartDiffMinutes: comparedCount > 0 ? Math.round(totalStartDiff / comparedCount) : 0,
    avgWakeDiffMinutes: comparedCount > 0 ? Math.round(totalWakeDiff / comparedCount) : 0,
  };
}
