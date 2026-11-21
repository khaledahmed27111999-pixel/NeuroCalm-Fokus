/**
 * NeuroCalm & Fokus — Breathing Procedural Audio Cue Generator
 * Phase 3C-UI-3: Subtle, aesthetic transition chimes synthesized via the Web Audio API.
 * Disabled by default. All frequencies are purely aesthetic procedural engineering choices.
 * These are synthesized sounds, not authentic recordings of acoustic instruments.
 */

import { BreathingOptionalCueProfile } from '../types/breathing';

export type CuePhaseType = 'inhale' | 'exhale' | 'hold' | 'completion';

let cueAudioContext: AudioContext | null = null;

// Track active preview cancellation to smoothly terminate prior previews
let activePreviewNodes: Array<{ gain: GainNode; oscs: OscillatorNode[] }> = [];

/**
 * Structural amplitude bound to ensure cues remain gentle and non-startling.
 * Note: This bounds internal audio engine amplitude and does not describe
 * a guarantee of safe acoustic exposure or hearing protection.
 */
const MAX_INTERNAL_AMPLITUDE = 0.08;

function getCueContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!cueAudioContext || cueAudioContext.state === 'closed') {
    cueAudioContext = new AudioCtx();
  }

  if (cueAudioContext.state === 'suspended') {
    cueAudioContext.resume().catch(() => {});
  }

  return cueAudioContext;
}

/**
 * Clamps user volume strictly within the 10%–100% (0.1–1.0) UI range,
 * defaulting safely to 50% (0.5).
 */
export function clampCueVolume(volume?: number): number {
  if (typeof volume !== 'number' || isNaN(volume)) return 0.5;
  return Math.max(0.1, Math.min(1.0, volume));
}

/**
 * Calculates internal linear gain for a sound profile given base gain and user volume.
 * Strictly bounded by MAX_INTERNAL_AMPLITUDE.
 */
function calculateGain(baseGain: number, volume: number): number {
  const normalizedVolume = clampCueVolume(volume);
  // Scaling factor: volume 0.5 yields ~0.8x baseGain; volume 1.0 yields ~1.6x baseGain
  const targetGain = baseGain * (normalizedVolume * 1.6);
  return Math.min(MAX_INTERNAL_AMPLITUDE, Math.max(0.001, targetGain));
}

/**
 * Smoothly terminates any currently active preview sounds to prevent overlapping audio.
 */
export function stopPreview(): void {
  if (activePreviewNodes.length === 0) return;
  const ctx = getCueContext();
  const now = ctx ? ctx.currentTime : 0;

  for (const item of activePreviewNodes) {
    try {
      if (ctx) {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(item.gain.gain.value, now);
        item.gain.gain.linearRampToValueAtTime(0.0001, now + 0.015);
      }
      setTimeout(() => {
        for (const osc of item.oscs) {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        }
        try {
          item.gain.disconnect();
        } catch {}
      }, 20);
    } catch {}
  }
  activePreviewNodes = [];
}

/**
 * Internal helper to schedule an oscillator tone with smooth attack and decay envelopes,
 * automatic disconnect on end, and optional tracking for preview cancellation.
 */
function scheduleTone(
  ctx: AudioContext,
  options: {
    type?: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startTime: number;
    duration: number;
    attackDuration?: number;
    peakGain: number;
    filterCutoff?: number;
    isPreview?: boolean;
  }
): void {
  try {
    const {
      type = 'sine',
      startFreq,
      endFreq,
      startTime,
      duration,
      attackDuration = 0.03,
      peakGain,
      filterCutoff,
      isPreview = false,
    } = options;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq && endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    }

    // Envelope: initial floor -> smooth exponential attack -> smooth exponential decay
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + attackDuration);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);


    // Optional subtle low-pass filter to soften bright/triangle waveforms
    if (filterCutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterCutoff, startTime);
      osc.connect(filter);
      filter.connect(gainNode);
    } else {
      osc.connect(gainNode);
    }

    gainNode.connect(ctx.destination);

    const stopTime = startTime + duration + 0.01;
    osc.start(startTime);
    osc.stop(stopTime);

    // Reliable resource cleanup: disconnect nodes as soon as playback stops
    osc.onended = () => {
      try {
        osc.disconnect();
        gainNode.disconnect();
      } catch {}
    };

    if (isPreview) {
      activePreviewNodes.push({ gain: gainNode, oscs: [osc] });
      // Remove from preview tracker after completion
      setTimeout(() => {
        activePreviewNodes = activePreviewNodes.filter((p) => !p.oscs.includes(osc));
      }, (duration + 0.05) * 1000);
    }
  } catch {
    // Fail silently in restricted Web Audio environments
  }
}

