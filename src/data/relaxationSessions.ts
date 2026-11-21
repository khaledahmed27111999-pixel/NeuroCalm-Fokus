/**
 * NeuroCalm & Fokus — Integrated Relaxation Sessions Catalog
 * Phase 3C: Approved 5-session collection combining guided breathing,
 * Chinese traditional instrumental recordings, and nature soundscapes.
 */

import { RelaxationSessionDefinition } from '../types/relaxationSession';

export const RELAXATION_SESSIONS: RelaxationSessionDefinition[] = [
  // ---------------------------------------------------------------------------
  // Session A: Deep Serenity
  // ---------------------------------------------------------------------------
  {
    id: 'session_deep_serenity',
    familyId: 'combined_soundscape',
    nameKey: 'sessionDeepSerenityName',
    subtitleKey: 'sessionDeepSerenitySubtitle',
    descriptionKey: 'sessionDeepSerenityDesc',
    isBreathingSession: true,
    breathingConfig: {
      techniqueId: 'diaphragmatic',
      defaultUntimed: true,
      supportsUntimed: true,
      defaultRetentionMode: 'standard',
      tempoMultiplier: 1.0,
    },
    audioTracks: [
      {
        soundId: 'xiao',
        defaultVolume: 0.60,
        isOptional: false,
        role: 'instrumental',
      },
      {
        soundId: 'rain',
        defaultVolume: 0.50,
        isOptional: true,
        role: 'nature',
      },
    ],
    availableDurations: [3, 5, 10],
    defaultDuration: 5,
  },

  // ---------------------------------------------------------------------------
  // Session B: Quiet Stillness
  // ---------------------------------------------------------------------------
  {
    id: 'session_quiet_stillness',
    familyId: 'chinese_instrumental',
    nameKey: 'sessionQuietStillnessName',
    subtitleKey: 'sessionQuietStillnessSubtitle',
    descriptionKey: 'sessionQuietStillnessDesc',
    isBreathingSession: true,
    breathingConfig: {
      techniqueId: 'diaphragmatic',
      defaultUntimed: true,
      supportsUntimed: true,
      defaultRetentionMode: 'standard',
      tempoMultiplier: 1.0,
    },
    audioTracks: [
      {
        soundId: 'guqin',
        defaultVolume: 0.60,
        isOptional: false,
        role: 'instrumental',
      },
      {
        soundId: 'stream',
        defaultVolume: 0.45,
        isOptional: true,
        role: 'nature',
      },
    ],
    availableDurations: [3, 5, 10],
    defaultDuration: 5,
  },

  // ---------------------------------------------------------------------------
  // Session C: Nature's Rhythm
  // ---------------------------------------------------------------------------
  {
    id: 'session_natures_rhythm',
    familyId: 'nature_based',
    nameKey: 'sessionNaturesRhythmName',
    subtitleKey: 'sessionNaturesRhythmSubtitle',
    descriptionKey: 'sessionNaturesRhythmDesc',
    isBreathingSession: true,
    breathingConfig: {
      techniqueId: 'resonance_frequency',
      defaultUntimed: false,
      supportsUntimed: false,
      defaultRetentionMode: 'standard',
      tempoMultiplier: 1.0, // Baseline: 5.0s in / 5.0s out
    },
    audioTracks: [
      {
        soundId: 'ocean_waves',
        defaultVolume: 0.65,
        isOptional: false,
        role: 'nature',
      },
    ],
    availableDurations: [3, 5, 10],
    defaultDuration: 5,
  },

  // ---------------------------------------------------------------------------
  // Session D: Musical Pause
  // ---------------------------------------------------------------------------
  {
    id: 'session_musical_pause',
    familyId: 'music_only',
    nameKey: 'sessionMusicalPauseName',
    subtitleKey: 'sessionMusicalPauseSubtitle',
    descriptionKey: 'sessionMusicalPauseDesc',
    isBreathingSession: false,
    audioTracks: [
      {
        soundId: 'dizi',
        defaultVolume: 0.65,
        isOptional: false,
        role: 'instrumental',
      },
      {
        soundId: 'stream',
        defaultVolume: 0.40,
        isOptional: true,
        role: 'nature',
      },
    ],
    availableDurations: [5, 10, 15, 'open_ended'],
    defaultDuration: 10,
  },

  // ---------------------------------------------------------------------------
  // Session E: Evening Retreat
  // ---------------------------------------------------------------------------
  {
    id: 'session_evening_retreat',
    familyId: 'music_only',
    nameKey: 'sessionEveningRetreatName',
    subtitleKey: 'sessionEveningRetreatSubtitle',
    descriptionKey: 'sessionEveningRetreatDesc',
    isBreathingSession: false,
    breathingConfig: {
      techniqueId: 'diaphragmatic',
      defaultUntimed: true,
      supportsUntimed: true,
      defaultRetentionMode: 'standard',
      tempoMultiplier: 1.0,
      isOptional: true, // User can enable gentle breathing if desired
    },
    audioTracks: [
      {
        soundId: 'guqin',
        defaultVolume: 0.55,
        isOptional: false,
        role: 'instrumental',
      },
      {
        soundId: 'fireplace',
        defaultVolume: 0.45,
        isOptional: true,
        role: 'ambient',
      },
    ],
    availableDurations: [10, 15, 30, 'open_ended'],
    defaultDuration: 15,
  },
];

/**
 * Returns a relaxation session definition by ID, or undefined if not found.
 */
export function getRelaxationSession(id: string): RelaxationSessionDefinition | undefined {
  return RELAXATION_SESSIONS.find((session) => session.id === id);
}

export const getSessionById = getRelaxationSession;

/**
 * Filters relaxation sessions by family ID. Returns all if 'all'.
 */
export function getSessionsByFamily(familyId: string): RelaxationSessionDefinition[] {
  if (!familyId || familyId === 'all') {
    return RELAXATION_SESSIONS;
  }
  return RELAXATION_SESSIONS.filter((session) => session.familyId === familyId);
}
