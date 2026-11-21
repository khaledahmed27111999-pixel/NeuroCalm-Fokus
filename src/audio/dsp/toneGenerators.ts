/**
 * NeuroCalm & Fokus — Procedural Tone Generators
 * Binaural Beats, Monaural Beats, and Isochronic Tones.
 * Implemented using native Web Audio API nodes with bounded envelopes.
 */

export interface ProceduralToneMetadata {
  carrierFreq: number;
  beatOrPulseFreq: number;
  isStereo: boolean;
  headphoneRequired: boolean;
  modulationDepth?: number;
  [key: string]: unknown;
}

export interface ProceduralToneHandle {
  readonly outputNode: AudioNode;
  readonly sources: AudioScheduledSourceNode[];
  readonly gains: GainNode[];
  readonly nodes: AudioNode[];
  readonly metadata: ProceduralToneMetadata;
  start(when?: number): void;
  stop(when?: number): void;
  disconnect(): void;
}

export interface BinauralBeatOptions {
  carrierFreq?: number; // default 250 Hz, valid [50, 1000]
  beatFreq?: number;    // default 10.0 Hz, valid [0.5, 50]
}

export interface MonauralBeatOptions {
  carrierFreq?: number; // default 250 Hz, valid [50, 1000]
  beatFreq?: number;    // default 10.0 Hz, valid [0.5, 50]
}

export interface IsochronicToneOptions {
  carrierFreq?: number;     // default 250 Hz, valid [50, 1000]
  pulseRate?: number;       // default 10.0 Hz, valid [0.5, 50]
  modulationDepth?: number; // default 1.0, valid [0.0, 1.0]
}

/**
 * Validates frequency arguments defensively.
 */
function validateNumericRange(
  val: unknown,
  paramName: string,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (val === undefined || val === null) {
    return defaultValue;
  }
  if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
    throw new Error(`Invalid parameter '${paramName}': must be a finite number.`);
  }
  if (val < min || val > max) {
    throw new Error(
      `Parameter '${paramName}' (${val}) out of bounds: must be between ${min} and ${max}.`
    );
  }
  return val;
}

/**
 * Generates a dichotic Binaural Beat.
 * Left ear: carrier - beat/2
 * Right ear: carrier + beat/2
 * Output bounded to <= 0.7071 <= 0.7500 per channel.
 */
export function createBinauralBeat(
  ctx: AudioContext,
  options: BinauralBeatOptions = {}
): ProceduralToneHandle {
  const carrierFreq = validateNumericRange(options.carrierFreq, 'carrierFreq', 50, 1000, 250);
  const beatFreq = validateNumericRange(options.beatFreq, 'beatFreq', 0.5, 50, 10.0);

  const fL = carrierFreq - beatFreq / 2;
  const fR = carrierFreq + beatFreq / 2;

  const now = ctx.currentTime;

  const oscL = ctx.createOscillator();
  oscL.type = 'sine';
  oscL.frequency.value = fL;
  oscL.frequency.setValueAtTime(fL, now);

  const oscR = ctx.createOscillator();
  oscR.type = 'sine';
  oscR.frequency.value = fR;
  oscR.frequency.setValueAtTime(fR, now);

  const merger = ctx.createChannelMerger(2);
  oscL.connect(merger, 0, 0); // Input 0 -> Left channel
  oscR.connect(merger, 0, 1); // Input 1 -> Right channel

  // Linear scaling gain to ensure strict peak bound <= 0.7071 (-3 dBFS) <= 0.7500
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.7071;
  toneGain.gain.setValueAtTime(0.7071, now);
  merger.connect(toneGain);

  const sources: AudioScheduledSourceNode[] = [oscL, oscR];
  const gains: GainNode[] = [toneGain];
  const nodes: AudioNode[] = [merger];

  return {
    outputNode: toneGain,
    sources,
    gains,
    nodes,
    metadata: {
      carrierFreq,
      beatOrPulseFreq: beatFreq,
      fL,
      fR,
      isStereo: true,
      headphoneRequired: true,
    },
    start(when = ctx.currentTime) {
      for (const s of sources) {
        s.start(when);
      }
    },
    stop(when = ctx.currentTime) {
      for (const s of sources) {
        try {
          s.stop(when);
        } catch {}
      }
    },
    disconnect() {
      for (const s of sources) {
        try {
          s.disconnect();
        } catch {}
      }
      for (const g of gains) {
        try {
          g.disconnect();
        } catch {}
      }
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {}
      }
    },
  };
}

/**
 * Generates a Monaural Beat (physical acoustic interference in the same channel).
 * Output bounded to (1.0 + 1.0) * 0.3535 = 0.7070 <= 0.7500.
 */
