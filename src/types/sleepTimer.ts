/**
 * NeuroCalm & Fokus — Sleep Timer & Gradual Audio Fade Domain Types
 * Phase 4B: Foundational type contracts for sleep timer state machine,
 * duration presets, user preferences, and context API.
 */

export type SleepTimerStatus = 'idle' | 'running' | 'fading' | 'completed';

export const SLEEP_TIMER_DURATION_PRESETS = [15, 30, 45, 60] as const;
export type SleepTimerDurationPreset = (typeof SLEEP_TIMER_DURATION_PRESETS)[number];

export const SLEEP_TIMER_FADE_PRESETS = [30, 60, 300] as const;
export type SleepTimerFadePreset = (typeof SLEEP_TIMER_FADE_PRESETS)[number];

export interface SleepTimerPreferences {
  /** Preferred initial countdown duration before fade begins (minutes, 1-180, default 30) */
  preferredDurationMinutes: number;
  /** Preferred gradual fade-out duration (seconds, 10-600, default 60) */
  preferredFadeDurationSeconds: number;
}

export interface SleepTimerState {
  /** Current state machine phase */
  status: SleepTimerStatus;
  /** Configured duration before fade begins (in minutes) */
  durationMinutes: number;
  /** Configured fade-out duration (in seconds) */
  fadeDurationSeconds: number;
  /** Absolute wall-clock timestamp (Date.now() in ms) when fading begins */
  fadeStartWallTime: number | null;
  /** Absolute wall-clock timestamp (Date.now() in ms) when audio reaches silence */
  deadlineWallTime: number | null;
  /** Total remaining seconds until silence (countdown to deadlineWallTime) */
  remainingSeconds: number;
  /** Remaining seconds until fade starts (0 if currently fading) */
  remainingSecondsBeforeFade: number;
  /** Flag indicating whether audio is currently in the active gradual fade stage */
  isFading: boolean;
}

export interface SleepTimerContextType {
  state: SleepTimerState;
  preferences: SleepTimerPreferences;
  /** Starts or restarts the sleep timer with given duration (minutes) and optional fade duration (seconds) */
  startTimer: (durationMinutes: number, fadeDurationSeconds?: number) => void;
  /** Cancels the sleep timer, smoothly recovering gain to unity (1.0) over 500ms if currently fading */
  cancelTimer: () => void;
  /** Extends the current deadline and fade start by additionalMinutes without duplicate scheduling */
  extendTimer: (additionalMinutes: number) => void;
  /** Shortens the current duration, adjusting fade window and reconciling immediately */
  shortenTimer: (newDurationMinutes: number) => void;
  /** Restarts the sleep timer with user's preferred settings */
  restartTimer: () => void;
  /** Updates persisted user preferences for default timer and fade durations */
  updatePreferences: (prefs: Partial<SleepTimerPreferences>) => void;
}
