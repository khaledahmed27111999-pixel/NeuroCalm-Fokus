/**
 * NeuroCalm & Fokus — Breathing Technique Catalog
 * Phase 3A: Scientifically grounded, non-dogmatic respiratory protocols.
 * All protocols prioritize user comfort, unforced breathing, and optional breath retention.
 */

import { BreathingTechnique, BreathingGoalId } from '../types/breathing';

export const BREATHING_GOALS: Array<{ id: BreathingGoalId; nameKey: string; descKey: string }> = [
  {
    id: 'acute_stress',
    nameKey: 'goalAcuteStress',
    descKey: 'goalAcuteStressDesc',
  },
  {
    id: 'anxiety_relief',
    nameKey: 'goalAnxietyRelief',
    descKey: 'goalAnxietyReliefDesc',
  },
  {
    id: 'evening_unwind',
    nameKey: 'goalEveningUnwind',
    descKey: 'goalEveningUnwindDesc',
  },
  {
    id: 'sleep_prep',
    nameKey: 'goalSleepPrep',
    descKey: 'goalSleepPrepDesc',
  },
  {
    id: 'focus_composure',
    nameKey: 'goalFocusComposure',
    descKey: 'goalFocusComposureDesc',
  },
  {
    id: 'gentle_awareness',
    nameKey: 'goalGentleAwareness',
    descKey: 'goalGentleAwarenessDesc',
  },
  {
    id: 'specialized_respiratory',
    nameKey: 'goalSpecialized',
    descKey: 'goalSpecializedDesc',
  },
];