// =========================================================================
// Profile Synthesizers
// =========================================================================

/**
 * Profile 1: Soft Chime (`chime`)
 * Preserves the original smooth sine pitch-glide character.
 */
function playChimeProfile(
  ctx: AudioContext,
  phase: CuePhaseType,
  now: number,
  volume: number,
  isPreview: boolean
): void {
  if (phase === 'inhale') {
    // Ascending pitch glide 400Hz -> 480Hz
    const gain = calculateGain(0.05, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 400,
      endFreq: 480,
      startTime: now,
      duration: 0.35,
      attackDuration: 0.05,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'exhale') {
    // Descending pitch glide 480Hz -> 400Hz
    const gain = calculateGain(0.05, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 480,
      endFreq: 400,
      startTime: now,
      duration: 0.45,
      attackDuration: 0.05,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'hold') {
    // Subtle static holding tone 350Hz
    const gain = calculateGain(0.03, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 350,
      startTime: now,
      duration: 0.12,
      attackDuration: 0.02,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'completion') {
    // Ascending two-tone gentle harmony (C5 -> E5)
    const gain1 = calculateGain(0.04, volume);
    const gain2 = calculateGain(0.045, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 523.25,
      startTime: now,
      duration: 0.25,
      attackDuration: 0.04,
      peakGain: gain1,
      isPreview,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 659.25,
      startTime: now + 0.14,
      duration: 0.45,
      attackDuration: 0.04,
      peakGain: gain2,
      isPreview,
    });
  }
}

/**
 * Profile 2: Resonant Tone (`resonant`)
 * Softer, warmer, fuller fundamental with a slightly longer, grounding decay.
 */
function playResonantProfile(
  ctx: AudioContext,
  phase: CuePhaseType,
  now: number,
  volume: number,
  isPreview: boolean
): void {
  if (phase === 'inhale') {
    // Warm mid-range E4 (329.6Hz) with smooth decay
    const gain = calculateGain(0.045, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 329.63,
      startTime: now,
      duration: 0.6,
      attackDuration: 0.03,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'exhale') {
    // Deep grounding C4 (261.6Hz) with spacious decay
    const gain = calculateGain(0.045, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 261.63,
      startTime: now,
      duration: 0.75,
      attackDuration: 0.035,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'hold') {
    // Mellow D4 (293.7Hz) centered tone
    const gain = calculateGain(0.032, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 293.66,
      startTime: now,
      duration: 0.32,
      attackDuration: 0.025,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'completion') {
    // Warm resonant harmonic fifth (C4 + G4)
    const gain = calculateGain(0.04, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 261.63,
      startTime: now,
      duration: 0.9,
      attackDuration: 0.04,
      peakGain: gain,
      isPreview,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 392.0,
      startTime: now + 0.12,
      duration: 0.9,
      attackDuration: 0.04,
      peakGain: gain,
      isPreview,
    });
  }
}

/**
 * Profile 3: Clear Bell (`bell`)
 * Restrained, clean bell-like synthesized tone without harsh high frequencies.
 */
function playBellProfile(
  ctx: AudioContext,
  phase: CuePhaseType,
  now: number,
  volume: number,
  isPreview: boolean
): void {
  // Uses gentle low-pass filtering at 2000Hz to guarantee zero harsh high-frequency sizzle
  if (phase === 'inhale') {
    // Crisp D5 (587.3Hz)
    const gain = calculateGain(0.04, volume);
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 587.33,
      startTime: now,
      duration: 0.35,
      attackDuration: 0.006,
      peakGain: gain,
      filterCutoff: 2000,
      isPreview,
    });
  } else if (phase === 'exhale') {
    // Grounding A4 (440.0Hz)
    const gain = calculateGain(0.04, volume);
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 440.0,
      startTime: now,
      duration: 0.42,
      attackDuration: 0.006,
      peakGain: gain,
      filterCutoff: 1800,
      isPreview,
    });
  } else if (phase === 'hold') {
    // Soft bell tap C5 (523.25Hz)
    const gain = calculateGain(0.028, volume);
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 523.25,
      startTime: now,
      duration: 0.15,
      attackDuration: 0.005,
      peakGain: gain,
      filterCutoff: 1900,
      isPreview,
    });
  } else if (phase === 'completion') {
    // Gentle ascending double chime C5 -> E5
    const gain = calculateGain(0.038, volume);
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 523.25,
      startTime: now,
      duration: 0.35,
      attackDuration: 0.006,
      peakGain: gain,
      filterCutoff: 2000,
      isPreview,
    });
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 659.25,
      startTime: now + 0.14,
      duration: 0.65,
      attackDuration: 0.006,
      peakGain: gain,
      filterCutoff: 2200,
      isPreview,
    });
  }
}

