/**
 * NeuroCalm & Fokus — Core Web Audio Engine Singleton
 * Manages AudioContext, Procedural Worklets, Gain Staging, and Multi-Tab Mutex.
 */

import {
  SoundscapeId,
  SoundscapeConfig,
  AudioTrackState,
  AudioEngineState,
  ProceduralNoiseId,
  SoundCategory,
} from '../types/audio';
import {
  loadAudioSettings,
  saveAudioSettings,
} from '../storage/audioStorage';
import { AudioBufferCache } from './audioCache';
import { generateProceduralNoiseBuffer } from './noiseBufferFallback';
import {
  createAudioBroadcastChannel,
  requestExclusivePlaybackLock,
  PlaybackLockAcquisitionResult,
  AudioBroadcastMessage,
} from './audioConcurrency';
import { generateId } from '../utils/id';
import {
  createBinauralBeat,
  createMonauralBeat,
  createIsochronicTone,
} from './dsp/toneGenerators';

export const MAX_SIMULTANEOUS_TRACKS = 4;
export const MAX_ACTIVE_SOURCE_NODES = 8;
export const MAX_ACTIVE_GAIN_NODES = 8;
export const MAX_GAIN_SUM_BUDGET = 0.80;
export const FADE_RAMP_DURATION_SEC = 0.20; // 200ms gentle fade
export const INACTIVITY_SUSPEND_DELAY_MS = 10000; // 10s idle shutdown

/**
 * Resolves an audio asset URL taking into account Vite's deployment BASE_URL.
 * Supports root deployments ('/') as well as subpath deployments ('/app/').
 */
