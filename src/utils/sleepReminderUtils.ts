/**
 * NeuroCalm & Fokus — Sleep Reminder State Engine & Reconciliation Logic
 * Phase S3: Pure, deterministic reminder eligibility evaluation,
 * duplicate prevention via stable occurrence identifiers,
 * expiration windows, and backlog-free reconciliation.
 */

import {
  SleepSchedule,
  ReminderType,
  ReminderEvent,
  NextScheduleEvent,
} from '../types/sleep';
import { addDaysToDate } from './sleepTimeUtils';
import {
  resolveScheduleOccurrences,
  calculateNextBedtime,
  calculateNextWakeUp,
  getScheduleForDate,
} from './sleepScheduleUtils';

/** Expiration window after scheduled occurrence (15 minutes in ms) */
export const REMINDER_EXPIRATION_WINDOW_MS = 15 * 60 * 1000;

/**
 * Creates a stable, deterministic occurrence identifier for a reminder.
 * Format: '{reminderType}:{scheduleId}:{scheduleDate}:{scheduledTimestamp}'
 *
 * Invariant:
 * Binds to the scheduled occurrence timestamp so that changing a schedule's
 * target bedtime, wake time, or lead time produces a distinct occurrence identity,
 * preventing an updated reminder from being falsely suppressed by an earlier handled reminder.
 */
export function createReminderOccurrenceId(
  reminderType: ReminderType,
  scheduleId: string,
  scheduleDate: string,
  scheduledTimestamp: number
): string {
  return `${reminderType}:${scheduleId}:${scheduleDate}:${scheduledTimestamp}`;
}

export interface EvaluateReminderOptions {
  reminderType: ReminderType;
  schedule: SleepSchedule;
  scheduleDateStr: string;
  scheduledTimestamp: number;
  referenceNow: number;
  handledOccurrenceIds: Set<string>;
  leadTimeMinutes?: number;
}

/**
 * Evaluates the status of a specific reminder occurrence against the reference time.
 */
export function evaluateReminderOccurrence(options: EvaluateReminderOptions): ReminderEvent {
  const {
    reminderType,
    schedule,
    scheduleDateStr,
    scheduledTimestamp,
    referenceNow,
    handledOccurrenceIds,
    leadTimeMinutes,
  } = options;

  const id = createReminderOccurrenceId(
    reminderType,
    schedule.id,
    scheduleDateStr,
    scheduledTimestamp
  );
  const isHandled = handledOccurrenceIds.has(id);

  // Check if reminder is enabled in the schedule
  const isEnabled =
    schedule.enabled &&
    (reminderType === 'bedtime_prep'
      ? schedule.bedtimeReminder.enabled
      : schedule.wakeReminder.enabled);

  if (!isEnabled) {
    return {
      id,
      reminderType,
      scheduleId: schedule.id,
      scheduleDate: scheduleDateStr,
      scheduledTimestamp,
      status: 'disabled',
      isDue: false,
      isHandled,
      isExpired: false,
      leadTimeMinutes,
    };
  }

  // If already delivered or acknowledged
  if (isHandled) {
    return {
      id,
      reminderType,
      scheduleId: schedule.id,
      scheduleDate: scheduleDateStr,
      scheduledTimestamp,
      status: 'already_handled',
      isDue: false,
      isHandled: true,
      isExpired: referenceNow > scheduledTimestamp + REMINDER_EXPIRATION_WINDOW_MS,
      leadTimeMinutes,
    };
  }

  // Not yet due
  if (referenceNow < scheduledTimestamp) {
    return {
      id,
      reminderType,
      scheduleId: schedule.id,
      scheduleDate: scheduleDateStr,
      scheduledTimestamp,
      status: 'not_due',
      isDue: false,
      isHandled: false,
      isExpired: false,
      leadTimeMinutes,
    };
  }

  // Within the valid active due window
  if (referenceNow <= scheduledTimestamp + REMINDER_EXPIRATION_WINDOW_MS) {
    return {
      id,
      reminderType,
      scheduleId: schedule.id,
      scheduleDate: scheduleDateStr,
      scheduledTimestamp,
      status: 'due',
      isDue: true,
      isHandled: false,
      isExpired: false,
      leadTimeMinutes,
    };
  }

  // Expired (passed beyond the tolerance window without delivering; skip to prevent backlogs)
  return {
    id,
    reminderType,
    scheduleId: schedule.id,
    scheduleDate: scheduleDateStr,
    scheduledTimestamp,
    status: 'expired',
    isDue: false,
    isHandled: false,
    isExpired: true,
    leadTimeMinutes,
  };
}

