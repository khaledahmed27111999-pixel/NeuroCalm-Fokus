/**
 * NeuroCalm & Fokus — Sleep Schedule Calculation Utilities
 * Phase S3: Pure, deterministic calendar schedule resolution,
 * next bedtime calculations, and next wake-up calculations.
 *
 * All date calculations use local calendar semantics (year, month, day, hours, minutes)
 * rather than fixed 24-hour millisecond additions, ensuring safety across Daylight Saving Time shifts.
 */

import { SleepSchedule, NextScheduleEvent, DayOfWeek } from '../types/sleep';
import { parseTimeString, formatLocalDateString, addDaysToDate } from './sleepTimeUtils';

export const MAX_SCHEDULE_SEARCH_DAYS = 14;

/**
 * Resolves the active, enabled SleepSchedule applicable for a given calendar date.
 * Returns undefined if no schedule is active on that day of the week.
 */
export function getScheduleForDate(
  schedules: SleepSchedule[],
  date: Date
): SleepSchedule | undefined {
  if (!Array.isArray(schedules) || schedules.length === 0) return undefined;
  const dayOfWeek = date.getDay() as DayOfWeek;
  return schedules.find((s) => s.enabled && s.daysOfWeek.includes(dayOfWeek));
}

export interface ResolvedOccurrences {
  bedtimeDate: Date;
  wakeDate: Date;
  scheduleDateStr: string;
}

/**
 * Resolves the precise local Date instances for the bedtime and wake-up events
 * associated with a specific calendar anchor date.
 *
 * Local Calendar Rules:
 * - If targetBedtime has hours >= 12 (e.g. '23:00'): bedtime occurs on anchorDate evening.
 * - If targetBedtime has hours < 12 (e.g. '01:00'): bedtime occurs after midnight (anchorDate + 1 day).
 * - Wake-up time occurs on the morning following bedtime (typically anchorDate + 1 day).
 */
export function resolveScheduleOccurrences(
  schedule: SleepSchedule,
  anchorDate: Date
): ResolvedOccurrences | null {
  const parsedBed = parseTimeString(schedule.targetBedtime);
  const parsedWake = parseTimeString(schedule.targetWakeTime);
  if (!parsedBed || !parsedWake) return null;

  const y = anchorDate.getFullYear();
  const m = anchorDate.getMonth();
  const d = anchorDate.getDate();

  let bedtimeDate: Date;
  let wakeDate: Date;

  if (parsedBed.hours >= 12) {
    // Standard evening bedtime on anchorDate
    bedtimeDate = new Date(y, m, d, parsedBed.hours, parsedBed.minutes, 0, 0);

    if (parsedWake.hours <= parsedBed.hours) {
      // Wake-up occurs on the morning of the next day (anchorDate + 1)
      const nextDay = addDaysToDate(anchorDate, 1);
      wakeDate = new Date(
        nextDay.getFullYear(),
        nextDay.getMonth(),
        nextDay.getDate(),
        parsedWake.hours,
        parsedWake.minutes,
        0,
        0
      );
    } else {
      // Evening nap / same-day window (e.g. 20:00 to 23:00)
      wakeDate = new Date(y, m, d, parsedWake.hours, parsedWake.minutes, 0, 0);
    }
  } else {
    // Post-midnight bedtime (e.g. 01:00) belonging to anchorDate's evening rest
    const nextDay = addDaysToDate(anchorDate, 1);
    bedtimeDate = new Date(
      nextDay.getFullYear(),
      nextDay.getMonth(),
      nextDay.getDate(),
      parsedBed.hours,
      parsedBed.minutes,
      0,
      0
    );

    if (parsedWake.hours > parsedBed.hours) {
      // Wake-up on the same morning (e.g. bedtime 01:00, wake 08:00)
      wakeDate = new Date(
        nextDay.getFullYear(),
        nextDay.getMonth(),
        nextDay.getDate(),
        parsedWake.hours,
        parsedWake.minutes,
        0,
        0
      );
    } else {
      // Extended morning (wake occurs day + 2)
      const secondDay = addDaysToDate(anchorDate, 2);
      wakeDate = new Date(
        secondDay.getFullYear(),
        secondDay.getMonth(),
        secondDay.getDate(),
        parsedWake.hours,
        parsedWake.minutes,
        0,
        0
      );
    }
  }

  return {
    bedtimeDate,
    wakeDate,
    scheduleDateStr: formatLocalDateString(anchorDate),
  };
}