export function createMonauralBeat(
  ctx: AudioContext,
  options: MonauralBeatOptions = {}
): ProceduralToneHandle {
  const carrierFreq = validateNumericRange(options.carrierFreq, 'carrierFreq', 50, 1000, 250);
  const beatFreq = validateNumericRange(options.beatFreq, 'beatFreq', 0.5, 50, 10.0);

  const f1 = carrierFreq - beatFreq / 2;
  const f2 = carrierFreq + beatFreq / 2;

  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = f1;
  osc1.frequency.setValueAtTime(f1, now);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = f2;
  osc2.frequency.setValueAtTime(f2, now);

  const summingGain = ctx.createGain();
  summingGain.gain.value = 0.3535;
  summingGain.gain.setValueAtTime(0.3535, now);

  osc1.connect(summingGain);
  osc2.connect(summingGain);

  const sources: AudioScheduledSourceNode[] = [osc1, osc2];
  const gains: GainNode[] = [summingGain];
  const nodes: AudioNode[] = [];

  return {
    outputNode: summingGain,
    sources,
    gains,
    nodes,
    metadata: {
      carrierFreq,
      beatOrPulseFreq: beatFreq,
      f1,
      f2,
      isStereo: false,
      headphoneRequired: false,
    },
    start(when = ctx.currentTime) {
      for (const s of sources) {
        s.start(when);
      }
    },
    stop(when = ctx.currentTime) {
      for (const s of sources) {
        try {
          s.stop(when);
        } catch {}
      }
    },
    disconnect() {
      for (const s of sources) {
        try {
          s.disconnect();
        } catch {}
      }
      for (const g of gains) {
        try {
          g.disconnect();
        } catch {}
      }
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {}
      }
    },
  };
}

/**
 * Generates an Isochronic Tone with smooth raised-cosine (Hann/Tukey) modulation.
 * Avoids abrupt rectangular gating clicks.
 * Output bounded to <= 0.7071 <= 0.7500.
 */
export function createIsochronicTone(
  ctx: AudioContext,
  options: IsochronicToneOptions = {}
): ProceduralToneHandle {
  const carrierFreq = validateNumericRange(options.carrierFreq, 'carrierFreq', 50, 1000, 250);
  const pulseRate = validateNumericRange(options.pulseRate, 'pulseRate', 0.5, 50, 10.0);
  const modulationDepth = validateNumericRange(
    options.modulationDepth,
    'modulationDepth',
    0.0,
    1.0,
    1.0
  );

  const now = ctx.currentTime;

  // Carrier oscillator
  const carrierOsc = ctx.createOscillator();
  carrierOsc.type = 'sine';
  carrierOsc.frequency.value = carrierFreq;
  carrierOsc.frequency.setValueAtTime(carrierFreq, now);

  // Modulator LFO oscillator
  const modOsc = ctx.createOscillator();
  modOsc.type = 'sine';
  modOsc.frequency.value = pulseRate;
  modOsc.frequency.setValueAtTime(pulseRate, now);

  // Audio-rate modulation network:
  // gain(t) = Base + Mod * sin(2*pi*f_p*t)
  // When depth = 1.0: Base = 0.35355, Mod = 0.35355 => gain in [0.0, 0.7071]
  const maxAmp = 0.7071;
  const modAmp = maxAmp * (modulationDepth / 2);
  const baseAmp = maxAmp * (1 - modulationDepth / 2);

  const modGain = ctx.createGain();
  modGain.gain.value = baseAmp;
  modGain.gain.setValueAtTime(baseAmp, now);

  const depthGain = ctx.createGain();
  depthGain.gain.value = modAmp;
  depthGain.gain.setValueAtTime(modAmp, now);

  // Connect LFO into modGain.gain parameter (audio-rate AM)
  modOsc.connect(depthGain);
  depthGain.connect(modGain.gain);

  // Connect carrier through the modulated gain node
  carrierOsc.connect(modGain);

  const sources: AudioScheduledSourceNode[] = [carrierOsc, modOsc];
  const gains: GainNode[] = [modGain, depthGain];
  const nodes: AudioNode[] = [];

  return {
    outputNode: modGain,
    sources,
    gains,
    nodes,
    metadata: {
      carrierFreq,
      beatOrPulseFreq: pulseRate,
      modulationDepth,
      isStereo: false,
      headphoneRequired: false,
    },
    start(when = ctx.currentTime) {
      for (const s of sources) {
        s.start(when);
      }
    },
    stop(when = ctx.currentTime) {
      for (const s of sources) {
        try {
          s.stop(when);
        } catch {}
      }
    },
    disconnect() {
      for (const s of sources) {
        try {
          s.disconnect();
        } catch {}
      }
      for (const g of gains) {
        try {
          g.disconnect();
        } catch {}
      }
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {}
      }
    },
  };
}