export interface ReminderReconciliationResult {
  /** Reminders that are currently active and due for user presentation */
  dueReminders: ReminderEvent[];
  /** Complete list of all evaluated reminder occurrences (for inspection/logging) */
  allEvaluatedEvents: ReminderEvent[];
  /** Next upcoming scheduled bedtime */
  nextBedtime: NextScheduleEvent | null;
  /** Next upcoming scheduled wake-up time */
  nextWakeUp: NextScheduleEvent | null;
}

/**
 * Reconciles current wall-clock time, active schedules, and handled reminder history.
 *
 * Invariants:
 * - Deterministic, non-mutating calculation.
 * - Inspects immediate yesterday, today, and tomorrow occurrences to capture active windows.
 * - Expired reminders are never flagged as due, completely preventing notification backlogs.
 * - Already handled occurrences are flagged as 'already_handled' and never re-triggered.
 */
export function reconcileReminders(
  schedules: SleepSchedule[],
  handledOccurrenceIds: Set<string>,
  referenceNow: number = Date.now()
): ReminderReconciliationResult {
  const referenceDate = new Date(referenceNow);
  const dueReminders: ReminderEvent[] = [];
  const allEvaluatedEvents: ReminderEvent[] = [];

  // Check candidate schedule anchor dates: yesterday (-1), today (0), and tomorrow (+1)
  const candidateOffsets = [-1, 0, 1];

  for (const offset of candidateOffsets) {
    const candidateDate = addDaysToDate(referenceDate, offset);
    const schedule = getScheduleForDate(schedules, candidateDate);
    if (!schedule) continue;

    const occurrences = resolveScheduleOccurrences(schedule, candidateDate);
    if (!occurrences) continue;

    // 1. Evaluate Bedtime Preparation Reminder
    const leadTimeMs = schedule.bedtimeReminder.leadTimeMinutes * 60 * 1000;
    const scheduledBedtimePrepMs = occurrences.bedtimeDate.getTime() - leadTimeMs;

    const bedtimePrepEvent = evaluateReminderOccurrence({
      reminderType: 'bedtime_prep',
      schedule,
      scheduleDateStr: occurrences.scheduleDateStr,
      scheduledTimestamp: scheduledBedtimePrepMs,
      referenceNow,
      handledOccurrenceIds,
      leadTimeMinutes: schedule.bedtimeReminder.leadTimeMinutes,
    });

    allEvaluatedEvents.push(bedtimePrepEvent);
    if (bedtimePrepEvent.isDue) {
      dueReminders.push(bedtimePrepEvent);
    }

    // 2. Evaluate Wake-up Reminder
    const scheduledWakeMs = occurrences.wakeDate.getTime();
    const wakeEvent = evaluateReminderOccurrence({
      reminderType: 'wake_up',
      schedule,
      scheduleDateStr: occurrences.scheduleDateStr,
      scheduledTimestamp: scheduledWakeMs,
      referenceNow,
      handledOccurrenceIds,
    });

    allEvaluatedEvents.push(wakeEvent);
    if (wakeEvent.isDue) {
      dueReminders.push(wakeEvent);
    }
  }

  const nextBedtime = calculateNextBedtime(schedules, referenceDate);
  const nextWakeUp = calculateNextWakeUp(schedules, referenceDate);

  return {
    dueReminders,
    allEvaluatedEvents,
    nextBedtime,
    nextWakeUp,
  };
}
