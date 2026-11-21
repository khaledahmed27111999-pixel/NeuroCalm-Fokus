/**
 * NeuroCalm & Fokus — Integrated Relaxation Preferences Storage
 * Phase 3C: Local-first persistence of user session preferences ONLY.
 * Zero session history, zero streaks, zero performance scoring.
 */

import {
  RelaxationPreferences,
  RelaxationSessionId,
  SessionDurationMinutes,
} from '../types/relaxationSession';
import { SoundscapeId } from '../types/audio';

export const RELAXATION_PREFS_KEY = 'neurocalm_relaxation_prefs_v1';

export const DEFAULT_RELAXATION_PREFERENCES: RelaxationPreferences = {
  lastSessionId: 'session_deep_serenity',
  preferredDuration: 5,
  customTrackVolumes: {
    xiao: 0.60,
    dizi: 0.65,
    guqin: 0.60,
    guzheng: 0.60,
    rain: 0.50,
    stream: 0.45,
    ocean_waves: 0.65,
    fireplace: 0.45,
  },
  keepAudioOnPause: false,
};

const VALID_SESSION_IDS: Set<string> = new Set([
  'session_deep_serenity',
  'session_quiet_stillness',
  'session_natures_rhythm',
  'session_musical_pause',
  'session_evening_retreat',
]);

const VALID_DURATIONS: Set<SessionDurationMinutes> = new Set([
  2, 3, 5, 10, 15, 30, 'open_ended',
]);

export function loadRelaxationPreferences(): RelaxationPreferences {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_RELAXATION_PREFERENCES };
    const raw = localStorage.getItem(RELAXATION_PREFS_KEY);
    if (!raw) return { ...DEFAULT_RELAXATION_PREFERENCES };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_RELAXATION_PREFERENCES };
    }

    const lastSessionId: RelaxationSessionId = VALID_SESSION_IDS.has(parsed.lastSessionId)
      ? (parsed.lastSessionId as RelaxationSessionId)
      : DEFAULT_RELAXATION_PREFERENCES.lastSessionId;

    const preferredDuration: SessionDurationMinutes = VALID_DURATIONS.has(parsed.preferredDuration)
      ? (parsed.preferredDuration as SessionDurationMinutes)
      : DEFAULT_RELAXATION_PREFERENCES.preferredDuration;

    const keepAudioOnPause = typeof parsed.keepAudioOnPause === 'boolean'
      ? parsed.keepAudioOnPause
      : false;

    const customTrackVolumes: Partial<Record<SoundscapeId, number>> = {};
    if (parsed.customTrackVolumes && typeof parsed.customTrackVolumes === 'object') {
      for (const [key, val] of Object.entries(parsed.customTrackVolumes)) {
        if (typeof val === 'number' && !isNaN(val)) {
          customTrackVolumes[key as SoundscapeId] = Math.max(0.0, Math.min(1.0, val));
        }
      }
    }

    return {
      lastSessionId,
      preferredDuration,
      customTrackVolumes: {
        ...DEFAULT_RELAXATION_PREFERENCES.customTrackVolumes,
        ...customTrackVolumes,
      },
      keepAudioOnPause,
    };
  } catch {
    return { ...DEFAULT_RELAXATION_PREFERENCES };
  }
}

export function saveRelaxationPreferences(prefs: RelaxationPreferences): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(RELAXATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Fail gracefully in restricted environments
  }
}
