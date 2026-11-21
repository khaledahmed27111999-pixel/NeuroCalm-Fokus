/**
 * NeuroCalm & Fokus — Respiratory Training Domain Types
 * Phase 3A: Comprehensive, extensible data model for breathing techniques,
 * pacing configurations, and live session state machines.
 */

import { SoundscapeId } from './audio';

export type BreathingTechniqueId =
  | 'diaphragmatic'
  | 'resonance_frequency'
  | 'physiological_sigh'
  | 'extended_exhale'
  | 'box_breathing'
  | '4_7_8_relax'
  | 'pursed_lip';

export type BreathingGoalId =
  | 'acute_stress'
  | 'anxiety_relief'
  | 'evening_unwind'
  | 'sleep_prep'
  | 'focus_composure'
  | 'gentle_awareness'
  | 'specialized_respiratory';

export type BreathingPhaseType =
  | 'inhale'         // Inhalation through nose
  | 'inhale_second'  // Gentle second top-off inhale (Physiological Sigh)
  | 'hold_in'        // Breath retention with full lungs
  | 'exhale'         // Exhalation through mouth or nose
  | 'hold_out'       // Pause with empty lungs
  | 'rest';          // Brief natural pause between cycles

export interface BreathingPhaseDefinition {
  type: BreathingPhaseType;
  durationSeconds: number;
  labelKey: string;     // Short phase action (e.g., 'phaseInhale')
  guidanceKey: string;  // Detailed sensory instruction (e.g., 'guideNasalInhale')
  targetScale: number;  // Visual scale multiplier (0.85 to 1.65)
}

export type RetentionMode = 'standard' | 'hold_free' | 'triangle';

export interface BreathingTechnique {
  id: BreathingTechniqueId;
  nameKey: string;
  subtitleKey: string;
  descriptionKey: string;
  scientificContextKey: string;
  goals: BreathingGoalId[];
  isBeginnerFriendly: boolean;
  hasBreathRetention: boolean;
  canDisableRetention: boolean;
  isUntimedAwarenessSupported?: boolean;
  isSpecialized?: boolean; // If true, requires explicit clinical context framing
  defaultDurationMinutes: 2 | 3 | 5 | 10;
  phases: BreathingPhaseDefinition[];
  // Strictly hold-free alternative pattern (only inhale and exhale, zero holds)
  holdFreePhases?: BreathingPhaseDefinition[];
  // Optional triangle mode pattern (e.g., 3s In, 3s Hold, 3s Exhale) - clearly noted as having hold
  trianglePhases?: BreathingPhaseDefinition[];
  tempoAdjustmentRange?: {
    minMultiplier: number;
    maxMultiplier: number;
    step: number;
  };
  recommendedSoundscape?: SoundscapeId;
}

export type BreathingCueProfile = 'chime' | 'resonant' | 'bell' | 'wood';
export type BreathingOptionalCueProfile = BreathingCueProfile | 'none';

export interface BreathingCuePreferences {
  volume: number; // 0.1 to 1.0 (default 0.5)
  inhaleProfile: BreathingCueProfile;
  exhaleProfile: BreathingCueProfile;
  holdProfile: BreathingOptionalCueProfile;
  completionProfile: BreathingOptionalCueProfile;
}

export const DEFAULT_BREATHING_CUE_PREFERENCES: BreathingCuePreferences = {
  volume: 0.5,
  inhaleProfile: 'chime',
  exhaleProfile: 'chime',
  holdProfile: 'chime',
  completionProfile: 'chime',
};

export interface BreathingSessionConfig {
  techniqueId: BreathingTechniqueId;
  durationMinutes: 2 | 3 | 5 | 10;
  tempoMultiplier: number; // 0.8 to 1.25 (default 1.0)
  retentionMode: RetentionMode; // 'standard' | 'hold_free' | 'triangle'
  isUntimedAwareness: boolean;  // For diaphragmatic: gentle unforced self-pacing
  soundscapeId: SoundscapeId | 'silent';
  instrumentalId: string | 'none'; // Reserved for Chinese instrumental music architecture
  audioCueEnabled: boolean; // Default false
  cuePreferences?: BreathingCuePreferences;
}

export interface BreathingSessionLiveState {
  status: 'idle' | 'settling' | 'running' | 'paused' | 'completed';
  techniqueId: BreathingTechniqueId;
  config: BreathingSessionConfig;
  currentPhaseIndex: number;
  currentPhase: BreathingPhaseDefinition;
  phaseProgressFraction: number; // 0.0 to 1.0
  cycleCount: number;
  totalElapsedSeconds: number;
  remainingSeconds: number;
  settlingRemainingSeconds: number; // 3..2..1 countdown
}

export interface BreathingPreferences {
  lastTechniqueId: BreathingTechniqueId;
  preferredDurationMinutes: 2 | 3 | 5 | 10;
  soundscapeId: SoundscapeId | 'silent';
  instrumentalId: string | 'none';
  audioCueEnabled: boolean;
  tempoMultiplier: number;
  cuePreferences?: BreathingCuePreferences;
}
