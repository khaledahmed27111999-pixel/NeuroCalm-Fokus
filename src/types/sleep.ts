/**
 * NeuroCalm & Fokus — Sleep Architecture Domain Types
 * Phase S2: Foundational type contracts for sleep schedules,
 * manual sleep records, active tracking sessions, preparation preferences,
 * configurable night-anchor boundaries, and morning reflections.
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

export const ALL_DAYS_OF_WEEK: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6] as const;
export const WORKDAYS_OF_WEEK: readonly DayOfWeek[] = [1, 2, 3, 4, 5] as const;
export const WEEKEND_DAYS_OF_WEEK: readonly DayOfWeek[] = [0, 6] as const;

/**
 * Optional morning reflection check-in.
 * Entirely non-judgmental; missing rating is never interpreted as negative.
 */
export type SleepRating = 'rested' | 'neutral' | 'tired';

/**
 * Anomaly flags for detected clock discrepancies or implausible values.
 * Records are flagged for user review rather than silently mutated or dropped.
 */
export type SleepAnomalyFlag =
  | 'end_before_start'
  | 'zero_or_negative_duration'
  | 'implausible_duration'
  | 'future_timestamp'
  | 'clock_rollback_detected';

export interface SleepReminderConfig {
  /** Whether the reminder is active */
  enabled: boolean;
  /** Lead time before bedtime in minutes (e.g., 15, 30, 45, 60) */
  leadTimeMinutes: number;
}

/**
 * User-defined planned sleep schedule.
 * Supports multiple weekday configurations.
 */
export interface SleepSchedule {
  /** Stable unique identifier */
  id: string;
  /** Schema version */
  version: 1;
  /** Whether this schedule is currently active */
  enabled: boolean;
  /** Target bedtime in local 24-hour format ('HH:mm', e.g. '23:00') */
  targetBedtime: string;
  /** Target wake-up time in local 24-hour format ('HH:mm', e.g. '07:00') */
  targetWakeTime: string;
  /** Days of the week this schedule applies to */
  daysOfWeek: DayOfWeek[];
  /** Independent bedtime reminder preference */
  bedtimeReminder: SleepReminderConfig;
  /** Independent wake-up reminder preference */
  wakeReminder: { enabled: boolean };
  /** Unix epoch timestamp (ms) when schedule was created */
  createdAt: number;
  /** Unix epoch timestamp (ms) when schedule was last modified */
  updatedAt: number;
}

/**
 * Audit metadata for user-edited or corrected records.
 */
export interface SleepRecordCorrection {
  /** Previous recorded start timestamp */
  originalStartedAt: number;
  /** Previous recorded end timestamp */
  originalEndedAt: number;
  /** Unix epoch timestamp (ms) when the correction occurred */
  editedAt: number;
  /** Optional reason provided by user */
  reason?: string;
}

/**
 * Historical record of an actual completed sleep session.
 * Created via manual user action ("Woke Up" or retroactive entry).
 */
export interface SleepRecord {
  /** Stable unique identifier */
  id: string;
  /** Schema version */
  version: 1;
  /**
   * Local calendar anchor date ('YYYY-MM-DD').
   * Represents the evening the sleep session belongs to.
   * Stable once assigned; preference changes do not rewrite historical anchor dates.
   */
  sleepDate: string;
  /**
   * Wall-clock Unix epoch timestamp (ms) when user initiated sleep tracking.
   * NOTE: Date.now() reflects system wall-clock, not a guaranteed monotonic counter.
   */
  startedAt: number;
  /**
   * Wall-clock Unix epoch timestamp (ms) when user recorded waking up.
   */
  endedAt: number;
  /**
   * Calculated recorded duration in minutes: Math.round((endedAt - startedAt) / 60000).
   * Wall-clock derived; subject to clock changes.
   */
  durationMinutes: number;
  /**
   * Raw wall-clock duration in milliseconds: endedAt - startedAt.
   */
  durationMs: number;
  /**
   * Local timezone offset in minutes at the time of recording (new Date().getTimezoneOffset()).
   * Positive if local timezone is behind UTC, negative if ahead.
   */
  timezoneOffsetMinutes: number;
  /**
   * Provenance of the record:
   * - 'manual_realtime': User clicked "Started Sleep" and later "Woke Up".
   * - 'manual_retroactive': User manually entered past sleep hours.
   */
  source: 'manual_realtime' | 'manual_retroactive';
  /** Optional gentle self-report on waking */
  rating?: SleepRating;
  /** Optional user note (max 280 chars) */
  notes?: string;
  /** Explicit anomaly flags detected during validation */
  anomalyFlags?: SleepAnomalyFlag[];
  /** Whether the record is flagged for user review due to clock anomalies */
  isFlaggedForReview?: boolean;
  /** Historical audit trail if record was modified */
  corrections?: SleepRecordCorrection[];
  /** Unix epoch timestamp (ms) when record was first created */
  createdAt: number;
  /** Unix epoch timestamp (ms) when record was last modified */
  updatedAt: number;
}

