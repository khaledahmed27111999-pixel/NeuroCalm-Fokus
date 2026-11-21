/**
 * NeuroCalm & Fokus — Sleep Presets Catalog
 * Phase S6: Curated night soundscape presets combining nature recordings,
 * colored noise, restorative brainwave frequencies, and traditional instruments.
 */

import { SoundscapePreset } from '../types/audio';
import { loadCustomPresets } from '../storage/soundscapePresetsStorage';

export const SLEEP_BUILT_IN_PRESETS: SoundscapePreset[] = [
  {
    id: 'sleep_delta_rest',
    nameKey: 'presetSleepDeltaRest',
    isBuiltIn: true,
    tracks: [
      { soundId: 'binaural_delta', volume: 0.4 },
      { soundId: 'brown_noise', volume: 0.5 },
      { soundId: 'rain', volume: 0.6 },
    ],
  },
  {
    id: 'sleep_night_rain',
    nameKey: 'presetSleepNightRain',
    isBuiltIn: true,
    tracks: [
      { soundId: 'rain', volume: 0.7 },
      { soundId: 'stream', volume: 0.45 },
    ],
  },
  {
    id: 'sleep_gentle_fan',
    nameKey: 'presetSleepGentleFan',
    isBuiltIn: true,
    tracks: [
      { soundId: 'fan', volume: 0.7 },
      { soundId: 'pink_noise', volume: 0.35 },
    ],
  },
  {
    id: 'sleep_cozy_hearth',
    nameKey: 'presetSleepCozyHearth',
    isBuiltIn: true,
    tracks: [
      { soundId: 'fireplace', volume: 0.65 },
      { soundId: 'rain', volume: 0.45 },
      { soundId: 'binaural_theta', volume: 0.35 },
    ],
  },
  {
    id: 'sleep_night_guqin',
    nameKey: 'presetSleepNightGuqin',
    isBuiltIn: true,
    tracks: [
      { soundId: 'guqin', volume: 0.6 },
      { soundId: 'stream', volume: 0.4 },
    ],
  },
  {
    id: 'sleep_ocean_lullaby',
    nameKey: 'presetSleepOceanLullaby',
    isBuiltIn: true,
    tracks: [
      { soundId: 'ocean_waves', volume: 0.75 },
      { soundId: 'binaural_delta', volume: 0.35 },
    ],
  },
];

/**
 * Returns all available sleep presets (built-in sleep presets + custom user presets).
 */
export function getSleepPresets(): SoundscapePreset[] {
  return [...SLEEP_BUILT_IN_PRESETS, ...loadCustomPresets()];
}
