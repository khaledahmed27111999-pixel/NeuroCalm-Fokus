/**
 * NeuroCalm & Fokus — Soundscape Presets Storage
 * Local-first persistence under 'neurocalm_soundscape_presets_v1'
 */

import { SoundscapePreset, SoundscapePresetTrack, SoundscapeId } from '../types/audio';
import { generateId } from '../utils/id';

export const PRESETS_STORAGE_KEY = 'neurocalm_soundscape_presets_v1';
export const MAX_CUSTOM_PRESETS = 20;

export const BUILT_IN_PRESETS: SoundscapePreset[] = [
  {
    id: 'deep_focus',
    nameKey: 'presetDeepFocus',
    isBuiltIn: true,
    tracks: [
      { soundId: 'rain', volume: 0.7 },
      { soundId: 'brown_noise', volume: 0.5 },
      { soundId: 'binaural_beta', volume: 0.4 },
    ],
  },
  {
    id: 'gentle_calm',
    nameKey: 'presetGentleCalm',
    isBuiltIn: true,
    tracks: [
      { soundId: 'ocean_waves', volume: 0.75 },
      { soundId: 'stream', volume: 0.5 },
      { soundId: 'binaural_alpha', volume: 0.4 },
    ],
  },
  {
    id: 'cozy_evening',
    nameKey: 'presetCozyEvening',
    isBuiltIn: true,
    tracks: [
      { soundId: 'fireplace', volume: 0.7 },
      { soundId: 'rain', volume: 0.5 },
      { soundId: 'binaural_theta', volume: 0.4 },
    ],
  },
  {
    id: 'steady_masking',
    nameKey: 'presetSteadyMasking',
    isBuiltIn: true,
    tracks: [
      { soundId: 'fan', volume: 0.7 },
      { soundId: 'pink_noise', volume: 0.4 },
    ],
  },
];

const VALID_SOUNDSCAPE_IDS: Set<string> = new Set([
  'white_noise',
  'pink_noise',
  'brown_noise',
  'violet_noise',
  'rain',
  'stream',
  'ocean_waves',
  'fan',
  'fireplace',
  'binaural_delta',
  'binaural_theta',
  'binaural_alpha',
  'binaural_beta',
  'binaural_gamma',
  'monaural_alpha',
  'isochronic_alpha',
  'isochronic_theta',
  'xiao',
  'dizi',
  'guqin',
  'guzheng',
]);

/**
 * Validate a track configuration object defensively.
 */
function validateTrack(track: unknown): SoundscapePresetTrack | null {
  if (!track || typeof track !== 'object') return null;
  const t = track as Record<string, unknown>;
  if (typeof t.soundId !== 'string' || !VALID_SOUNDSCAPE_IDS.has(t.soundId)) {
    return null;
  }
  const volume = typeof t.volume === 'number' && !isNaN(t.volume)
    ? Math.max(0.0, Math.min(t.volume, 1.0))
    : 0.7;
  return {
    soundId: t.soundId as SoundscapeId,
    volume,
  };
}

/**
 * Load user custom soundscape presets from localStorage with validation.
 */
export function loadCustomPresets(): SoundscapePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validated: SoundscapePreset[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateId();
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Custom Mix';
      
      if (!Array.isArray(item.tracks)) continue;

      const validTracks: SoundscapePresetTrack[] = [];
      for (const rawTrack of item.tracks) {
        const validatedTrack = validateTrack(rawTrack);
        if (validatedTrack && !validTracks.some(t => t.soundId === validatedTrack.soundId)) {
          validTracks.push(validatedTrack);
        }
        if (validTracks.length >= 4) break; // Maximum 4 tracks
      }

      if (validTracks.length > 0) {
        validated.push({
          id,
          name,
          isBuiltIn: false,
          tracks: validTracks,
        });
      }
    }

    return validated.slice(0, MAX_CUSTOM_PRESETS);
  } catch {
    return [];
  }
}

/**
 * Save a new user custom preset. Returns the newly created preset.
 */
export function saveCustomPreset(name: string, tracks: SoundscapePresetTrack[]): SoundscapePreset | null {
  const trimmedName = name.trim() || 'My Mix';
  const validTracks = tracks
    .map(validateTrack)
    .filter((t): t is SoundscapePresetTrack => t !== null)
    .slice(0, 4);

  if (validTracks.length === 0) return null;

  const current = loadCustomPresets();
  const newPreset: SoundscapePreset = {
    id: generateId(),
    name: trimmedName,
    isBuiltIn: false,
    tracks: validTracks,
  };

  const updated = [newPreset, ...current].slice(0, MAX_CUSTOM_PRESETS);
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // LocalStorage full or blocked
  }

  return newPreset;
}

/**
 * Delete a user custom preset by ID.
 */
export function deleteCustomPreset(id: string): boolean {
  // Built-in presets cannot be deleted
  if (BUILT_IN_PRESETS.some(p => p.id === id)) return false;

  const current = loadCustomPresets();
  const filtered = current.filter(p => p.id !== id);
  if (filtered.length === current.length) return false;

  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns all presets (built-in followed by user custom presets).
 */
export function getAllPresets(): SoundscapePreset[] {
  return [...BUILT_IN_PRESETS, ...loadCustomPresets()];
}

/**
 * Clear all custom presets (used in testing or full reset).
 */
export function clearCustomPresets(): void {
  try {
    localStorage.removeItem(PRESETS_STORAGE_KEY);
  } catch {}
}
