/**
 * NeuroCalm & Fokus — Breathing Preferences Storage
 * Phase 3A / Phase 3C-UI-3: Local-first persistence of user preferences ONLY.
 * Zero session history, zero streaks, zero performance scoring.
 */

import {
  BreathingPreferences,
  BreathingTechniqueId,
  BreathingCuePreferences,
  BreathingCueProfile,
  BreathingOptionalCueProfile,
  DEFAULT_BREATHING_CUE_PREFERENCES,
} from '../types/breathing';

export const BREATHING_PREFS_STORAGE_KEY = 'neurocalm_breathing_prefs';

export const DEFAULT_BREATHING_PREFERENCES: BreathingPreferences = {
  lastTechniqueId: 'diaphragmatic',
  preferredDurationMinutes: 3,
  soundscapeId: 'silent',
  instrumentalId: 'none',
  audioCueEnabled: false, // Disabled by default
  tempoMultiplier: 1.0,
  cuePreferences: { ...DEFAULT_BREATHING_CUE_PREFERENCES },
};

const VALID_TECHNIQUE_IDS: Set<BreathingTechniqueId> = new Set([
  'diaphragmatic',
  'resonance_frequency',
  'physiological_sigh',
  'extended_exhale',
  'box_breathing',
  '4_7_8_relax',
  'pursed_lip',
]);

const VALID_DURATIONS: Set<number> = new Set([2, 3, 5, 10]);

const VALID_PROFILES: Set<BreathingCueProfile> = new Set([
  'chime',
  'resonant',
  'bell',
  'wood',
]);

const VALID_OPTIONAL_PROFILES: Set<BreathingOptionalCueProfile> = new Set([
  'chime',
  'resonant',
  'bell',
  'wood',
  'none',
]);

/**
 * Defensive validator for breathing cue preferences.
 * Recovers cleanly from partial, missing, or corrupted values.
 */
export function validateCuePreferences(raw: unknown): BreathingCuePreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_BREATHING_CUE_PREFERENCES };
  }

  const record = raw as Record<string, unknown>;

  const volume =
    typeof record.volume === 'number' && !isNaN(record.volume)
      ? Math.max(0.1, Math.min(1.0, record.volume))
      : DEFAULT_BREATHING_CUE_PREFERENCES.volume;

  const inhaleProfile: BreathingCueProfile =
    typeof record.inhaleProfile === 'string' &&
    VALID_PROFILES.has(record.inhaleProfile as BreathingCueProfile)
      ? (record.inhaleProfile as BreathingCueProfile)
      : DEFAULT_BREATHING_CUE_PREFERENCES.inhaleProfile;

  const exhaleProfile: BreathingCueProfile =
    typeof record.exhaleProfile === 'string' &&
    VALID_PROFILES.has(record.exhaleProfile as BreathingCueProfile)
      ? (record.exhaleProfile as BreathingCueProfile)
      : DEFAULT_BREATHING_CUE_PREFERENCES.exhaleProfile;

  const holdProfile: BreathingOptionalCueProfile =
    typeof record.holdProfile === 'string' &&
    VALID_OPTIONAL_PROFILES.has(record.holdProfile as BreathingOptionalCueProfile)
      ? (record.holdProfile as BreathingOptionalCueProfile)
      : DEFAULT_BREATHING_CUE_PREFERENCES.holdProfile;

  const completionProfile: BreathingOptionalCueProfile =
    typeof record.completionProfile === 'string' &&
    VALID_OPTIONAL_PROFILES.has(record.completionProfile as BreathingOptionalCueProfile)
      ? (record.completionProfile as BreathingOptionalCueProfile)
      : DEFAULT_BREATHING_CUE_PREFERENCES.completionProfile;

  return {
    volume,
    inhaleProfile,
    exhaleProfile,
    holdProfile,
    completionProfile,
  };
}

export function loadBreathingPreferences(): BreathingPreferences {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_BREATHING_PREFERENCES };
    const raw = localStorage.getItem(BREATHING_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BREATHING_PREFERENCES };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_BREATHING_PREFERENCES };
    }

    const lastTechniqueId: BreathingTechniqueId = VALID_TECHNIQUE_IDS.has(parsed.lastTechniqueId)
      ? parsed.lastTechniqueId
      : DEFAULT_BREATHING_PREFERENCES.lastTechniqueId;

    const preferredDurationMinutes: 2 | 3 | 5 | 10 = VALID_DURATIONS.has(parsed.preferredDurationMinutes)
      ? (parsed.preferredDurationMinutes as 2 | 3 | 5 | 10)
      : DEFAULT_BREATHING_PREFERENCES.preferredDurationMinutes;

    const soundscapeId = typeof parsed.soundscapeId === 'string' ? parsed.soundscapeId : 'silent';
    const instrumentalId = typeof parsed.instrumentalId === 'string' ? parsed.instrumentalId : 'none';
    const audioCueEnabled = typeof parsed.audioCueEnabled === 'boolean' ? parsed.audioCueEnabled : false;
    const tempoMultiplier =
      typeof parsed.tempoMultiplier === 'number' &&
      parsed.tempoMultiplier >= 0.75 &&
      parsed.tempoMultiplier <= 1.35
        ? parsed.tempoMultiplier
        : 1.0;

    const cuePreferences = validateCuePreferences(parsed.cuePreferences);

    return {
      lastTechniqueId,
      preferredDurationMinutes,
      soundscapeId,
      instrumentalId,
      audioCueEnabled,
      tempoMultiplier,
      cuePreferences,
    };
  } catch {
    return { ...DEFAULT_BREATHING_PREFERENCES };
  }
}

export function saveBreathingPreferences(prefs: BreathingPreferences): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(BREATHING_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Fail gracefully in restricted environments
  }
}