/**
 * Calculates the next upcoming scheduled bedtime starting from a reference date.
 * Skips disabled schedules and inactive weekdays.
 *
 * @param schedules - Array of SleepSchedule objects
 * @param referenceDate - Reference local Date (default: new Date())
 * @param maxDays - Number of days into future to search (default: 14)
 */
export function calculateNextBedtime(
  schedules: SleepSchedule[],
  referenceDate: Date = new Date(),
  maxDays: number = MAX_SCHEDULE_SEARCH_DAYS
): NextScheduleEvent | null {
  const refTime = referenceDate.getTime();

  for (let offset = 0; offset <= maxDays; offset++) {
    const candidateDate = addDaysToDate(referenceDate, offset);
    const schedule = getScheduleForDate(schedules, candidateDate);
    if (!schedule) continue;

    const occurrences = resolveScheduleOccurrences(schedule, candidateDate);
    if (!occurrences) continue;

    if (occurrences.bedtimeDate.getTime() > refTime) {
      return {
        schedule,
        scheduleDate: occurrences.scheduleDateStr,
        timestamp: occurrences.bedtimeDate.getTime(),
        formattedTime: schedule.targetBedtime,
      };
    }
  }

  return null;
}

/**
 * Calculates the next upcoming scheduled wake-up time starting from a reference date.
 * Checks yesterday's anchor night in case the user is currently asleep before wake-up time.
 *
 * @param schedules - Array of SleepSchedule objects
 * @param referenceDate - Reference local Date (default: new Date())
 * @param maxDays - Number of days into future to search (default: 14)
 */
export function calculateNextWakeUp(
  schedules: SleepSchedule[],
  referenceDate: Date = new Date(),
  maxDays: number = MAX_SCHEDULE_SEARCH_DAYS
): NextScheduleEvent | null {
  const refTime = referenceDate.getTime();

  // Search from offset = -1 (yesterday's anchor night) up to maxDays
  for (let offset = -1; offset <= maxDays; offset++) {
    const candidateDate = addDaysToDate(referenceDate, offset);
    const schedule = getScheduleForDate(schedules, candidateDate);
    if (!schedule) continue;

    const occurrences = resolveScheduleOccurrences(schedule, candidateDate);
    if (!occurrences) continue;

    if (occurrences.wakeDate.getTime() > refTime) {
      return {
        schedule,
        scheduleDate: occurrences.scheduleDateStr,
        timestamp: occurrences.wakeDate.getTime(),
        formattedTime: schedule.targetWakeTime,
      };
    }
  }

  return null;
}

/**
 * Calculates the planned rest duration in minutes between bedtime and wake-up time.
 * Correctly accounts for schedules that cross midnight.
 */
export function calculateScheduleDurationMinutes(targetBedtime: string, targetWakeTime: string): number {
  const bed = parseTimeString(targetBedtime);
  const wake = parseTimeString(targetWakeTime);
  if (!bed || !wake) return 0;

  const bedMins = bed.hours * 60 + bed.minutes;
  let wakeMins = wake.hours * 60 + wake.minutes;

  if (wakeMins <= bedMins) {
    wakeMins += 24 * 60; // crosses midnight into the next day
  }

  return wakeMins - bedMins;
}

/**
 * Checks whether a schedule's wake time occurs on the calendar day following bedtime.
 */
export function isCrossMidnightSchedule(targetBedtime: string, targetWakeTime: string): boolean {
  const bed = parseTimeString(targetBedtime);
  const wake = parseTimeString(targetWakeTime);
  if (!bed || !wake) return false;
  return (wake.hours * 60 + wake.minutes) <= (bed.hours * 60 + bed.minutes);
}

/**
 * Calculates the local wall-clock 'HH:mm' string for a reminder occurring before a given target time.
 * Handles wrapping past midnight backwards safely (e.g., 00:15 - 30m = 23:45).
 */
export function calculateReminderClockTime(targetTimeStr: string, leadMinutes: number): string {
  const parsed = parseTimeString(targetTimeStr);
  if (!parsed) return '';

  let totalMinutes = parsed.hours * 60 + parsed.minutes - leadMinutes;
  while (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }
  totalMinutes = totalMinutes % (24 * 60);

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