/**
 * Profile 4: Wood Tap (`wood`)
 * Short, muted, wood-like synthesized tap using fast downward frequency drops.
 */
function playWoodProfile(
  ctx: AudioContext,
  phase: CuePhaseType,
  now: number,
  volume: number,
  isPreview: boolean
): void {
  if (phase === 'inhale') {
    // Crisp pitch-dropped tap 320Hz -> 160Hz
    const gain = calculateGain(0.055, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 320,
      endFreq: 160,
      startTime: now,
      duration: 0.065,
      attackDuration: 0.002,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'exhale') {
    // Deeper pitch-dropped tap 220Hz -> 110Hz
    const gain = calculateGain(0.055, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 220,
      endFreq: 110,
      startTime: now,
      duration: 0.08,
      attackDuration: 0.002,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'hold') {
    // Fast subtle wood tick 260Hz -> 140Hz
    const gain = calculateGain(0.038, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 260,
      endFreq: 140,
      startTime: now,
      duration: 0.045,
      attackDuration: 0.002,
      peakGain: gain,
      isPreview,
    });
  } else if (phase === 'completion') {
    // Gentle double wood tap
    const gain1 = calculateGain(0.05, volume);
    const gain2 = calculateGain(0.055, volume);
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 220,
      endFreq: 120,
      startTime: now,
      duration: 0.06,
      attackDuration: 0.002,
      peakGain: gain1,
      isPreview,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 330,
      endFreq: 180,
      startTime: now + 0.11,
      duration: 0.07,
      attackDuration: 0.002,
      peakGain: gain2,
      isPreview,
    });
  }
}

// =========================================================================
// Public Cue Dispatchers
// =========================================================================

/**
 * Synthesizes and plays a procedural audio cue for a specific breathing phase.
 * If profile is 'none', execution is cleanly suppressed (silent).
 */
export function playPhaseCue(
  phase: CuePhaseType,
  profile: BreathingOptionalCueProfile = 'chime',
  volume = 0.5
): void {
  if (profile === 'none') return;

  try {
    const ctx = getCueContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (profile) {
      case 'resonant':
        playResonantProfile(ctx, phase, now, volume, false);
        break;
      case 'bell':
        playBellProfile(ctx, phase, now, volume, false);
        break;
      case 'wood':
        playWoodProfile(ctx, phase, now, volume, false);
        break;
      case 'chime':
      default:
        playChimeProfile(ctx, phase, now, volume, false);
        break;
    }
  } catch {
    // Fail silently in restricted Web Audio environments
  }
}

/**
 * Audition / Preview action for the setup modal.
 * Smoothly terminates any preceding preview and plays the requested cue.
 */
export function previewCue(
  phase: CuePhaseType,
  profile: BreathingOptionalCueProfile = 'chime',
  volume = 0.5
): void {
  if (profile === 'none') return;

  try {
    stopPreview();
    const ctx = getCueContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (profile) {
      case 'resonant':
        playResonantProfile(ctx, phase, now, volume, true);
        break;
      case 'bell':
        playBellProfile(ctx, phase, now, volume, true);
        break;
      case 'wood':
        playWoodProfile(ctx, phase, now, volume, true);
        break;
      case 'chime':
      default:
        playChimeProfile(ctx, phase, now, volume, true);
        break;
    }
  } catch {
    // Fail silently
  }
}

// =========================================================================
// Drop-in Backwards Compatibility Wrappers
// =========================================================================

export function playInhaleCue(): void {
  playPhaseCue('inhale', 'chime', 0.5);
}

export function playExhaleCue(): void {
  playPhaseCue('exhale', 'chime', 0.5);
}

export function playHoldCue(): void {
  playPhaseCue('hold', 'chime', 0.5);
}

export function playCompletionCue(
  profile: BreathingOptionalCueProfile = 'chime',
  volume = 0.5
): void {
  playPhaseCue('completion', profile, volume);
}