/**
 * Active, in-progress sleep tracking session.
 * Persisted across reloads and device reboots so an overnight session is never lost.
 * Invariant: Exactly one active session can exist at a time.
 */
export interface ActiveSleepSession {
  /** Stable session identifier */
  id: string;
  /** Schema version */
  version: 1;
  /** Status invariant: strictly 'tracking' */
  status: 'tracking';
  /** Wall-clock Unix epoch timestamp (ms) when user clicked "Started Sleep" */
  startedAt: number;
  /** Anchor date assigned at the time tracking commenced ('YYYY-MM-DD') */
  sleepDate: string;
  /** Timezone offset at session initiation */
  timezoneOffsetMinutes: number;
  /** Unix epoch timestamp (ms) when session was saved */
  createdAt: number;
  /** Optional initial intention note */
  notes?: string;
}

export type SleepPrepActivityType =
  | 'wind_down_checklist'
  | 'breathing'
  | 'relaxation'
  | 'soundscape'
  | 'custom';

export interface SleepPrepActivity {
  /** Stable identifier for the activity */
  id: string;
  /** Localization key for activity title */
  titleKey: string;
  /** Localization key for activity description */
  descriptionKey: string;
  /** Categorical activity type */
  activityType: SleepPrepActivityType;
  /** Associated technique or session ID (e.g. '4_7_8_relax', 'session_evening_retreat') */
  targetId?: string;
  /** Optional estimated duration in minutes */
  durationMinutes?: number;
  /** Whether this step is included in user's routine */
  isEnabled: boolean;
  /** Visual order sequence */
  order: number;
}

/**
 * Configuration preferences for the Sleep Preparation wind-down routine.
 * Stores configuration only; no execution engine.
 */
export interface SleepPreparationPreferences {
  /** Schema version */
  version: 1;
  /** Whether the routine checklist is enabled */
  enabled: boolean;
  /** Ordered list of routine activities */
  activities: SleepPrepActivity[];
  /** Custom user-added checklist items */
  customActivities?: Array<{
    id: string;
    title: string;
    isEnabled: boolean;
  }>;
  /** Timestamp when preferences were last updated */
  updatedAt: number;
}

/**
 * General user preferences for the Sleep Section.
 */
export interface SleepPreferences {
  /** Schema version */
  version: 1;
  /**
   * Configurable local-time night boundary in 24-hr 'HH:mm' format (e.g., '06:00').
   * Sessions starting before this boundary belong to the preceding evening.
   * Default: '06:00'. Validated between '02:00' and '12:00'.
   */
  anchorBoundaryTime: string;
  /** Whether the optional morning reflection check-in prompt is enabled */
  morningCheckInEnabled: boolean;
  /** Optional preferred sound preset ID for sleep soundscape */
  preferredSoundPresetId?: string;
  /** Default wind-down preparation window in minutes (e.g., 30) */
  defaultPrepDurationMinutes: number;
  /** Whether user has acknowledged/dismissed the browser notification limitation notice */
  notificationDismissedNotice: boolean;
  /** Timestamp when preferences were last updated */
  updatedAt: number;
}

/**
 * Phase S3: Reminder and Schedule Calculation Types
 */

export type ReminderType = 'bedtime_prep' | 'wake_up';

export type ReminderStatus =
  | 'not_due'
  | 'due'
  | 'expired'
  | 'already_handled'
  | 'disabled';

export interface ReminderEvent {
  /** Stable occurrence identifier, e.g. 'bedtime_prep:sched_1:2026-11-21' */
  id: string;
  /** Type of reminder */
  reminderType: ReminderType;
  /** ID of the associated SleepSchedule */
  scheduleId: string;
  /** Anchor date of the schedule occurrence in 'YYYY-MM-DD' */
  scheduleDate: string;
  /** Scheduled wall-clock timestamp (Unix epoch ms) */
  scheduledTimestamp: number;
  /** Evaluated status of the reminder */
  status: ReminderStatus;
  /** Whether the reminder is currently due for presentation */
  isDue: boolean;
  /** Whether the reminder has already been handled or delivered */
  isHandled: boolean;
  /** Whether the reminder window has expired and should be skipped */
  isExpired: boolean;
  /** Lead time before bedtime in minutes (for bedtime_prep reminders) */
  leadTimeMinutes?: number;
}

export interface NextScheduleEvent {
  /** The matching active schedule */
  schedule: SleepSchedule;
  /** Anchor date of the scheduled night in 'YYYY-MM-DD' */
  scheduleDate: string;
  /** Absolute wall-clock epoch timestamp (ms) of the target event */
  timestamp: number;
  /** Formatted 24-hour time string ('HH:mm') */
  formattedTime: string;
}

export interface ReminderState {
  version: 1;
  /** Bounded list of handled occurrence IDs to prevent duplicate deliveries */
  handledOccurrenceIds: string[];
  /** Last wall-clock timestamp when reconciliation occurred */
  lastReconciledAt: number;
  /** Timestamp when reminder state was last updated */
  updatedAt: number;
}
