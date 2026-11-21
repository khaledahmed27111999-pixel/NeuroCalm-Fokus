/**
 * NeuroCalm & Fokus — Integrated Relaxation Domain Types
 * Phase 3C: Orchestrated multi-track auditory and respiratory sessions.
 */

import { SoundscapeId } from './audio';
import { BreathingTechniqueId, RetentionMode } from './breathing';

export type SessionFamilyId =
  | 'combined_soundscape'
  | 'chinese_instrumental'
  | 'nature_based'
  | 'music_only';

export type RelaxationSessionId =
  | 'session_deep_serenity'
  | 'session_quiet_stillness'
  | 'session_natures_rhythm'
  | 'session_musical_pause'
  | 'session_evening_retreat';

export type SessionDurationMinutes = 2 | 3 | 5 | 10 | 15 | 30 | 'open_ended';

export interface SessionAudioTrackConfig {
  soundId: SoundscapeId;
  defaultVolume: number; // [0.0, 1.0]
  isOptional: boolean;
  role: 'instrumental' | 'nature' | 'ambient';
}

export interface SessionBreathingConfig {
  techniqueId: BreathingTechniqueId;
  defaultUntimed: boolean;
  supportsUntimed: boolean;
  defaultRetentionMode: RetentionMode;
  tempoMultiplier: number;
  isOptional?: boolean; // For sessions where breathing is optional (e.g. Evening Retreat)
}

export interface RelaxationSessionDefinition {
  id: RelaxationSessionId;
  familyId: SessionFamilyId;
  nameKey: string;
  subtitleKey: string;
  descriptionKey: string;
  isBreathingSession: boolean;
  breathingConfig?: SessionBreathingConfig;
  audioTracks: SessionAudioTrackConfig[];
  availableDurations: SessionDurationMinutes[];
  defaultDuration: SessionDurationMinutes;
}

export type SessionConflictReason = 'duplicate_sound_id' | 'capacity_exceeded' | null;

export interface SessionConflictState {
  conflictingSession: RelaxationSessionDefinition;
  requestedDuration: SessionDurationMinutes;
  activeMixerTrackIds: SoundscapeId[];
  requestedTrackIds: SoundscapeId[];
  duplicateTrackIds: SoundscapeId[];
  isCapacityExceeded: boolean;
  canKeepPlayingAlongside: boolean;
  disableReasonKey?: string;
}

export interface ActiveSessionLiveState {
  status: 'idle' | 'conflict_check' | 'settling' | 'running' | 'paused' | 'completing' | 'completed';
  definition: RelaxationSessionDefinition | null;
  durationMinutes: SessionDurationMinutes;
  elapsedSeconds: number;
  remainingSeconds: number | null; // null if open_ended
  settlingRemainingSeconds: number; // 3..2..1 countdown
  sessionOwnedTracks: SoundscapeId[];
  preExistingMixerTracks: SoundscapeId[];
  trackVolumes: Partial<Record<SoundscapeId, number>>;
  trackMuted: Partial<Record<SoundscapeId, boolean>>;
  keepAudioOnPause: boolean;
  isUntimedAwareness: boolean;
  tempoMultiplier: number;
  isBreathingEnabled: boolean;
}

export interface RelaxationPreferences {
  lastSessionId: RelaxationSessionId;
  preferredDuration: SessionDurationMinutes;
  customTrackVolumes: Partial<Record<SoundscapeId, number>>;
  keepAudioOnPause: boolean;
}

export interface RelaxationSessionContextType {
  liveState: ActiveSessionLiveState;
  preferences: RelaxationPreferences;
  conflictState: SessionConflictState | null;
  setupSession: RelaxationSessionDefinition | null;
  startSetup: (session: RelaxationSessionDefinition) => void;
  closeSetup: () => void;
  beginSession: (
    session: RelaxationSessionDefinition,
    duration: SessionDurationMinutes,
    customVolumes?: Partial<Record<SoundscapeId, number>>,
    options?: {
      isUntimedAwareness?: boolean;
      tempoMultiplier?: number;
      isBreathingEnabled?: boolean;
      keepAudioOnPause?: boolean;
      enabledTrackIds?: SoundscapeId[];
    }
  ) => Promise<boolean>;
  resolveConflictAndBegin: (choice: 'stop_existing' | 'keep_alongside' | 'cancel') => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => Promise<void>;
  dismissCompletion: () => void;
  setSessionTrackVolume: (soundId: SoundscapeId, volume: number) => void;
  toggleSessionTrackMute: (soundId: SoundscapeId) => void;
  toggleKeepAudioOnPause: () => void;
  handleRecoverViewUnmount: () => void;
}
