/**
 * NeuroCalm & Fokus — Audio Domain Types & Interfaces
 * Phase 2D-1: Core Audio Engine Foundation
 */

export type ProceduralNoiseId = 'white_noise' | 'pink_noise' | 'brown_noise' | 'violet_noise';

export type BinauralBeatId =
  | 'binaural_delta'
  | 'binaural_theta'
  | 'binaural_alpha'
  | 'binaural_beta'
  | 'binaural_gamma';

export type MonauralBeatId = 'monaural_alpha';

export type IsochronicToneId = 'isochronic_alpha' | 'isochronic_theta';

export type ProceduralToneId = BinauralBeatId | MonauralBeatId | IsochronicToneId;

export type NatureSoundId = 'rain' | 'thunder' | 'wind' | 'forest' | 'stream' | 'ocean_waves';

export type EnvironmentSoundId = 'fireplace' | 'cafe' | 'library' | 'fan';

export type InstrumentalSoundId = 'xiao' | 'dizi' | 'guqin' | 'guzheng';

export type SoundscapeId =
  | ProceduralNoiseId
  | NatureSoundId
  | EnvironmentSoundId
  | ProceduralToneId
  | InstrumentalSoundId;

export type SoundCategory =
  | 'noise'
  | 'nature'
  | 'environment'
  | 'binaural'
  | 'monaural_isochronic'
  | 'instrumental';

export interface SoundscapeProceduralParams {
  carrierFreq?: number;
  beatFreq?: number;
  pulseRate?: number;
  modulationDepth?: number;
}

export interface SoundscapeConfig {
  id: SoundscapeId;
  category: SoundCategory;
  sourceType: 'procedural' | 'asset';
  maxGainCeiling: number; // Maximum linear gain allowed (sum of any 4 <= 0.80)
  defaultVolume: number; // Default user volume 0.0 to 1.0
  isStereo: boolean;
  headphoneRequired?: boolean;
  proceduralParams?: SoundscapeProceduralParams;
}

export interface AudioTrackState {
  id: SoundscapeId;
  isPlaying: boolean;
  volume: number; // User volume slider [0.0, 1.0]
  actualGain: number; // Computed linear gain (volume * maxGainCeiling)
  isLoading: boolean;
  error: string | null;
}

export type PlaybackOwnershipState = 'idle' | 'requesting' | 'owned' | 'lost' | 'aborted';

export interface AudioEngineState {
  masterVolume: number; // Master fader [0.0, 1.0]
  isMuted: boolean;
  activeTracks: Partial<Record<SoundscapeId, AudioTrackState>>;
  activeCount: number;
  ownershipState: PlaybackOwnershipState;
  conflictError: string | null;
}

export interface AudioSettingsPayload {
  masterVolume: number;
  isMuted: boolean;
  trackVolumes: Partial<Record<SoundscapeId, number>>;
}

export interface AudioContextType {
  state: AudioEngineState;
  playTrack: (id: SoundscapeId) => Promise<boolean>;
  stopTrack: (id: SoundscapeId) => Promise<void>;
  setTrackVolume: (id: SoundscapeId, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  toggleMute: () => void;
  stopAll: () => Promise<void>;
  clearConflictError: () => void;
  scheduleSleepFade: (fadeDurationSec: number) => void;
  cancelSleepFade: () => void;
  resetSleepFade: () => void;
  getSleepFadeGain: () => number;
}

export interface SoundscapePresetTrack {
  soundId: SoundscapeId;
  volume: number; // [0.0, 1.0]
}

export interface SoundscapePreset {
  id: string;
  nameKey?: string;
  name?: string;
  isBuiltIn?: boolean;
  tracks: SoundscapePresetTrack[];
}

export interface AudioAttribution {
  id: string;
  name: string;
  category: string;
  filename: string;
  title: string;
  creator: string;
  license: string;
  licenseType: string;
  sourceUrl: string;
  rawSha256: string;
  processedSha256: string;
  fileSizeBytes: number;
  durationSec: number;
  description: string;
}

