/**
 * NeuroCalm & Fokus — Audio Settings Storage
 * Local-first persistence under 'neurocalm_audio_settings_v1'
 */

import { AudioSettingsPayload, SoundscapeId } from '../types/audio';

export const AUDIO_STORAGE_KEY = 'neurocalm_audio_settings_v1';

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsPayload = {
  masterVolume: 0.8,
  isMuted: false,
  trackVolumes: {
    white_noise: 0.7,
    pink_noise: 0.7,
    brown_noise: 0.7,
    violet_noise: 0.7,
    rain: 0.75,
    thunder: 0.65,
    wind: 0.7,
    forest: 0.75,
    stream: 0.7,
    ocean_waves: 0.7,
    fireplace: 0.7,
    cafe: 0.65,
    library: 0.65,
    fan: 0.7,
    binaural_delta: 0.7,
    binaural_theta: 0.7,
    binaural_alpha: 0.7,
    binaural_beta: 0.7,
    binaural_gamma: 0.7,
    monaural_alpha: 0.7,
    isochronic_alpha: 0.7,
    isochronic_theta: 0.7,
  },
};

const VALID_SOUNDSCAPE_IDS: Set<string> = new Set([
  'white_noise',
  'pink_noise',
  'brown_noise',
  'violet_noise',
  'rain',
  'thunder',
  'wind',
  'forest',
  'stream',
  'ocean_waves',
  'fireplace',
  'cafe',
  'library',
  'fan',
  'binaural_delta',
  'binaural_theta',
  'binaural_alpha',
  'binaural_beta',
  'binaural_gamma',
  'monaural_alpha',
  'isochronic_alpha',
  'isochronic_theta',
]);

/**
 * Clamp a number to [min, max] or fallback if invalid.
 */
function clamp(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
    return fallback;
  }
  return Math.min(Math.max(val, min), max);
}

/**
 * Load audio settings from localStorage with defensive validation.
 */
export function loadAudioSettings(): AudioSettingsPayload {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }

    // Validate masterVolume
    const masterVolume = clamp(
      parsed.masterVolume,
      0.0,
      1.0,
      DEFAULT_AUDIO_SETTINGS.masterVolume
    );

    // Validate isMuted
    const isMuted = typeof parsed.isMuted === 'boolean' ? parsed.isMuted : false;

    // Validate trackVolumes
    const trackVolumes: Partial<Record<SoundscapeId, number>> = {
      ...DEFAULT_AUDIO_SETTINGS.trackVolumes,
    };

    if (parsed.trackVolumes && typeof parsed.trackVolumes === 'object') {
      for (const [key, val] of Object.entries(parsed.trackVolumes)) {
        if (VALID_SOUNDSCAPE_IDS.has(key)) {
          const clampedVal = clamp(val, 0.0, 1.0, -1);
          if (clampedVal >= 0) {
            trackVolumes[key as SoundscapeId] = clampedVal;
          }
        }
      }
    }

    return {
      masterVolume,
      isMuted,
      trackVolumes,
    };
  } catch {
    // Fail safe on quota/storage corruption/security sandbox errors
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/**
 * Save audio settings to localStorage safely.
 */
export function saveAudioSettings(settings: AudioSettingsPayload): void {
  try {
    const payload: AudioSettingsPayload = {
      masterVolume: clamp(settings.masterVolume, 0.0, 1.0, DEFAULT_AUDIO_SETTINGS.masterVolume),
      isMuted: Boolean(settings.isMuted),
      trackVolumes: {},
    };

    if (settings.trackVolumes && typeof settings.trackVolumes === 'object') {
      for (const [key, val] of Object.entries(settings.trackVolumes)) {
        if (VALID_SOUNDSCAPE_IDS.has(key)) {
          payload.trackVolumes[key as SoundscapeId] = clamp(val, 0.0, 1.0, 0.7);
        }
      }
    }

    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Fail silently without crashing the app on quota or sandbox restriction
  }
}

/**
 * Clear persisted audio settings (reset to defaults).
 */
export function clearAudioSettings(): void {
  try {
    localStorage.removeItem(AUDIO_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}
