/**
 * NeuroCalm & Fokus — Sleep Timer Preferences Storage
 * Local-first persistence under 'neurocalm_sleep_timer_prefs_v1'
 * Phase 4B: Persists user default durations ONLY. Active timer countdowns
 * are strictly ephemeral and are NEVER stored to prevent accidental playback resumption.
 */

import { SleepTimerPreferences } from '../types/sleepTimer';

export const SLEEP_TIMER_STORAGE_KEY = 'neurocalm_sleep_timer_prefs_v1';

export const DEFAULT_SLEEP_TIMER_PREFERENCES: SleepTimerPreferences = {
  preferredDurationMinutes: 30,
  preferredFadeDurationSeconds: 60,
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
    return fallback;
  }
  const rounded = Math.round(val);
  return Math.min(Math.max(rounded, min), max);
}

/**
 * Loads sleep timer preferences from localStorage with defensive validation and fallback.
 */
export function loadSleepTimerPreferences(): SleepTimerPreferences {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_SLEEP_TIMER_PREFERENCES };
    }

    const raw = localStorage.getItem(SLEEP_TIMER_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SLEEP_TIMER_PREFERENCES };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_SLEEP_TIMER_PREFERENCES };
    }

    const preferredDurationMinutes = clampInt(
      parsed.preferredDurationMinutes,
      1,
      180,
      DEFAULT_SLEEP_TIMER_PREFERENCES.preferredDurationMinutes
    );

    const preferredFadeDurationSeconds = clampInt(
      parsed.preferredFadeDurationSeconds,
      10,
      600,
      DEFAULT_SLEEP_TIMER_PREFERENCES.preferredFadeDurationSeconds
    );

    return {
      preferredDurationMinutes,
      preferredFadeDurationSeconds,
    };
  } catch {
    // Fail safe on quota/storage corruption/security sandbox errors
    return { ...DEFAULT_SLEEP_TIMER_PREFERENCES };
  }
}

/**
 * Saves sleep timer preferences to localStorage safely.
 */
export function saveSleepTimerPreferences(prefs: SleepTimerPreferences): void {
  try {
    if (typeof localStorage === 'undefined') return;

    const payload: SleepTimerPreferences = {
      preferredDurationMinutes: clampInt(
        prefs.preferredDurationMinutes,
        1,
        180,
        DEFAULT_SLEEP_TIMER_PREFERENCES.preferredDurationMinutes
      ),
      preferredFadeDurationSeconds: clampInt(
        prefs.preferredFadeDurationSeconds,
        10,
        600,
        DEFAULT_SLEEP_TIMER_PREFERENCES.preferredFadeDurationSeconds
      ),
    };

    localStorage.setItem(SLEEP_TIMER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Fail silently without crashing the app on quota or sandbox restriction
  }
}

/**
 * Clears persisted sleep timer preferences (resets to defaults).
 */
export function clearSleepTimerPreferences(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SLEEP_TIMER_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}