export function resolveAssetUrl(category: SoundCategory, soundId: SoundscapeId): string {
  let base = '/';
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
  ) {
    base = import.meta.env.BASE_URL;
  }
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}audio/${category}/${soundId}.webm`;
}

export function getTrackRequiredSourceNodes(soundId: SoundscapeId): number {
  const config = SOUNDSCAPE_CATALOG[soundId];
  if (!config) return 1;
  if (config.category === 'binaural' || config.category === 'monaural_isochronic') {
    return 2;
  }
  return 1;
}

export function getTrackRequiredGainNodes(soundId: SoundscapeId): number {
  const config = SOUNDSCAPE_CATALOG[soundId];
  if (!config) return 1;
  if (config.category === 'binaural' || config.category === 'monaural_isochronic') {
    if (soundId.startsWith('isochronic_')) return 3;
    return 2;
  }
  return 1;
}

export const SOUNDSCAPE_CATALOG: Record<SoundscapeId, SoundscapeConfig> = {
  white_noise: {
    id: 'white_noise',
    category: 'noise',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  pink_noise: {
    id: 'pink_noise',
    category: 'noise',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  brown_noise: {
    id: 'brown_noise',
    category: 'noise',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  violet_noise: {
    id: 'violet_noise',
    category: 'noise',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  binaural_alpha: {
    id: 'binaural_alpha',
    category: 'binaural',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
    headphoneRequired: true,
    proceduralParams: { carrierFreq: 250, beatFreq: 10.0 },
  },
  binaural_theta: {
    id: 'binaural_theta',
    category: 'binaural',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
    headphoneRequired: true,
    proceduralParams: { carrierFreq: 250, beatFreq: 6.0 },
  },
  binaural_delta: {
    id: 'binaural_delta',
    category: 'binaural',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
    headphoneRequired: true,
    proceduralParams: { carrierFreq: 200, beatFreq: 2.5 },
  },
  binaural_beta: {
    id: 'binaural_beta',
    category: 'binaural',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
    headphoneRequired: true,
    proceduralParams: { carrierFreq: 300, beatFreq: 18.0 },
  },
  binaural_gamma: {
    id: 'binaural_gamma',
    category: 'binaural',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
    headphoneRequired: true,
    proceduralParams: { carrierFreq: 350, beatFreq: 40.0 },
  },
  monaural_alpha: {
    id: 'monaural_alpha',
    category: 'monaural_isochronic',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: false,
    headphoneRequired: false,
    proceduralParams: { carrierFreq: 250, beatFreq: 10.0 },
  },
  isochronic_alpha: {
    id: 'isochronic_alpha',
    category: 'monaural_isochronic',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: false,
    headphoneRequired: false,
    proceduralParams: { carrierFreq: 250, pulseRate: 10.0, modulationDepth: 1.0 },
  },
  isochronic_theta: {
    id: 'isochronic_theta',
    category: 'monaural_isochronic',
    sourceType: 'procedural',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: false,
    headphoneRequired: false,
    proceduralParams: { carrierFreq: 200, pulseRate: 6.0, modulationDepth: 1.0 },
  },
  rain: {
    id: 'rain',
    category: 'nature',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.75,
    isStereo: true,
  },
  thunder: {
    id: 'thunder',
    category: 'nature',
    sourceType: 'asset',
    maxGainCeiling: 0.15,
    defaultVolume: 0.65,
    isStereo: true,
  },
  wind: {
    id: 'wind',
    category: 'nature',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: false,
  },
  forest: {
    id: 'forest',
    category: 'nature',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.75,
    isStereo: true,
  },
  stream: {
    id: 'stream',
    category: 'nature',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  ocean_waves: {
    id: 'ocean_waves',
    category: 'nature',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  fireplace: {
    id: 'fireplace',
    category: 'environment',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: false,
  },
  cafe: {
    id: 'cafe',
    category: 'environment',
    sourceType: 'asset',
    maxGainCeiling: 0.18,
    defaultVolume: 0.65,
    isStereo: true,
  },
  library: {
    id: 'library',
    category: 'environment',
    sourceType: 'asset',
    maxGainCeiling: 0.18,
    defaultVolume: 0.65,
    isStereo: true,
  },
  fan: {
    id: 'fan',
    category: 'environment',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: false,
  },
  xiao: {
    id: 'xiao',
    category: 'instrumental',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.70,
    isStereo: true,
  },
  dizi: {
    id: 'dizi',
    category: 'instrumental',
    sourceType: 'asset',
    maxGainCeiling: 0.16,
    defaultVolume: 0.65,
    isStereo: true,
  },
  guqin: {
    id: 'guqin',
    category: 'instrumental',
    sourceType: 'asset',
    maxGainCeiling: 0.20,
    defaultVolume: 0.75,
    isStereo: true,
  },
  guzheng: {
    id: 'guzheng',
    category: 'instrumental',
    sourceType: 'asset',
    maxGainCeiling: 0.18,
    defaultVolume: 0.70,
    isStereo: true,
  },
};

interface ActiveNodeChannel {
  soundId: SoundscapeId;
  sourceNode: AudioNode;
  gainNode: GainNode;
  isStopping: boolean;
  associatedSources?: AudioScheduledSourceNode[];
  associatedGains?: GainNode[];
  associatedNodes?: AudioNode[];
}

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  private tabId: string = generateId();
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private sleepFadeGainNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private activeFadeParams: {
    startTime: number;
    startGain: number;
    endTime: number;
    targetGain: number;
  } | null = null;

  private bufferCache = new AudioBufferCache();
  private activeChannels = new Map<SoundscapeId, ActiveNodeChannel>();

  // Procedural node quarantine accounting for failed teardowns
  private quarantinedSourceCount = 0;
  private quarantinedGainCount = 0;

  private workletLoaded = false;
  private workletLoadingPromise: Promise<boolean> | null = null;

  private state: AudioEngineState;
  private listeners = new Set<(state: AudioEngineState) => void>();

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  private lockYieldResolver: (() => void) | null = null;
  private activePlaybackIntent = false;

  // Independent cancellation scopes
  private globalCancellationEpoch = 0;
  private trackGenerations = new Map<SoundscapeId, number>();
  private loadingTracks = new Set<SoundscapeId>();
  private lockAcquisitionPromise: Promise<PlaybackLockAcquisitionResult> | null = null;

  private constructor() {
    const saved = loadAudioSettings();
    this.state = {
      masterVolume: saved.masterVolume,
      isMuted: saved.isMuted,
      activeTracks: {},
      activeCount: 0,
      ownershipState: 'idle',
      conflictError: null,
    };

    // Initialize cross-tab broadcast coordination
    this.broadcastChannel = createAudioBroadcastChannel(this.handleBroadcastMessage.bind(this));

    // Handle abrupt window termination cleanly
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy();
      });
    }
  }

  /**
   * Singleton accessor with Vite HMR protection.
   */
  public static getInstance(): AudioEngine {
    if (typeof window !== 'undefined') {
      const globalAny = window as unknown as { __NEUROCALM_AUDIO_ENGINE__?: AudioEngine };
      if (globalAny.__NEUROCALM_AUDIO_ENGINE__) {
        AudioEngine.instance = globalAny.__NEUROCALM_AUDIO_ENGINE__;
        return AudioEngine.instance;
      }
    }

    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
      if (typeof window !== 'undefined') {
        const globalAny = window as unknown as { __NEUROCALM_AUDIO_ENGINE__?: AudioEngine };
        globalAny.__NEUROCALM_AUDIO_ENGINE__ = AudioEngine.instance;
      }
    }
    return AudioEngine.instance;
  }

  /**
   * Synchronously prime and prepare the AudioContext inside a user gesture handler.
   */
  public prepareContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass =
        (typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext);
      this.audioContext = new AudioContextClass();
      this.buildMasterGraph(this.audioContext);
    }

    if (this.audioContext.state === 'suspended') {
      // Synchronous resume call inside click event stack
      void this.audioContext.resume().catch(() => {
        // Handled gracefully if browser blocks
      });
    }

    this.clearInactivityTimer();
    return this.audioContext;
  }

  /**
   * Constructs the master gain -> sleep fade gain -> limiter -> destination chain.
   */
  private buildMasterGraph(ctx: AudioContext): void {
    this.masterGainNode = ctx.createGain();
    const targetGain = this.state.isMuted ? 0.0 : this.state.masterVolume;
    this.masterGainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

    this.sleepFadeGainNode = ctx.createGain();
    this.sleepFadeGainNode.gain.setValueAtTime(1.0, ctx.currentTime);

    // Supplementary brick-wall safety ceiling (threshold -1.0dB, ratio 20)
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.setValueAtTime(-1.0, ctx.currentTime);
    this.limiterNode.knee.setValueAtTime(3.0, ctx.currentTime);
    this.limiterNode.ratio.setValueAtTime(20.0, ctx.currentTime);
    this.limiterNode.attack.setValueAtTime(0.003, ctx.currentTime);
    this.limiterNode.release.setValueAtTime(0.100, ctx.currentTime);

    this.masterGainNode.connect(this.sleepFadeGainNode);
    this.sleepFadeGainNode.connect(this.limiterNode);
    this.limiterNode.connect(ctx.destination);
  }

  /**
   * Load the AudioWorklet processor module with base-path safety.
   */
  private async ensureWorkletLoaded(ctx: AudioContext): Promise<boolean> {
    if (this.workletLoaded) return true;
    if (this.workletLoadingPromise) return this.workletLoadingPromise;

    if (!ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== 'function') {
      return false;
    }

    interface ViteMetaEnv {
      env?: {
        BASE_URL?: string;
        DEV?: boolean;
      };
    }
    const meta = import.meta as unknown as ViteMetaEnv;
    const baseUrl = (meta.env?.BASE_URL || '/').replace(/\/$/, '') + '/';

    const workletUrl = `${baseUrl}worklets/noiseProcessor.js`;

    this.workletLoadingPromise = (async () => {
      try {
        await ctx.audioWorklet.addModule(workletUrl);
        this.workletLoaded = true;
        return true;
      } catch {
        // Fall back gracefully to periodic AudioBuffer generator
        return false;
      } finally {
        this.workletLoadingPromise = null;
      }
    })();

    return this.workletLoadingPromise;
  }

  public hasActivePlaybackIntent(): boolean {
    return this.activePlaybackIntent;
  }

  public getGlobalCancellationEpoch(): number {
    return this.globalCancellationEpoch;
  }

  public getTrackGeneration(soundId: SoundscapeId): number {
    return this.trackGenerations.get(soundId) || 0;
  }

  /**
   * Validates whether a playback request is still current and authorized to proceed.
   * Checks global intent, global cancellation epoch, and per-track generation token.
   */
  private isRequestValid(soundId: SoundscapeId, epoch: number, trackGen: number): boolean {
    if (!this.activePlaybackIntent) return false;
    if (this.globalCancellationEpoch !== epoch) return false;
    if (this.trackGenerations.get(soundId) !== trackGen) return false;
    return true;
  }

  /**
   * Safely stops and disconnects an unattached or orphaned AudioNode.
   */
  private cleanupOrphanNode(node: AudioNode | null): void {
    if (!node) return;
    try {
      if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
        (node as AudioScheduledSourceNode).stop();
      }
      node.disconnect();
    } catch {
      // Ignore disconnect errors on unattached nodes
    }
  }

  /**
   * Releases lock and sets inactivity timer when no tracks are actively playing or loading.
   */
  private checkInactivityAndReleaseLock(): void {
    if (this.activeChannels.size === 0 && this.loadingTracks.size === 0) {
      this.activePlaybackIntent = false;
      this.startInactivityTimer();
      this.releaseLockIfOwned();
    }
  }

  /**
   * Returns current active registered source nodes count across all channels (including quarantined).
   */
  public getActiveSourceNodeCount(): number {
    let count = this.quarantinedSourceCount;
    for (const channel of this.activeChannels.values()) {
      if (channel.associatedSources && channel.associatedSources.length > 0) {
        count += channel.associatedSources.length;
      } else {
        count += 1;
      }
    }
    return count;
  }

  /**
   * Returns current active registered gain nodes count across all channels (including quarantined).
   */
  public getActiveGainNodeCount(): number {
    let count = this.quarantinedGainCount;
    for (const channel of this.activeChannels.values()) {
      count += 1; // trackGainNode
      if (channel.associatedGains && channel.associatedGains.length > 0) {
        count += channel.associatedGains.length;
      }
    }
    return count;
  }

  /**
   * Returns current quarantined source nodes count.
   */
  public getQuarantinedSourceCount(): number {
    return this.quarantinedSourceCount;
  }

  /**
   * Returns current quarantined gain nodes count.
   */
  public getQuarantinedGainCount(): number {
    return this.quarantinedGainCount;
  }

  /**
   * Resets quarantined node counts (used on context reset / testing).
   */
  public resetQuarantine(): void {
    this.quarantinedSourceCount = 0;
    this.quarantinedGainCount = 0;
  }

  /**
   * Play an individual track with multi-tab exclusivity, same-tab multi-track support,
   * safe gain staging, and generation-safe cancellation defenses.
   */
  public async playTrack(soundId: SoundscapeId): Promise<boolean> {
    const config = SOUNDSCAPE_CATALOG[soundId];
    if (!config) return false;

    // Check maximum active track limit (counting active channels plus other currently loading tracks)
    const pendingLoadingCount = Array.from(this.loadingTracks).filter((id) => id !== soundId && !this.activeChannels.has(id)).length;
    if (this.activeChannels.size + pendingLoadingCount >= MAX_SIMULTANEOUS_TRACKS && !this.activeChannels.has(soundId)) {
      this.setState({
        conflictError: `Maximum of ${MAX_SIMULTANEOUS_TRACKS} simultaneous sounds active. Stop one to add another.`,
      });
      return false;
    }

    // Node limit safety check (per-node capacity admission)
    const reqSources = getTrackRequiredSourceNodes(soundId);
    const reqGains = getTrackRequiredGainNodes(soundId);
    if (!this.activeChannels.has(soundId)) {
      const currentSources = this.getActiveSourceNodeCount();
      const currentGains = this.getActiveGainNodeCount();
      if (
        currentSources + reqSources > MAX_ACTIVE_SOURCE_NODES ||
        currentGains + reqGains > MAX_ACTIVE_GAIN_NODES
      ) {
        this.setState({
          conflictError: `Cannot start '${soundId}': node limit reached (max ${MAX_ACTIVE_SOURCE_NODES} sources / ${MAX_ACTIVE_GAIN_NODES} gains). Stop an active sound first.`,
        });
        return false;
      }
    }

    // Set active intent synchronously
    this.activePlaybackIntent = true;

    // Capture global epoch and assign independent per-track generation token
    const capturedEpoch = this.globalCancellationEpoch;
    const capturedTrackGen = (this.trackGenerations.get(soundId) || 0) + 1;
    this.trackGenerations.set(soundId, capturedTrackGen);

    this.loadingTracks.add(soundId);

    let sourceNode: AudioNode | null = null;
    const associatedSources: AudioScheduledSourceNode[] = [];
    const associatedGains: GainNode[] = [];
    const associatedNodes: AudioNode[] = [];

    try {
      const ctx = this.prepareContext();

      // If this tab does not yet own playback, request exclusive lock (sharing inflight promise across concurrent tracks)
      if (this.state.ownershipState !== 'owned') {
        if (!this.lockAcquisitionPromise) {
          this.setState({ ownershipState: 'requesting', conflictError: null });

          this.lockAcquisitionPromise = (async () => {
            try {
              return await requestExclusivePlaybackLock(
                this.tabId,
                () => this.activePlaybackIntent,
                async () => {
                  this.setState({ ownershipState: 'owned' });
                  this.broadcastMessage({
                    type: 'PLAYBACK_STARTED',
                    tabId: this.tabId,
                    timestamp: Date.now(),
                  });
                },
                () => {
                  return new Promise<void>((resolve) => {
                    this.lockYieldResolver = resolve;
                  });
                }
              );
            } finally {
              this.lockAcquisitionPromise = null;
            }
          })();
        }

        const lockResult = await this.lockAcquisitionPromise;

        if (!lockResult.acquired) {
          if (this.isRequestValid(soundId, capturedEpoch, capturedTrackGen)) {
            if (this.activeChannels.size === 0) {
              this.activePlaybackIntent = false;
              this.setState({
                ownershipState: 'aborted',
                conflictError:
                  lockResult.reason === 'timed_out'
                    ? 'Audio is currently active in another tab.'
                    : null,
              });
            }
          }
          return false;
        }
      }

      // 1. Cancellation defense after Web Lock acquisition
      if (!this.isRequestValid(soundId, capturedEpoch, capturedTrackGen)) {
        this.checkInactivityAndReleaseLock();
        return false;
      }

      // If channel is already playing and connected, do nothing
      if (this.activeChannels.has(soundId)) {
        return true;
      }

      // Mark track as loading
      const saved = loadAudioSettings();
      const initialVol = saved.trackVolumes[soundId] ?? config.defaultVolume;
      this.setTrackState(soundId, {
        id: soundId,
        isPlaying: false,
        isLoading: true,
        volume: initialVol,
        actualGain: 0.0,
        error: null,
      });

      if (config.sourceType === 'procedural') {
        if (config.category === 'binaural') {
          const tone = createBinauralBeat(ctx, config.proceduralParams);
          sourceNode = tone.outputNode;
          associatedSources.push(...tone.sources);
          associatedGains.push(...tone.gains);
          associatedNodes.push(...tone.nodes);
          tone.start();
        } else if (config.category === 'monaural_isochronic') {
          if (soundId.startsWith('monaural_')) {
            const tone = createMonauralBeat(ctx, config.proceduralParams);
            sourceNode = tone.outputNode;
            associatedSources.push(...tone.sources);
            associatedGains.push(...tone.gains);
            associatedNodes.push(...tone.nodes);
            tone.start();
          } else {
            const tone = createIsochronicTone(ctx, config.proceduralParams);
            sourceNode = tone.outputNode;
            associatedSources.push(...tone.sources);
            associatedGains.push(...tone.gains);
            associatedNodes.push(...tone.nodes);
            tone.start();
          }
        } else {
          // Noise generators (white, pink, brown, violet)
          const workletAvailable =
            soundId !== 'violet_noise' && (await this.ensureWorkletLoaded(ctx));

          // 2. Cancellation defense after asynchronous worklet load
          if (!this.isRequestValid(soundId, capturedEpoch, capturedTrackGen)) {
            this.checkInactivityAndReleaseLock();
            return false;
          }

          if (workletAvailable && ctx.audioWorklet) {
            // Continuous infinite noise via AudioWorklet
            const workletNode = new AudioWorkletNode(ctx, 'noise-processor', {
              numberOfInputs: 0,
              numberOfOutputs: 1,
              outputChannelCount: [config.isStereo ? 2 : 1],
            });

            // Set noise type parameter (0: white, 1: pink, 2: brown)
            const typeParam = workletNode.parameters.get('noiseType');
            const typeIndex =
              soundId === 'pink_noise' ? 1 : soundId === 'brown_noise' ? 2 : 0;
            if (typeParam) {
              typeParam.setValueAtTime(typeIndex, ctx.currentTime);
            } else {
              workletNode.port.postMessage({
                type: soundId === 'pink_noise' ? 'pink' : soundId === 'brown_noise' ? 'brown' : 'white',
              });
            }
            sourceNode = workletNode;
          } else {
            // Seamless looped AudioBuffer fallback (white, pink, brown, violet)
            const buffer = generateProceduralNoiseBuffer(
              ctx,
              soundId as ProceduralNoiseId
            );

            // 3. Cancellation defense after buffer generation
            if (!this.isRequestValid(soundId, capturedEpoch, capturedTrackGen)) {
              this.checkInactivityAndReleaseLock();
              return false;
            }

            const bufferSource = ctx.createBufferSource();
            bufferSource.buffer = buffer;
            bufferSource.loop = true;
            bufferSource.start();
            sourceNode = bufferSource;
            associatedSources.push(bufferSource);
          }
        }
      } else {
        // Recorded audio asset loading (Tier 1: rain, stream, ocean_waves, fan, fireplace)
        const assetUrl = resolveAssetUrl(config.category, soundId);
        const buffer = await this.bufferCache.loadOrWait(soundId, async () => {
          const response = await fetch(assetUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch audio asset '${soundId}' from ${assetUrl} (${response.status} ${response.statusText})`
            );
          }
          const arrayBuffer = await response.arrayBuffer();
          return await ctx.decodeAudioData(arrayBuffer);
        });

        // 3. Cancellation defense after async fetch and decode
        if (!this.isRequestValid(soundId, capturedEpoch, capturedTrackGen)) {
          this.checkInactivityAndReleaseLock();
          return false;
        }

        if (!buffer) {
          throw new Error(`Failed to decode audio buffer for '${soundId}'.`);
        }

        // Pin buffer in cache so it cannot be LRU-evicted while playing
        this.bufferCache.pin(soundId);

        const bufferSource = ctx.createBufferSource();
        bufferSource.buffer = buffer;
        bufferSource.loop = true;
        bufferSource.start();
        sourceNode = bufferSource;
        associatedSources.push(bufferSource);
      }

      // 4. Final synchronous validity check immediately before connecting audible nodes
      if (!this.isRequestValid(soundId, capturedEpoch, capturedTrackGen)) {
        this.bufferCache.unpin(soundId);
        for (const s of associatedSources) {
          try { s.stop(); } catch {}
          try {
            s.disconnect();
          } catch {
            this.quarantinedSourceCount += 1;
          }
        }
        for (const g of associatedGains) {
          try {
            g.disconnect();
          } catch {
            this.quarantinedGainCount += 1;
          }
        }
        for (const n of associatedNodes) {
          try { n.disconnect(); } catch {}
        }
        this.cleanupOrphanNode(sourceNode);
        this.checkInactivityAndReleaseLock();
        return false;
      }

      // Create per-track gain node
      const trackGainNode = ctx.createGain();
      const targetGain = initialVol * config.maxGainCeiling;

      // Start at zero and ramp up smoothly to avoid clicks
      trackGainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      trackGainNode.gain.exponentialRampToValueAtTime(
        Math.max(targetGain, 0.0001),
        ctx.currentTime + FADE_RAMP_DURATION_SEC
      );

      if (!sourceNode) {
        throw new Error(`Failed to initialize source node for track '${soundId}'.`);
      }

      sourceNode.connect(trackGainNode);
      if (this.masterGainNode) {
        trackGainNode.connect(this.masterGainNode);
      }

      this.activeChannels.set(soundId, {
        soundId,
        sourceNode,
        gainNode: trackGainNode,
        isStopping: false,
        associatedSources,
        associatedGains,
        associatedNodes,
      });

      this.setTrackState(soundId, {
        id: soundId,
        isPlaying: true,
        isLoading: false,
        volume: initialVol,
        actualGain: targetGain,
        error: null,
      });

      return true;
    } catch (err: unknown) {
      // Rollback partially constructed procedural and native nodes
      for (const s of associatedSources) {
        try { s.stop(); } catch {}
        try {
          s.disconnect();
        } catch {
          this.quarantinedSourceCount += 1;
        }
      }
      for (const g of associatedGains) {
        try {
          g.disconnect();
        } catch {
          this.quarantinedGainCount += 1;
        }
      }
      for (const n of associatedNodes) {
        try { n.disconnect(); } catch {}
      }
      if (sourceNode && !associatedSources.includes(sourceNode as AudioScheduledSourceNode)) {
        try {
          this.cleanupOrphanNode(sourceNode);
        } catch {
          this.quarantinedSourceCount += 1;
        }
      }
      this.bufferCache.unpin(soundId);

      this.checkInactivityAndReleaseLock();

      const errorMsg = err instanceof Error ? err.message : 'Failed to load audio track';
      const saved = loadAudioSettings();
      const initialVol = saved.trackVolumes[soundId] ?? config.defaultVolume;
      this.setTrackState(soundId, {
        id: soundId,
        isPlaying: false,
        isLoading: false,
        volume: initialVol,
        actualGain: 0.0,
        error: errorMsg,
      });
      return false;
    } finally {
      this.loadingTracks.delete(soundId);
      // Clean up track state if request was cancelled while loading
      if (!this.activeChannels.has(soundId) && this.state.activeTracks[soundId]?.isLoading) {
        const updated = { ...this.state.activeTracks };
        delete updated[soundId];
        this.setState({ activeTracks: updated });
      }
    }
  }

  /**
   * Stop an individual track with a 200ms smooth fade-out.
   */
  public async stopTrack(soundId: SoundscapeId): Promise<void> {
    // Invalidate per-track generation immediately so any inflight request for this track aborts
    const curTrackGen = this.trackGenerations.get(soundId) || 0;
    this.trackGenerations.set(soundId, curTrackGen + 1);

    // If track is loading, remove from loading and active track states
    this.loadingTracks.delete(soundId);
    if (this.state.activeTracks[soundId]?.isLoading) {
      const updated = { ...this.state.activeTracks };
      delete updated[soundId];
      this.setState({ activeTracks: updated });
    }

    const channel = this.activeChannels.get(soundId);
    if (!channel || channel.isStopping) {
      this.checkInactivityAndReleaseLock();
      return;
    }

    channel.isStopping = true;
    const ctx = this.audioContext;

    if (ctx && channel.gainNode) {
      const currentGain = channel.gainNode.gain.value;
      channel.gainNode.gain.setValueAtTime(Math.max(currentGain, 0.0001), ctx.currentTime);
      channel.gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + FADE_RAMP_DURATION_SEC
      );
    }

    await new Promise((resolve) => setTimeout(resolve, FADE_RAMP_DURATION_SEC * 1000 + 10));

    // Cleanup all nodes safely
    if (channel.associatedSources) {
      for (const s of channel.associatedSources) {
        try { s.stop(); } catch {}
        try {
          s.disconnect();
        } catch {
          this.quarantinedSourceCount += 1;
        }
      }
    }
    if (channel.associatedGains) {
      for (const g of channel.associatedGains) {
        try {
          g.disconnect();
        } catch {
          this.quarantinedGainCount += 1;
        }
      }
    }
    if (channel.associatedNodes) {
      for (const n of channel.associatedNodes) {
        try { n.disconnect(); } catch {}
      }
    }

    try {
      if ('stop' in channel.sourceNode && typeof (channel.sourceNode as AudioScheduledSourceNode).stop === 'function') {
        (channel.sourceNode as AudioScheduledSourceNode).stop();
      }
      channel.sourceNode.disconnect();
    } catch {
      if (!channel.associatedSources || channel.associatedSources.length === 0) {
        this.quarantinedSourceCount += 1;
      }
    }

    try {
      channel.gainNode.disconnect();
    } catch {
      this.quarantinedGainCount += 1;
    }

    this.activeChannels.delete(soundId);
    this.bufferCache.unpin(soundId);

    const updatedTracks = { ...this.state.activeTracks };
    delete updatedTracks[soundId];
    this.setState({
      activeTracks: updatedTracks,
      activeCount: this.activeChannels.size,
    });

    this.checkInactivityAndReleaseLock();
  }

  /**
   * Stop all active sounds with a coordinated fade-out.
   */
  public async stopAll(): Promise<void> {
    // 1. Advance global cancellation epoch so ALL inflight requests are invalidated immediately
    this.globalCancellationEpoch++;
    this.activePlaybackIntent = false;

    // 2. Invalidate all per-track generations
    for (const id of Object.keys(SOUNDSCAPE_CATALOG) as SoundscapeId[]) {
      const cur = this.trackGenerations.get(id) || 0;
      this.trackGenerations.set(id, cur + 1);
    }

    // 3. Clear loading tracks
    this.loadingTracks.clear();

    // 4. Fade out and stop all active channels
    const soundIds = Array.from(this.activeChannels.keys());
    await Promise.all(soundIds.map((id) => this.stopTrack(id)));

    // 5. Release Web Lock
    this.releaseLockIfOwned();

    // 6. Reset sleep fade node to unity gain and cancel any pending automations
    this.resetSleepFade();
  }

  /**
   * Schedules a perceptually smooth, two-stage exponential fade-out on the dedicated sleep fade node.
   * Target endpoint: 0.0001 (-80 dBFS) at now + fadeDurationSec, followed by step to 0.0.
   * Strictly bounded to [0.0, 1.0].
   */
  public scheduleSleepFade(fadeDurationSec: number): void {
    const ctx = this.prepareContext();
    if (!this.sleepFadeGainNode) return;

    const safeFadeSec = Math.max(0.1, fadeDurationSec);
    const now = ctx.currentTime;
    const gainParam = this.sleepFadeGainNode.gain;

    // 1. Cancel previous pending automations starting from 'now'
    if (typeof (gainParam as unknown as { cancelScheduledValues?: (time: number) => void }).cancelScheduledValues === 'function') {
      gainParam.cancelScheduledValues(now);
    }

    // 2. Anchor current instantaneous gain (clamped [0.0001, 1.0])
    const currentGain = Math.min(1.0, Math.max(0.0001, gainParam.value ?? 1.0));
    gainParam.setValueAtTime(currentGain, now);

    // 3. Two-stage exponential decay: down to 0.0001 (-80dBFS), then cut to 0.0
    try {
      gainParam.exponentialRampToValueAtTime(0.0001, now + safeFadeSec);
      gainParam.setValueAtTime(0.0, now + safeFadeSec + 0.05);
    } catch {
      // Fallback for mocks/environments lacking exponentialRampToValueAtTime
      try {
        gainParam.linearRampToValueAtTime(0.0, now + safeFadeSec);
      } catch {
        gainParam.setValueAtTime(0.0, now + safeFadeSec);
      }
    }

    this.activeFadeParams = {
      startTime: now,
      startGain: currentGain,
      endTime: now + safeFadeSec,
      targetGain: 0.0001,
    };
  }

  /**
   * Cancels an active sleep fade without audible clicks, restoring gain smoothly to unity (1.0) over 500ms.
   */
  public cancelSleepFade(): void {
    if (!this.audioContext || !this.sleepFadeGainNode) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const gainParam = this.sleepFadeGainNode.gain;

    let currentGain = 1.0;

    // Attempt native cancelAndHoldAtTime
    if (typeof (gainParam as unknown as { cancelAndHoldAtTime?: (time: number) => void }).cancelAndHoldAtTime === 'function') {
      try {
        (gainParam as unknown as { cancelAndHoldAtTime: (time: number) => void }).cancelAndHoldAtTime(now);
        currentGain = Math.min(1.0, Math.max(0.0001, gainParam.value ?? 1.0));
      } catch {
        // Fallback to calculation
      }
    } else {
      // Spec-compliant mathematical fallback
      if (this.activeFadeParams) {
        const { startTime, startGain, endTime, targetGain } = this.activeFadeParams;
        if (now >= startTime && now <= endTime && endTime > startTime) {
          const progress = (now - startTime) / (endTime - startTime);
          currentGain = startGain * Math.pow(targetGain / startGain, progress);
        } else if (now > endTime) {
          currentGain = targetGain;
        } else {
          currentGain = startGain;
        }
      } else {
        currentGain = gainParam.value ?? 1.0;
      }

      currentGain = Math.min(1.0, Math.max(0.0001, currentGain));
      if (typeof (gainParam as unknown as { cancelScheduledValues?: (time: number) => void }).cancelScheduledValues === 'function') {
        gainParam.cancelScheduledValues(now);
      }
      gainParam.setValueAtTime(currentGain, now);
    }

    // Smooth recovery ramp to unity gain (1.0) over 500ms
    const RECOVERY_RAMP_SEC = 0.50;
    try {
      gainParam.linearRampToValueAtTime(1.0, now + RECOVERY_RAMP_SEC);
    } catch {
      gainParam.setValueAtTime(1.0, now);
    }

    this.activeFadeParams = null;
  }

  /**
   * Resets sleep fade gain immediately to unity (1.0) and clears pending automations.
   */
  public resetSleepFade(): void {
    this.activeFadeParams = null;
    if (!this.audioContext || !this.sleepFadeGainNode) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const gainParam = this.sleepFadeGainNode.gain;

    if (typeof (gainParam as unknown as { cancelScheduledValues?: (time: number) => void }).cancelScheduledValues === 'function') {
      gainParam.cancelScheduledValues(now);
    }
    gainParam.setValueAtTime(1.0, now);
  }

  /**
   * Returns current instantaneous sleep fade gain [0.0, 1.0].
   */
  public getSleepFadeGain(): number {
    if (!this.sleepFadeGainNode) return 1.0;
    return Math.min(1.0, Math.max(0.0, this.sleepFadeGainNode.gain.value ?? 1.0));
  }

  /**
   * Set user volume for an individual soundscape track [0.0, 1.0].
   */
  public setTrackVolume(soundId: SoundscapeId, volume: number): void {
    const clampedVol = Math.max(0.0, Math.min(volume, 1.0));
    const config = SOUNDSCAPE_CATALOG[soundId];
    if (!config) return;

    // Persist user preference
    const saved = loadAudioSettings();
    saved.trackVolumes[soundId] = clampedVol;
    saveAudioSettings(saved);

    // Update active node if playing
    const channel = this.activeChannels.get(soundId);
    const targetGain = clampedVol * config.maxGainCeiling;

    if (channel && this.audioContext) {
      const ctx = this.audioContext;
      channel.gainNode.gain.setValueAtTime(Math.max(channel.gainNode.gain.value, 0.0001), ctx.currentTime);
      channel.gainNode.gain.exponentialRampToValueAtTime(
        Math.max(targetGain, 0.0001),
        ctx.currentTime + 0.05
      );
    }

    const currentTrack = this.state.activeTracks[soundId];
    if (currentTrack) {
      this.setTrackState(soundId, {
        ...currentTrack,
        volume: clampedVol,
        actualGain: targetGain,
      });
    }
  }

  /**
   * Set master output volume [0.0, 1.0].
   */
  public setMasterVolume(volume: number): void {
    const clampedVol = Math.max(0.0, Math.min(volume, 1.0));

    const saved = loadAudioSettings();
    saved.masterVolume = clampedVol;
    saveAudioSettings(saved);

    if (this.masterGainNode && this.audioContext && !this.state.isMuted) {
      const ctx = this.audioContext;
      this.masterGainNode.gain.setValueAtTime(
        Math.max(this.masterGainNode.gain.value, 0.0001),
        ctx.currentTime
      );
      this.masterGainNode.gain.exponentialRampToValueAtTime(
        Math.max(clampedVol, 0.0001),
        ctx.currentTime + 0.05
      );
    }

    this.setState({ masterVolume: clampedVol });
  }

  /**
   * Toggle mute state. Mutes master output without losing volume preference.
   */
  public toggleMute(): void {
    const nextMuted = !this.state.isMuted;

    const saved = loadAudioSettings();
    saved.isMuted = nextMuted;
    saveAudioSettings(saved);

    if (this.masterGainNode && this.audioContext) {
      const ctx = this.audioContext;
      const target = nextMuted ? 0.0001 : Math.max(this.state.masterVolume, 0.0001);
      this.masterGainNode.gain.setValueAtTime(
        Math.max(this.masterGainNode.gain.value, 0.0001),
        ctx.currentTime
      );
      this.masterGainNode.gain.exponentialRampToValueAtTime(target, ctx.currentTime + 0.05);
    }

    this.setState({ isMuted: nextMuted });
  }

  public clearConflictError(): void {
    this.setState({ conflictError: null });
  }

  public getState(): AudioEngineState {
    return this.state;
  }

  public subscribe(listener: (state: AudioEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(partial: Partial<AudioEngineState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private setTrackState(soundId: SoundscapeId, track: AudioTrackState): void {
    const updated = {
      ...this.state.activeTracks,
      [soundId]: track,
    };
    this.setState({
      activeTracks: updated,
      activeCount: this.activeChannels.size,
    });
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      if (this.activeChannels.size === 0 && this.audioContext && this.audioContext.state === 'running') {
        void this.audioContext.suspend().catch(() => {});
      }
    }, INACTIVITY_SUSPEND_DELAY_MS);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private releaseLockIfOwned(): void {
    if (this.lockYieldResolver) {
      this.lockYieldResolver();
      this.lockYieldResolver = null;
    }
    this.setState({ ownershipState: 'idle' });
    this.broadcastMessage({
      type: 'PLAYBACK_STOPPED',
      tabId: this.tabId,
      timestamp: Date.now(),
    });
  }

  private broadcastMessage(message: AudioBroadcastMessage): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch {
        // Ignore broadcast failure
      }
    }
  }

  private handleBroadcastMessage(message: AudioBroadcastMessage): void {
    if (message.tabId === this.tabId) return;

    if (message.type === 'YIELD_PLAYBACK') {
      // Explicit force-takeover requested by another tab. Yield gracefully.
      if (this.state.ownershipState === 'owned' || this.activeChannels.size > 0) {
        void this.stopAll().then(() => {
          this.setState({
            ownershipState: 'lost',
            conflictError: 'Audio playback was taken over by another tab.',
          });
        });
      }
    } else if (message.type === 'PLAYBACK_STARTED') {
      if (this.state.ownershipState !== 'owned' && this.activeChannels.size > 0) {
        void this.stopAll();
      }
    }
  }

  /**
   * Complete destruction on page unload.
   */
  public destroy(): void {
    this.clearInactivityTimer();
    this.globalCancellationEpoch++;
    this.activePlaybackIntent = false;
    this.loadingTracks.clear();
    this.trackGenerations.clear();

    // Disconnect active channels
    for (const channel of this.activeChannels.values()) {
      if (channel.associatedSources) {
        for (const s of channel.associatedSources) {
          try { s.stop(); } catch {}
          try { s.disconnect(); } catch {}
        }
      }
      if (channel.associatedGains) {
        for (const g of channel.associatedGains) {
          try { g.disconnect(); } catch {}
        }
      }
      if (channel.associatedNodes) {
        for (const n of channel.associatedNodes) {
          try { n.disconnect(); } catch {}
        }
      }
      try {
        if ('stop' in channel.sourceNode && typeof (channel.sourceNode as AudioScheduledSourceNode).stop === 'function') {
          (channel.sourceNode as AudioScheduledSourceNode).stop();
        }
        channel.sourceNode.disconnect();
        channel.gainNode.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeChannels.clear();
    this.bufferCache.clear();
    this.quarantinedSourceCount = 0;
    this.quarantinedGainCount = 0;
    this.releaseLockIfOwned();

    if (this.masterGainNode) {
      try { this.masterGainNode.disconnect(); } catch {}
      this.masterGainNode = null;
    }
    if (this.sleepFadeGainNode) {
      try { this.sleepFadeGainNode.disconnect(); } catch {}
      this.sleepFadeGainNode = null;
    }
    if (this.limiterNode) {
      try { this.limiterNode.disconnect(); } catch {}
      this.limiterNode = null;
    }
    this.activeFadeParams = null;

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Ignore
      }
      this.broadcastChannel = null;
    }

    this.listeners.clear();
  }

  /**
   * Expose buffer cache for testing and memory diagnostics.
   */
  public getBufferCache(): AudioBufferCache {
    return this.bufferCache;
  }
}