export const BREATHING_TECHNIQUES: BreathingTechnique[] = [
  // -------------------------------------------------------------------------
  // 1. Comfortable Diaphragmatic Breathing
  // -------------------------------------------------------------------------
  {
    id: 'diaphragmatic',
    nameKey: 'techDiaphragmaticName',
    subtitleKey: 'techDiaphragmaticSubtitle',
    descriptionKey: 'techDiaphragmaticDesc',
    scientificContextKey: 'techDiaphragmaticContext',
    goals: ['gentle_awareness', 'anxiety_relief', 'evening_unwind'],
    isBeginnerFriendly: true,
    hasBreathRetention: false,
    canDisableRetention: false,
    isUntimedAwarenessSupported: true,
    defaultDurationMinutes: 3,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 3.5,
        labelKey: 'phaseInhale',
        guidanceKey: 'guideDiaphragmaticInhale',
        targetScale: 1.35,
      },
      {
        type: 'exhale',
        durationSeconds: 4.5,
        labelKey: 'phaseExhale',
        guidanceKey: 'guideDiaphragmaticExhale',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.85,
      maxMultiplier: 1.25,
      step: 0.05,
    },
    recommendedSoundscape: 'stream',
  },

  // -------------------------------------------------------------------------
  // 2. Resonance Pacing
  // -------------------------------------------------------------------------
  {
    id: 'resonance_frequency',
    nameKey: 'techResonanceName',
    subtitleKey: 'techResonanceSubtitle',
    descriptionKey: 'techResonanceDesc',
    scientificContextKey: 'techResonanceContext',
    goals: ['anxiety_relief', 'focus_composure', 'gentle_awareness'],
    isBeginnerFriendly: true,
    hasBreathRetention: false,
    canDisableRetention: false,
    defaultDurationMinutes: 5,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 5.0,
        labelKey: 'phaseInhale',
        guidanceKey: 'guideResonanceInhale',
        targetScale: 1.5,
      },
      {
        type: 'exhale',
        durationSeconds: 5.0,
        labelKey: 'phaseExhale',
        guidanceKey: 'guideResonanceExhale',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.8, // ~6.25 bpm
      maxMultiplier: 1.2, // ~4.15 bpm
      step: 0.05,
    },
    recommendedSoundscape: 'rain',
  },

  // -------------------------------------------------------------------------
  // 3. Physiological Sigh
  // -------------------------------------------------------------------------
  {
    id: 'physiological_sigh',
    nameKey: 'techPhysiologicalSighName',
    subtitleKey: 'techPhysiologicalSighSubtitle',
    descriptionKey: 'techPhysiologicalSighDesc',
    scientificContextKey: 'techPhysiologicalSighContext',
    goals: ['acute_stress', 'evening_unwind'],
    isBeginnerFriendly: true,
    hasBreathRetention: false,
    canDisableRetention: false,
    defaultDurationMinutes: 2,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 2.5,
        labelKey: 'phaseInhaleFirst',
        guidanceKey: 'guideSighInhaleFirst',
        targetScale: 1.35,
      },
      {
        type: 'inhale_second',
        durationSeconds: 1.0,
        labelKey: 'phaseInhaleSecond',
        guidanceKey: 'guideSighInhaleSecond',
        targetScale: 1.55,
      },
      {
        type: 'exhale',
        durationSeconds: 5.5,
        labelKey: 'phaseExhaleLong',
        guidanceKey: 'guideSighExhale',
        targetScale: 1.0,
      },
      {
        type: 'rest',
        durationSeconds: 1.0,
        labelKey: 'phaseRest',
        guidanceKey: 'guideSighRest',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.9,
      maxMultiplier: 1.15,
      step: 0.05,
    },
    recommendedSoundscape: 'ocean_waves',
  },

  // -------------------------------------------------------------------------
  // 4. Extended Exhalation
  // -------------------------------------------------------------------------
  {
    id: 'extended_exhale',
    nameKey: 'techExtendedExhaleName',
    subtitleKey: 'techExtendedExhaleSubtitle',
    descriptionKey: 'techExtendedExhaleDesc',
    scientificContextKey: 'techExtendedExhaleContext',
    goals: ['acute_stress', 'evening_unwind', 'sleep_prep'],
    isBeginnerFriendly: true,
    hasBreathRetention: false,
    canDisableRetention: false,
    defaultDurationMinutes: 5,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 3.5,
        labelKey: 'phaseInhale',
        guidanceKey: 'guideExtendedInhale',
        targetScale: 1.4,
      },
      {
        type: 'rest',
        durationSeconds: 0.5,
        labelKey: 'phaseRest',
        guidanceKey: 'guideNaturalPause',
        targetScale: 1.4,
      },
      {
        type: 'exhale',
        durationSeconds: 6.0,
        labelKey: 'phaseExhaleLong',
        guidanceKey: 'guideExtendedExhale',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.85,
      maxMultiplier: 1.25,
      step: 0.05,
    },
    recommendedSoundscape: 'rain',
  },

  // -------------------------------------------------------------------------
  // 5. Box Breathing (Structured Composure)
  // -------------------------------------------------------------------------
  {
    id: 'box_breathing',
    nameKey: 'techBoxBreathingName',
    subtitleKey: 'techBoxBreathingSubtitle',
    descriptionKey: 'techBoxBreathingDesc',
    scientificContextKey: 'techBoxBreathingContext',
    goals: ['focus_composure'],
    isBeginnerFriendly: false,
    hasBreathRetention: true,
    canDisableRetention: true,
    defaultDurationMinutes: 3,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 4.0,
        labelKey: 'phaseInhale',
        guidanceKey: 'guideBoxInhale',
        targetScale: 1.45,
      },
      {
        type: 'hold_in',
        durationSeconds: 4.0,
        labelKey: 'phaseHoldFull',
        guidanceKey: 'guideBoxHoldIn',
        targetScale: 1.45,
      },
      {
        type: 'exhale',
        durationSeconds: 4.0,
        labelKey: 'phaseExhale',
        guidanceKey: 'guideBoxExhale',
        targetScale: 1.0,
      },
      {
        type: 'hold_out',
        durationSeconds: 4.0,
        labelKey: 'phaseHoldEmpty',
        guidanceKey: 'guideBoxHoldOut',
        targetScale: 1.0,
      },
    ],
    // Genuinely hold-free alternative: Inhale 4s, Exhale 4s (zero holds)
    holdFreePhases: [
      {
        type: 'inhale',
        durationSeconds: 4.0,
        labelKey: 'phaseInhale',
        guidanceKey: 'guideBoxInhale',
        targetScale: 1.45,
      },
      {
        type: 'exhale',
        durationSeconds: 4.0,
        labelKey: 'phaseExhale',
        guidanceKey: 'guideBoxExhale',
        targetScale: 1.0,
      },
    ],
    // Triangle mode: Inhale 3s, Hold In 3s, Exhale 3s (contains hold)
    trianglePhases: [
      {
        type: 'inhale',
        durationSeconds: 3.0,
        labelKey: 'phaseInhale',
        guidanceKey: 'guideBoxInhale',
        targetScale: 1.4,
      },
      {
        type: 'hold_in',
        durationSeconds: 3.0,
        labelKey: 'phaseHoldFull',
        guidanceKey: 'guideBoxHoldIn',
        targetScale: 1.4,
      },
      {
        type: 'exhale',
        durationSeconds: 3.0,
        labelKey: 'phaseExhale',
        guidanceKey: 'guideBoxExhale',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.8,
      maxMultiplier: 1.25,
      step: 0.05,
    },
    recommendedSoundscape: 'fan',
  },

  // -------------------------------------------------------------------------
  // 6. 4-7-8 Relaxing Breath (Exploratory Nighttime)
  // -------------------------------------------------------------------------
  {
    id: '4_7_8_relax',
    nameKey: 'tech478Name',
    subtitleKey: 'tech478Subtitle',
    descriptionKey: 'tech478Desc',
    scientificContextKey: 'tech478Context',
    goals: ['sleep_prep', 'evening_unwind'],
    isBeginnerFriendly: false,
    hasBreathRetention: true,
    canDisableRetention: true,
    defaultDurationMinutes: 3,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 4.0,
        labelKey: 'phaseInhale',
        guidanceKey: 'guide478Inhale',
        targetScale: 1.45,
      },
      {
        type: 'hold_in',
        durationSeconds: 7.0,
        labelKey: 'phaseHoldFull',
        guidanceKey: 'guide478HoldIn',
        targetScale: 1.45,
      },
      {
        type: 'exhale',
        durationSeconds: 8.0,
        labelKey: 'phaseExhaleLong',
        guidanceKey: 'guide478Exhale',
        targetScale: 1.0,
      },
    ],
    // Genuinely hold-free alternative: Inhale 4s, comfortable unforced Exhale 5s (zero holds)
    holdFreePhases: [
      {
        type: 'inhale',
        durationSeconds: 4.0,
        labelKey: 'phaseInhale',
        guidanceKey: 'guide478Inhale',
        targetScale: 1.45,
      },
      {
        type: 'exhale',
        durationSeconds: 5.0,
        labelKey: 'phaseExhaleLong',
        guidanceKey: 'guide478Exhale',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.8,
      maxMultiplier: 1.1,
      step: 0.05,
    },
    recommendedSoundscape: 'stream',
  },

  // -------------------------------------------------------------------------
  // 7. Pursed-Lip Ease (Specialized Qualified Context)
  // -------------------------------------------------------------------------
  {
    id: 'pursed_lip',
    nameKey: 'techPursedLipName',
    subtitleKey: 'techPursedLipSubtitle',
    descriptionKey: 'techPursedLipDesc',
    scientificContextKey: 'techPursedLipContext',
    goals: ['specialized_respiratory'],
    isBeginnerFriendly: true,
    hasBreathRetention: false,
    canDisableRetention: false,
    isSpecialized: true,
    defaultDurationMinutes: 3,
    phases: [
      {
        type: 'inhale',
        durationSeconds: 2.0,
        labelKey: 'phaseInhaleNose',
        guidanceKey: 'guidePursedLipInhale',
        targetScale: 1.3,
      },
      {
        type: 'exhale',
        durationSeconds: 4.0,
        labelKey: 'phaseExhalePursed',
        guidanceKey: 'guidePursedLipExhale',
        targetScale: 1.0,
      },
    ],
    tempoAdjustmentRange: {
      minMultiplier: 0.85,
      maxMultiplier: 1.25,
      step: 0.05,
    },
    recommendedSoundscape: 'ocean_waves',
  },
];

/**
 * Returns a breathing technique definition by ID, or undefined if not found.
 */
export function getBreathingTechnique(id: string): BreathingTechnique | undefined {
  return BREATHING_TECHNIQUES.find((tech) => tech.id === id);
}

/**
 * Filters breathing techniques by selected goal ID. Returns all if 'all'.
 */
export function getTechniquesByGoal(goalId: string): BreathingTechnique[] {
  if (!goalId || goalId === 'all') {
    return BREATHING_TECHNIQUES;
  }
  return BREATHING_TECHNIQUES.filter((tech) => tech.goals.includes(goalId as BreathingGoalId));
}
