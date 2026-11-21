/**
 * NeuroCalm & Fokus — Sleep Preparation Preferences Persistence Service
 * Phase S2: Local-first persistence for customizable pre-sleep wind-down routines.
 * Stores configuration and routine ordering only; no execution engine.
 */

import {
  SleepPreparationPreferences,
  SleepPrepActivity,
  SleepPrepActivityType,
} from '../types/sleep';
import {
  SLEEP_PREP_STORAGE_KEY,
  CURRENT_SLEEP_SCHEMA_VERSION,
  checkLocalStorageAvailable,
  quarantineCorruptedData,
} from './sleepStorageKeys';

const VALID_ACTIVITY_TYPES = new Set<SleepPrepActivityType>([
  'wind_down_checklist',
  'breathing',
  'relaxation',
  'soundscape',
  'custom',
]);

export const DEFAULT_PREP_ACTIVITIES: SleepPrepActivity[] = [
  {
    id: 'prep_dim_lights',
    titleKey: 'prepDimLightsTitle',
    descriptionKey: 'prepDimLightsDesc',
    activityType: 'wind_down_checklist',
    durationMinutes: 5,
    isEnabled: true,
    order: 0,
  },
  {
    id: 'prep_breathing',
    titleKey: 'prepBreathingTitle',
    descriptionKey: 'prepBreathingDesc',
    activityType: 'breathing',
    targetId: '4_7_8_relax',
    durationMinutes: 5,
    isEnabled: true,
    order: 1,
  },
  {
    id: 'prep_relaxation',
    titleKey: 'prepRelaxationTitle',
    descriptionKey: 'prepRelaxationDesc',
    activityType: 'relaxation',
    targetId: 'session_evening_retreat',
    durationMinutes: 15,
    isEnabled: true,
    order: 2,
  },
  {
    id: 'prep_sounds',
    titleKey: 'prepSoundsTitle',
    descriptionKey: 'prepSoundsDesc',
    activityType: 'soundscape',
    durationMinutes: 30,
    isEnabled: true,
    order: 3,
  },
];

export const DEFAULT_SLEEP_PREP_PREFERENCES: SleepPreparationPreferences = {
  version: CURRENT_SLEEP_SCHEMA_VERSION,
  enabled: true,
  activities: DEFAULT_PREP_ACTIVITIES,
  updatedAt: 0,
};

/**
 * Validates a SleepPrepActivity object defensively.
 */
function isValidPrepActivity(act: unknown): act is SleepPrepActivity {
  if (!act || typeof act !== 'object') return false;
  const a = act as Record<string, unknown>;

  if (typeof a.id !== 'string' || a.id.trim().length === 0) return false;
  if (typeof a.titleKey !== 'string') return false;
  if (typeof a.descriptionKey !== 'string') return false;
  if (typeof a.activityType !== 'string' || !VALID_ACTIVITY_TYPES.has(a.activityType as SleepPrepActivityType)) {
    return false;
  }
  if (a.targetId !== undefined && typeof a.targetId !== 'string') return false;
  if (a.durationMinutes !== undefined && (typeof a.durationMinutes !== 'number' || a.durationMinutes <= 0)) {
    return false;
  }
  if (typeof a.isEnabled !== 'boolean') return false;
  if (typeof a.order !== 'number' || !Number.isInteger(a.order)) return false;

  return true;
}

/**
 * Validates SleepPreparationPreferences defensively at runtime.
 */
export function isValidSleepPrepPreferences(item: unknown): item is SleepPreparationPreferences {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;

  if (p.version !== CURRENT_SLEEP_SCHEMA_VERSION) return false;
  if (typeof p.enabled !== 'boolean') return false;
  if (!Array.isArray(p.activities)) return false;

  for (const act of p.activities) {
    if (!isValidPrepActivity(act)) return false;
  }

  if (p.customActivities !== undefined) {
    if (!Array.isArray(p.customActivities)) return false;
    for (const ca of p.customActivities) {
      if (!ca || typeof ca !== 'object') return false;
      const c = ca as Record<string, unknown>;
      if (typeof c.id !== 'string' || typeof c.title !== 'string' || typeof c.isEnabled !== 'boolean') {
        return false;
      }
    }
  }

  if (typeof p.updatedAt !== 'number' || !Number.isFinite(p.updatedAt)) return false;

  return true;
}

/**
 * Loads sleep preparation preferences from localStorage with fallback to defaults.
 */
export function loadSleepPrepPreferences(): SleepPreparationPreferences {
  try {
    if (!checkLocalStorageAvailable()) return { ...DEFAULT_SLEEP_PREP_PREFERENCES };

    const raw = localStorage.getItem(SLEEP_PREP_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SLEEP_PREP_PREFERENCES };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantineCorruptedData(SLEEP_PREP_STORAGE_KEY, raw);
      return { ...DEFAULT_SLEEP_PREP_PREFERENCES };
    }

    if (!isValidSleepPrepPreferences(parsed)) {
      quarantineCorruptedData(SLEEP_PREP_STORAGE_KEY, raw);
      return { ...DEFAULT_SLEEP_PREP_PREFERENCES };
    }

    return parsed;
  } catch {
    return { ...DEFAULT_SLEEP_PREP_PREFERENCES };
  }
}

/**
 * Saves sleep preparation preferences to localStorage.
 */
export function saveSleepPrepPreferences(prefs: SleepPreparationPreferences): boolean {
  if (!isValidSleepPrepPreferences(prefs)) return false;
  if (!checkLocalStorageAvailable()) return false;

  try {
    const payload: SleepPreparationPreferences = {
      ...prefs,
      updatedAt: Date.now(),
    };
    localStorage.setItem(SLEEP_PREP_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears persisted sleep prep preferences and resets to defaults.
 */
export function resetSleepPrepPreferences(): SleepPreparationPreferences {
  try {
    if (checkLocalStorageAvailable()) {
      localStorage.removeItem(SLEEP_PREP_STORAGE_KEY);
    }
  } catch {
    // Fail safe
  }
  return { ...DEFAULT_SLEEP_PREP_PREFERENCES };
}
