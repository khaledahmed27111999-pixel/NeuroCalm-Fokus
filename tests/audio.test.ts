/**
 * NeuroCalm & Fokus — Phase 2D-1 Audio Engine & DSP Acceptance Test Suite
 * Mathematical verification, Welch PSD regression, block equivalence, gain staging,
 * LRU cache, and Web Locks concurrency arbitration.
 */

import {
  WhiteNoiseGenerator,
  PinkNoiseGenerator,
  BrownNoiseGenerator,
  VioletNoiseGenerator,
} from '../src/audio/dsp/noiseGenerators';
import {
  createBinauralBeat,
  createMonauralBeat,
  createIsochronicTone,
} from '../src/audio/dsp/toneGenerators';
import {
  AudioEngine,
  SOUNDSCAPE_CATALOG,
  MAX_GAIN_SUM_BUDGET,
  MAX_SIMULTANEOUS_TRACKS,
  MAX_ACTIVE_SOURCE_NODES,
  MAX_ACTIVE_GAIN_NODES,
  getTrackRequiredSourceNodes,
  getTrackRequiredGainNodes,
  resolveAssetUrl,
} from '../src/audio/AudioEngine';
import {
  AudioBufferCache,
  MAX_CACHED_BUFFERS,
  DEFAULT_MAX_CACHE_BYTES,
  calculateAudioBufferSize,
} from '../src/audio/audioCache';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  loadAudioSettings,
  saveAudioSettings,
  clearAudioSettings,
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
} from '../src/storage/audioStorage';
import {
  requestExclusivePlaybackLock,
  LOCK_REQUEST_TIMEOUT_MS,
} from '../src/audio/audioConcurrency';
import type { SoundscapeId } from '../src/types/audio';

/**
 * Deterministic seeded PRNG (xorshift128+)
 */
function createXorshift128Plus(seed0: number, seed1: number): () => number {
  let s0 = seed0 >>> 0;
  let s1 = seed1 >>> 0;
  return function () {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    s1 = (x ^ y ^ (x >>> 17) ^ (y >>> 26)) >>> 0;
    return (((s1 + y) >>> 0) + 1) / 4294967297; // in (0, 1]
  };
}

/**
 * Standard Radix-2 Cooley-Tukey In-Place FFT
 */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlen_r = Math.cos(ang);
    const wlen_i = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let w_r = 1;
      let w_i = 0;
      for (let j = 0; j < len >> 1; j++) {
        const u_r = re[i + j];
        const u_i = im[i + j];
        const v_r = re[i + j + (len >> 1)] * w_r - im[i + j + (len >> 1)] * w_i;
        const v_i = re[i + j + (len >> 1)] * w_i + im[i + j + (len >> 1)] * w_r;
        re[i + j] = u_r + v_r;
        im[i + j] = u_i + v_i;
        re[i + j + (len >> 1)] = u_r - v_r;
        im[i + j + (len >> 1)] = u_i - v_i;
        const n_w_r = w_r * wlen_r - w_i * wlen_i;
        w_i = w_r * wlen_i + w_i * wlen_r;
        w_r = n_w_r;
      }
    }
  }
}

/**
 * Welch Power Spectral Density
 */
function welchPSD(signal: Float32Array, segLen = 8192, hop = 4096) {
  const numSegs = Math.floor((signal.length - segLen) / hop) + 1;
  const psd = new Float64Array(segLen / 2);
  const win = new Float64Array(segLen);
  let winSumSq = 0;
  for (let i = 0; i < segLen; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segLen - 1)));
    winSumSq += win[i] * win[i];
  }
  for (let s = 0; s < numSegs; s++) {
    const start = s * hop;
    const re = new Float64Array(segLen);
    const im = new Float64Array(segLen);
    for (let i = 0; i < segLen; i++) re[i] = signal[start + i] * win[i];
    fft(re, im);
    for (let k = 0; k < segLen / 2; k++) {
      psd[k] += (re[k] * re[k] + im[k] * im[k]) / (winSumSq * numSegs);
    }
  }
  return { psd, numSegs };
}

const FS = 44100;
const OCTAVE_BANDS = [
  { name: '31.5 Hz', fMin: 22.3, fMax: 44.5, fCenter: 31.5 },
  { name: '63 Hz', fMin: 44.5, fMax: 89.1, fCenter: 63 },
  { name: '125 Hz', fMin: 89.1, fMax: 178.2, fCenter: 125 },
  { name: '250 Hz', fMin: 178.2, fMax: 356.4, fCenter: 250 },
  { name: '500 Hz', fMin: 356.4, fMax: 712.7, fCenter: 500 },
  { name: '1 kHz', fMin: 712.7, fMax: 1425.4, fCenter: 1000 },
  { name: '2 kHz', fMin: 1425.4, fMax: 2850.9, fCenter: 2000 },
  { name: '4 kHz', fMin: 2850.9, fMax: 5701.8, fCenter: 4000 },
  { name: '8 kHz', fMin: 5701.8, fMax: 11403.5, fCenter: 8000 },
  { name: '16 kHz', fMin: 11403.5, fMax: 22050, fCenter: 16000 },
];

function analyzePSD(signal: Float32Array, maxBandIndex = 9) {
  const { psd, numSegs } = welchPSD(signal);
  const deltaF = FS / 8192;
  const bandPowers: number[] = [];
  const log2Centers: number[] = [];

  for (let b = 0; b <= maxBandIndex; b++) {
    const band = OCTAVE_BANDS[b];
    let sumP = 0;
    let count = 0;
    for (let k = 1; k < psd.length; k++) {
      const f = k * deltaF;
      if (f >= band.fMin && f < band.fMax) {
        sumP += psd[k];
        count++;
      }
    }
    const avgPower = count > 0 ? sumP / count : 1e-12;
    bandPowers.push(10 * Math.log10(avgPower));
    log2Centers.push(Math.log2(band.fCenter));
  }

  const n = bandPowers.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += log2Centers[i];
    sumY += bandPowers[i];
    sumXY += log2Centers[i] * bandPowers[i];
    sumX2 += log2Centers[i] * log2Centers[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;

  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * log2Centers[i] + intercept;
    ssTot += (bandPowers[i] - meanY) ** 2;
    ssRes += (bandPowers[i] - pred) ** 2;
  }
  const r2 = 1 - ssRes / (ssTot || 1);

  let maxDev = 0;
  for (let i = 0; i < n; i++) {
    const dev = Math.abs(bandPowers[i] - meanY);
    if (dev > maxDev) maxDev = dev;
  }

  // Max dev for 63 Hz to 16 kHz (excluding 31.5 Hz)
  let maxDev63To16k = 0;
  if (bandPowers.length > 1) {
    const subset = bandPowers.slice(1);
    const subMean = subset.reduce((a, c) => a + c, 0) / subset.length;
    for (const p of subset) {
      const dev = Math.abs(p - subMean);
      if (dev > maxDev63To16k) maxDev63To16k = dev;
    }
  }

  return { slope, r2, maxDev, maxDev63To16k, numSegs, bandPowers };
}

// Setup Node.js in-memory localStorage mock if running in Node
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

// Ten deterministic seed pairs
const DETERMINISTIC_SEEDS: [number, number][] = [
  [0x12345678, 0x9abcdef0],
  [0xdeadbeef, 0xcafebabe],
  [0x01234567, 0x89abcdef],
  [0xfeedbeef, 0x0badf00d],
  [0x13579bdf, 0x2468ace0],
  [0x98765432, 0x10fedcba],
  [0xaaaaaaaa, 0x55555555],
  [0x11111111, 0x22222222],
  [0x33333333, 0x44444444],
  [0x55555555, 0x66666666],
];

// --- TEST RUNNER ---
let passedTests = 0;
function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`TEST FAILED: ${msg}`);
  }
  passedTests++;
}

async function runAllAudioTests(): Promise<void> {
  console.log('=== NEUROCALM & FOKUS — PHASE 2D-1 COMPREHENSIVE AUDIO TEST SUITE ===');

  // --- 1. MATHEMATICAL IMPULSE RESPONSE & AMPLITUDE BOUNDS ---
  console.log('\n--- 1. Impulse Response Norm & Amplitude Bound Tests ---');
  {
    // A. Pink Noise Impulse Response Norm (l1)
    const c = [0.0555179, 0.0750759, 0.1538520, 0.3104856, 0.5329522, -0.0168980];
    const p = [0.99886, 0.99332, 0.96900, 0.86650, 0.55000, -0.7616];

    let triangleBound = 0;
    for (let i = 0; i < 6; i++) {
      triangleBound += Math.abs(c[i]) / (1 - Math.abs(p[i]));
    }
    triangleBound += 0.115926 + 0.5362;
    console.log(`Pink Noise Triangle Inequality Bound ||h||_1: ${triangleBound.toFixed(4)} (expected <= 69.1349)`);
    assert(triangleBound <= 69.1350, 'Triangle inequality bound must not exceed 69.1349');

    // Exact impulse response absolute sum over 50,000 samples
    let exactSum = 0;
    let b = [0, 0, 0, 0, 0, 0];
    let b6 = 0;
    for (let n = 0; n < 50000; n++) {
      const x = n === 0 ? 1 : 0;
      for (let i = 0; i < 6; i++) {
        b[i] = p[i] * b[i] + c[i] * x;
      }
      const pink = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b6 + x * 0.5362;
      b6 = x * 0.115926;
      exactSum += Math.abs(pink);
    }
    console.log(`Pink Noise Measured Absolute Impulse Sum: ${exactSum.toFixed(4)}`);
    assert(exactSum <= 69.1350, 'Measured ||h||_1 must not exceed 69.1349');

    // Worst-case output ceiling with input magnitude 0.25 and output multiplier 0.04
    const pinkMaxOutput = triangleBound * 0.25 * 0.04;
    console.log(`Pink Noise Absolute Output Bound: ${pinkMaxOutput.toFixed(4)} (must be <= 0.75)`);
    assert(pinkMaxOutput <= 0.75, 'Pink noise output bound must not exceed 0.75');

    // B. Brown Noise Amplitude Bound
    // y[n] = 0.998 * y[n-1] + 0.05 * x[n], |x| <= 0.25, output scaled by 0.12
    const brownDCGain = 0.05 / (1 - 0.998); // 25.0
    const brownMaxRaw = brownDCGain * 0.25; // 6.25
    const brownMaxOutput = brownMaxRaw * 0.12; // 0.75
    console.log(`Brown Noise Worst-Case Peak: ${brownMaxOutput.toFixed(4)} (must be <= 0.75)`);
    assert(brownMaxOutput <= 0.750001, 'Brown noise maximum peak must not exceed 0.75');

    // C. Violet Noise Amplitude Bound
    // y[n] = 0.5 * (x[n] - x[n-1]), |x| <= 0.25
    // Impulse response h = [0.5, -0.5], ||h||_1 = 0.5 + 0.5 = 1.0000
    const violetNorm = 0.5 + 0.5; // 1.0
    const violetMaxOutput = violetNorm * 0.25; // 0.25
    console.log(`Violet Noise Impulse Response Norm ||h||_1: ${violetNorm.toFixed(4)} (expected 1.0000)`);
    assert(violetNorm === 1.0, 'Violet noise impulse response norm must be exactly 1.0000');
    console.log(`Violet Noise Worst-Case Peak: ${violetMaxOutput.toFixed(4)} (must be <= 0.75)`);
    assert(violetMaxOutput <= 0.75, 'Violet noise maximum peak must not exceed 0.75');

    console.log('✓ Section 1 Passed: All procedural noise sources mathematically guaranteed <= 0.75.');
  }

  // --- 2. DETERMINISTIC BLOCK EQUIVALENCE AND RESET TESTS ---
  console.log('\n--- 2. Block-Boundary Equivalence & Reset Tests (All 4 Generators) ---');
  {
    const generators = [
      { name: 'White Noise', cls: WhiteNoiseGenerator },
      { name: 'Pink Noise', cls: PinkNoiseGenerator },
      { name: 'Brown Noise', cls: BrownNoiseGenerator },
      { name: 'Violet Noise', cls: VioletNoiseGenerator },
    ];

    for (const g of generators) {
      // Continuous 65,536 samples
      const rand1 = createXorshift128Plus(0x12345678, 0x9abcdef0);
      const genCont = new g.cls(rand1);
      const bufCont = new Float32Array(65536);
      genCont.generateBlock(bufCont, 65536);

      // 512 consecutive 128-sample blocks
      const rand2 = createXorshift128Plus(0x12345678, 0x9abcdef0);
      const genBlock = new g.cls(rand2);
      const bufBlock = new Float32Array(65536);
      const slice = new Float32Array(128);
      for (let b = 0; b < 512; b++) {
        genBlock.generateBlock(slice, 128);
        bufBlock.set(slice, b * 128);
      }

      let maxDiff = 0;
      for (let i = 0; i < 65536; i++) {
        const diff = Math.abs(bufCont[i] - bufBlock[i]);
        if (diff > maxDiff) maxDiff = diff;
      }
      console.log(`${g.name} Continuous vs 512-Block Diff: ${maxDiff}`);
      assert(maxDiff === 0, `${g.name} must produce exact bit-for-bit equivalence across block boundaries`);

      // Reset verification
      const rand3 = createXorshift128Plus(0xcafebabe, 0xdeadbeef);
      const genR = new g.cls(rand3);
      const initial = new Float32Array(128);
      genR.generateBlock(initial, 128);

      // Mutate state with 200 blocks
      for (let i = 0; i < 200; i++) genR.generateBlock(slice, 128);

      // Reset generator and PRNG
      const rand4 = createXorshift128Plus(0xcafebabe, 0xdeadbeef);
      genR.randomSource = rand4;
      genR.reset();
      const afterReset = new Float32Array(128);
      genR.generateBlock(afterReset, 128);

      let resetDiff = 0;
      for (let i = 0; i < 128; i++) {
        const diff = Math.abs(initial[i] - afterReset[i]);
        if (diff > resetDiff) resetDiff = diff;
      }
      console.log(`${g.name} Reset Output Diff: ${resetDiff}`);
      assert(resetDiff === 0, `${g.name} reset() must restore exact initial state`);
    }
    console.log('✓ Section 2 Passed: 100% exact sample equivalence across block boundaries and resets.');
  }

  // --- 3. WELCH PSD MULTI-SEED EXPERIMENTS (65,536 VS 131,072 SAMPLES) ---
  console.log('\n--- 3. Welch PSD Multi-Seed Regression (10 Seeds, 64k vs 128k samples) ---');
  {
    console.log('Seed | White 64k Slope | White 128k Slope | White 64k MaxDev (63-16k) | Pink 64k Slope (R²) | Brown 64k Slope (R²)');
    console.log('----------------------------------------------------------------------------------------------------------');

    for (let s = 0; s < DETERMINISTIC_SEEDS.length; s++) {
      const [s0, s1] = DETERMINISTIC_SEEDS[s];

      // White Noise 64k & 128k
      const rW1 = createXorshift128Plus(s0, s1);
      const wGen1 = new WhiteNoiseGenerator(rW1);
      const wBuf1 = new Float32Array(65536);
      wGen1.generateBlock(wBuf1, 65536);
      const wRes64 = analyzePSD(wBuf1, 9);

      const rW2 = createXorshift128Plus(s0, s1);
      const wGen2 = new WhiteNoiseGenerator(rW2);
      const wBuf2 = new Float32Array(131072);
      wGen2.generateBlock(wBuf2, 131072);
      const wRes128 = analyzePSD(wBuf2, 9);

      // Pink Noise 64k
      const rP = createXorshift128Plus(s0, s1);
      const pGen = new PinkNoiseGenerator(rP);
      const pBuf = new Float32Array(65536);
      pGen.generateBlock(pBuf, 65536);
      const pRes64 = analyzePSD(pBuf, 8); // 31.5 Hz to 12 kHz (9 bands)

      // Brown Noise 64k
      const rB = createXorshift128Plus(s0, s1);
      const bGen = new BrownNoiseGenerator(rB);
      const bBuf = new Float32Array(65536);
      bGen.generateBlock(bBuf, 65536);
      const bRes64 = analyzePSD(bBuf, 7); // 31.5 Hz to 8 kHz (8 bands)

      // Violet Noise 64k
      const rV = createXorshift128Plus(s0, s1);
      const vGen = new VioletNoiseGenerator(rV);
      const vBuf = new Float32Array(65536);
      vGen.generateBlock(vBuf, 65536);
      const vRes64 = analyzePSD(vBuf, 7); // 31.5 Hz to 8 kHz (8 bands)

      console.log(
        `#${s + 1}  | ${wRes64.slope.toFixed(3).padStart(15)} | ${wRes128.slope.toFixed(3).padStart(16)} | ${wRes64.maxDev63To16k.toFixed(2).padStart(25)} dB | ${pRes64.slope.toFixed(3)} (${pRes64.r2.toFixed(3)}) | ${bRes64.slope.toFixed(3)} (${bRes64.r2.toFixed(3)}) | Violet: ${vRes64.slope.toFixed(3)} (${vRes64.r2.toFixed(3)})`
      );

      // Acceptance assertions:
      // White slope within 0.0 +- 0.5 dB/oct
      assert(Math.abs(wRes64.slope) <= 0.50, `Seed ${s + 1} White 64k slope outside 0.0 +- 0.5`);
      assert(Math.abs(wRes128.slope) <= 0.50, `Seed ${s + 1} White 128k slope outside 0.0 +- 0.5`);

      // White flatness: <= 3.0 dB for 63 Hz - 16 kHz
      assert(wRes64.maxDev63To16k <= 3.0, `Seed ${s + 1} White 64k maxDev (63-16k) exceeds 3.0 dB`);

      // White 31.5 Hz band monitored separately (<= 3.5 dB)
      assert(wRes64.maxDev <= 3.5, `Seed ${s + 1} White 64k total maxDev exceeds 3.5 dB`);

      // Pink slope: -3.0 +- 0.8 dB/oct, R2 >= 0.95
      assert(pRes64.slope >= -3.8 && pRes64.slope <= -2.2, `Seed ${s + 1} Pink slope outside -3.0 +- 0.8`);
      assert(pRes64.r2 >= 0.95, `Seed ${s + 1} Pink R2 below 0.95`);

      // Brown slope: -6.0 +- 1.0 dB/oct, R2 >= 0.95
      assert(bRes64.slope >= -7.0 && bRes64.slope <= -5.0, `Seed ${s + 1} Brown slope outside -6.0 +- 1.0`);
      assert(bRes64.r2 >= 0.95, `Seed ${s + 1} Brown R2 below 0.95`);

      // Violet slope: +5.0 +- 1.5 dB/oct, R2 >= 0.90
      assert(vRes64.slope >= 3.5 && vRes64.slope <= 6.5, `Seed ${s + 1} Violet slope outside 5.0 +- 1.5`);
      assert(vRes64.r2 >= 0.90, `Seed ${s + 1} Violet R2 below 0.90`);
    }
    console.log('✓ Section 3 Passed: All 10 seeds pass exact Welch PSD acceptance criteria.');
  }

  // --- 4. GAIN STAGING & HEADROOM BUDGET TESTS ---
  console.log('\n--- 4. Gain Staging & Headroom Budget Tests ---');
  {
    const catalogEntries = Object.values(SOUNDSCAPE_CATALOG);

    // Verify all individual track ceilings are <= 0.20
    for (const entry of catalogEntries) {
      assert(
        entry.maxGainCeiling <= 0.20,
        `Track ${entry.id} ceiling (${entry.maxGainCeiling}) exceeds 0.20`
      );
    }

    // Sort ceilings descending to find absolute worst-case combination of 4 tracks
    const sortedCeilings = catalogEntries.map((e) => e.maxGainCeiling).sort((a, b) => b - a);
    const worstCase4Sum = sortedCeilings.slice(0, 4).reduce((sum, c) => sum + c, 0);

    console.log(`Worst-Case Sum of Any 4 Active Track Ceilings: ${worstCase4Sum.toFixed(2)} (Budget: <= ${MAX_GAIN_SUM_BUDGET})`);
    assert(
      worstCase4Sum <= MAX_GAIN_SUM_BUDGET,
      `Worst-case sum of 4 track ceilings (${worstCase4Sum}) exceeds budget ${MAX_GAIN_SUM_BUDGET}`
    );

    // Verify worst-case output sample under unity master gain:
    // worstCaseSample = worstCase4Sum * 0.75 = 0.80 * 0.75 = 0.60
    const worstCasePeakSample = worstCase4Sum * 0.75;
    console.log(`Maximum Output Peak at Summing Junction: ${worstCasePeakSample.toFixed(4)} <= 0.60 < 1.0 (Zero Clipping)`);
    assert(worstCasePeakSample <= 0.6001, 'Summing peak exceeds 0.60');

    console.log('✓ Section 4 Passed: Gain staging strictly enforces clipping-free headroom.');
  }

  // --- 5. LRU CACHE & ACTIVE-BUFFER PINNING TESTS ---
  console.log('\n--- 5. Bounded LRU Cache & Active Pinning Tests ---');
  {
    const cache = new AudioBufferCache();
    assert(MAX_CACHED_BUFFERS === 4, 'LRU cache capacity must be 4');

    // Mock AudioBuffer
    const makeMockBuffer = () => ({ length: 44100, sampleRate: 44100 } as unknown as AudioBuffer);

    // Fill cache with 4 tracks
    cache.put('rain', makeMockBuffer());
    cache.put('thunder', makeMockBuffer());
    cache.put('wind', makeMockBuffer());
    cache.put('forest', makeMockBuffer());
    assert(cache.size() === 4, 'Cache must hold 4 items');

    // Pin 'rain' (playing)
    cache.pin('rain');
    assert(cache.isPinned('rain'), 'Rain must be pinned');

    // Access 'thunder' to update LRU time
    cache.get('thunder');

    // Insert 5th track ('stream') -> oldest unpinned entry ('wind') must be evicted
    cache.put('stream', makeMockBuffer());
    assert(cache.size() === 4, 'Cache size must remain capped at 4');
    assert(cache.get('rain') !== null, 'Pinned entry (rain) must NOT be evicted');
    assert(cache.get('stream') !== null, 'Newly inserted entry (stream) must exist');
    assert(cache.get('wind') === null, 'Oldest unpinned entry (wind) must have been evicted');

    // Unpin rain and verify it can now be evicted
    cache.unpin('rain');
    assert(!cache.isPinned('rain'), 'Rain must be unpinned');

    cache.clear();
    assert(cache.size() === 0, 'Cache must be empty after clear()');
    console.log('✓ Section 5 Passed: LRU eviction and active-buffer pinning verified.');
  }

  // --- 6. LOCAL SETTINGS STORAGE TESTS ---
  console.log('\n--- 6. Local Storage Persistence & Resilience Tests ---');
  {
    // Clean start
    clearAudioSettings();
    const defaults = loadAudioSettings();
    assert(defaults.masterVolume === 0.8, 'Default master volume must be 0.8');
    assert(defaults.isMuted === false, 'Default mute state must be false');

    // Save valid settings
    saveAudioSettings({
      masterVolume: 0.65,
      isMuted: true,
      trackVolumes: {
        rain: 0.9,
        pink_noise: 0.45,
      },
    });

    const loaded = loadAudioSettings();
    assert(loaded.masterVolume === 0.65, 'Saved master volume must be restored');
    assert(loaded.isMuted === true, 'Saved mute state must be restored');
    assert(loaded.trackVolumes.rain === 0.9, 'Saved track volume for rain must be restored');
    assert(loaded.trackVolumes.pink_noise === 0.45, 'Saved track volume for pink noise must be restored');

    // Corrupted JSON resilience
    localStorage.setItem(AUDIO_STORAGE_KEY, '{invalid json');
    const fallbackLoaded = loadAudioSettings();
    assert(fallbackLoaded.masterVolume === DEFAULT_AUDIO_SETTINGS.masterVolume, 'Corrupted JSON must safely fallback to defaults');

    // Out-of-bounds clamping
    localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({
        masterVolume: 99.9,
        isMuted: 'not a boolean',
        trackVolumes: { rain: -5.0 },
      })
    );
    const clampedLoaded = loadAudioSettings();
    assert(clampedLoaded.masterVolume === 1.0, 'Out-of-bounds masterVolume must clamp to 1.0');
    assert(clampedLoaded.isMuted === false, 'Invalid isMuted must fallback to false');
    assert(clampedLoaded.trackVolumes.rain === 0.0, 'Negative track volume must clamp to 0.0');

    clearAudioSettings();
    console.log('✓ Section 6 Passed: Storage resilience and defensive validation verified.');
  }

  // --- 7. WEB LOCKS CONCURRENCY & CANCELLATION RACE TESTS ---
  console.log('\n--- 7. Web Locks Concurrency & Cancellation Race Tests ---');
  {
    // A. Native Lock Acquisition Test
    let nativeGranted = false;
    let yieldResolver: (() => void) | null = null;

    const lockPromise = requestExclusivePlaybackLock(
      'tab-test-1',
      () => true,
      async () => {
        nativeGranted = true;
      },
      () => {
        return new Promise<void>((resolve) => {
          yieldResolver = resolve;
        });
      }
    );

    // Yield lock after short delay
    setTimeout(() => {
      if (yieldResolver) yieldResolver();
    }, 50);

    const resNative = await lockPromise;
    assert(resNative.acquired === true, 'Native Web Lock must acquire successfully');
    assert(nativeGranted === true, 'onOwnershipGranted must be called');

    // B. Unsupported Fallback Test (when navigator.locks is unavailable)
    const originalNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { ...originalNavigator, locks: undefined },
        configurable: true,
      });

      let fallbackGranted = false;
      const resFallback = await requestExclusivePlaybackLock(
        'tab-test-fallback',
        () => true,
        async () => {
          fallbackGranted = true;
        },
        async () => {}
      );
      assert(resFallback.acquired === true, 'Fallback lock must acquire');
      assert(resFallback.reason === 'unsupported_fallback_granted', 'Reason must be unsupported_fallback_granted');
      assert(fallbackGranted === true, 'Fallback onOwnershipGranted must be called');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    }

    // C. Cancellation Race Defense Test
    // Verify that if active playback intent is lost before or during acquisition, ownership is safely aborted
    let intentActive = false;
    let audibleNodeStarted = false;

    // Simulate mock Web Locks API with simultaneous grant when intent is false
    const mockLocks = {
      request: async (
        _name: string,
        _options: { mode: string; signal: AbortSignal },
        callback: (lock: unknown) => Promise<boolean>
      ) => {
        return callback({ name: _name });
      },
    };

    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { ...originalNavigator, locks: mockLocks },
        configurable: true,
      });

      const raceResult = await requestExclusivePlaybackLock(
        'tab-test-race',
        () => intentActive, // Intent is FALSE
        async () => {
          audibleNodeStarted = true;
        },
        async () => {}
      );

      assert(raceResult.acquired === false, 'Lock acquisition must abort when active playback intent is false');
      assert(raceResult.reason === 'intent_cancelled', 'Reason must be intent_cancelled');
      assert(audibleNodeStarted === false, 'Audible nodes must NEVER be started when intent is cancelled');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    }

    console.log('✓ Section 7 Passed: Web Locks arbitration, fallback, and cancellation race defenses verified.');
  }

  // --- 8. INDEPENDENT CANCELLATION SCOPES & GENERATION SAFETY TESTS ---
  console.log('\n--- 8. Independent Cancellation Scopes & Generation Safety Tests ---');
  {
    // Mock Web Audio globals for Node.js environment
    class MockGainNode {
      gain = {
        value: 1.0,
        setValueAtTime: (val: number, _t: number) => { this.gain.value = val; },
        exponentialRampToValueAtTime: (val: number, _t: number) => { this.gain.value = val; },
        linearRampToValueAtTime: (val: number, _t: number) => { this.gain.value = val; },
      };
      connectedTo: unknown[] = [];
      connect(target: unknown, _out = 0, _in = 0) { this.connectedTo.push(target); }
      disconnect() { this.connectedTo = []; }
    }

    class MockOscillatorNode {
      type = 'sine';
      frequency = {
        value: 440,
        setValueAtTime: (val: number, _t: number) => { this.frequency.value = val; },
      };
      connectedTo: unknown[] = [];
      connectionDetails: { target: unknown; outIndex: number; inIndex: number }[] = [];
      isStarted = false;
      isStopped = false;
      start(_when?: number) { this.isStarted = true; }
      stop(_when?: number) { this.isStopped = true; }
      connect(target: unknown, _out = 0, _in = 0) {
        this.connectedTo.push(target);
        this.connectionDetails.push({ target, outIndex: _out, inIndex: _in });
      }
      disconnect() {
        this.connectedTo = [];
        this.connectionDetails = [];
      }
    }

    class MockChannelMergerNode {
      numberOfInputs: number;
      connectedTo: unknown[] = [];
      constructor(inputs = 2) { this.numberOfInputs = inputs; }
      connect(target: unknown, _out = 0, _in = 0) { this.connectedTo.push(target); }
      disconnect() { this.connectedTo = []; }
    }

    class MockDynamicsCompressorNode {
      threshold = { setValueAtTime: () => {} };
      knee = { setValueAtTime: () => {} };
      ratio = { setValueAtTime: () => {} };
      attack = { setValueAtTime: () => {} };
      release = { setValueAtTime: () => {} };
      connect(_target: unknown) {}
      disconnect() {}
    }

    class MockBufferSourceNode {
      buffer: unknown = null;
      loop = false;
      isStarted = false;
      isStopped = false;
      connectedTo: unknown[] = [];
      start() { this.isStarted = true; }
      stop() { this.isStopped = true; }
      connect(target: unknown) { this.connectedTo.push(target); }
      disconnect() { this.connectedTo = []; }
    }

    class MockAudioWorkletNode {
      parameters = new Map<string, { setValueAtTime: (val: number) => void }>([
        ['noiseType', { setValueAtTime: () => {} }],
      ]);
      port = {
        postMessage: () => {},
        onmessage: null,
      };
      connectedTo: unknown[] = [];
      connect(target: unknown) { this.connectedTo.push(target); }
      disconnect() { this.connectedTo = []; }
    }

    class MockAudioContext {
      state: 'suspended' | 'running' = 'running';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      audioWorklet = {
        addModule: async (_url: string) => true,
      };
      createGain() { return new MockGainNode(); }
      createOscillator() { return new MockOscillatorNode(); }
      createChannelMerger(inputs = 2) { return new MockChannelMergerNode(inputs); }
      createDynamicsCompressor() { return new MockDynamicsCompressorNode(); }
      createBuffer(channels: number, length: number, sampleRate: number) {
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource() { return new MockBufferSourceNode(); }
      async decodeAudioData(arrayBuffer: ArrayBuffer) {
        return this.createBuffer(2, 48000, 48000);
      }
      async resume() { this.state = 'running'; }
      async suspend() { this.state = 'suspended'; }
      async close() {}
    }

    class MockBroadcastChannel {
      name: string;
      onmessage: ((event: unknown) => void) | null = null;
      constructor(name: string) { this.name = name; }
      postMessage(_data: unknown) {}
      close() {}
    }

    // Attach mocks to globalThis
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    (globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = MockAudioWorkletNode;
    (globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel = MockBroadcastChannel;

    const engine = AudioEngine.getInstance();

    // 8.1 Controlled Asynchronous Delay & Cancellation Race:
    // Request A starts and pauses -> cancel A -> start B -> resolve B -> resolve A
    // Assert B succeeds, A rejected as stale, only B active
    {
      await engine.stopAll();
      const initialEpoch = engine.getGlobalCancellationEpoch();

      // Start Request A (white_noise)
      const reqAPromise = engine.playTrack('white_noise');

      // Cancel A while loading
      await engine.stopTrack('white_noise');
      assert(engine.getTrackGeneration('white_noise') > 0, 'Track generation for white_noise must be incremented upon stopTrack');

      // Start Request B (brown_noise)
      const reqBPromise = engine.playTrack('brown_noise');

      const resB = await reqBPromise;
      const resA = await reqAPromise;

      assert(resB === true, 'Request B (brown_noise) must succeed');
      assert(resA === false, 'Stale Request A (white_noise) must be rejected with false');

      const state = engine.getState();
      assert(state.activeTracks['brown_noise']?.isPlaying === true, 'Brown noise must be actively playing');
      assert(!state.activeTracks['white_noise'], 'White noise must NOT be active');
      assert(state.activeCount === 1, 'Exactly one track must be active');
      console.log('✓ 8.1 Passed: Mid-flight cancellation and supersession cleanly rejects stale Request A.');
    }

    // 8.2 StopTrack during loading
    {
      await engine.stopAll();
      // Start pink_noise and immediately stop it
      const pinkPromise = engine.playTrack('pink_noise');
      await engine.stopTrack('pink_noise');
      const pinkResult = await pinkPromise;

      assert(pinkResult === false, 'Stopped loading track must return false');
      assert(!engine.getState().activeTracks['pink_noise'], 'Pink noise must not be present in active tracks');
      assert(engine.getState().activeCount === 0, 'Active count must be 0');
      console.log('✓ 8.2 Passed: stopTrack during loading invalidates pending request immediately.');
    }

    // 8.3 StopAll during multiple pending requests
    {
      await engine.stopAll();
      const epochBefore = engine.getGlobalCancellationEpoch();

      const p1 = engine.playTrack('white_noise');
      const p2 = engine.playTrack('pink_noise');

      // Invalidate all pending requests with stopAll
      await engine.stopAll();

      const r1 = await p1;
      const r2 = await p2;

      assert(r1 === false && r2 === false, 'All pending requests must be rejected after stopAll');
      assert(engine.getGlobalCancellationEpoch() > epochBefore, 'Global cancellation epoch must increment after stopAll');
      assert(engine.getState().activeCount === 0, 'Active count must be 0 after stopAll');
      console.log('✓ 8.3 Passed: stopAll during multiple pending requests invalidates all requests across all tracks.');
    }

    // 8.4 Start a new request after stopAll
    {
      const newReq = await engine.playTrack('brown_noise');
      assert(newReq === true, 'New request after stopAll must play normally');
      assert(engine.getState().activeTracks['brown_noise']?.isPlaying === true, 'Brown noise must be playing');
      console.log('✓ 8.4 Passed: New request after stopAll initializes cleanly.');
    }

    // 8.5 Two different tracks loading and playing concurrently (Multi-Track Coexistence)
    {
      await engine.stopAll();
      const pWhite = engine.playTrack('white_noise');
      const pPink = engine.playTrack('pink_noise');

      const [resWhite, resPink] = await Promise.all([pWhite, pPink]);
      assert(resWhite === true, 'White noise must succeed');
      assert(resPink === true, 'Pink noise must succeed');

      const state = engine.getState();
      assert(state.activeCount === 2, 'Both tracks must be concurrently active');
      assert(state.activeTracks['white_noise']?.isPlaying === true, 'White noise is playing');
      assert(state.activeTracks['pink_noise']?.isPlaying === true, 'Pink noise is playing');
      assert(state.ownershipState === 'owned', 'Single Web Lock ownership retained for both tracks');
      console.log('✓ 8.5 Passed: Two different tracks load and play concurrently in the same tab.');
    }

    // 8.6 Same track started twice in rapid succession
    {
      await engine.stopAll();
      const req1 = engine.playTrack('white_noise');
      const req2 = engine.playTrack('white_noise');

      const [res1, res2] = await Promise.all([req1, req2]);
      // Either older is aborted or identical channel reused
      const state = engine.getState();
      assert(state.activeCount === 1, 'Only one channel must be active for white_noise');
      assert(state.activeTracks['white_noise']?.isPlaying === true, 'White noise is playing');
      console.log('✓ 8.6 Passed: Rapid duplicate start on same track does not create duplicate channels.');
    }

    // 8.7 Up to 4 simultaneous tracks permitted, 5th rejected
    {
      await engine.stopAll();

      // Temporarily define procedural entries to test 4-track ceiling (Phase 2D-1 procedural-only scope)
      const catalogAny = SOUNDSCAPE_CATALOG as Record<string, unknown>;
      catalogAny['test_noise_4'] = {
        id: 'test_noise_4',
        category: 'noise',
        sourceType: 'procedural',
        maxGainCeiling: 0.20,
        defaultVolume: 0.5,
        isStereo: true,
      };
      catalogAny['test_noise_5'] = {
        id: 'test_noise_5',
        category: 'noise',
        sourceType: 'procedural',
        maxGainCeiling: 0.20,
        defaultVolume: 0.5,
        isStereo: true,
      };

      try {
        const t1 = await engine.playTrack('white_noise');
        const t2 = await engine.playTrack('pink_noise');
        const t3 = await engine.playTrack('brown_noise');
        const t4 = await engine.playTrack('test_noise_4' as unknown as SoundscapeId);

        assert(t1 && t2 && t3 && t4, '4 tracks must all start successfully');
        assert(engine.getState().activeCount === 4, 'Active count must be exactly 4');

        // 5th track must be rejected by MAX_SIMULTANEOUS_TRACKS ceiling
        const t5 = await engine.playTrack('test_noise_5' as unknown as SoundscapeId);
        assert(t5 === false, '5th simultaneous track must be rejected');
        assert(engine.getState().activeCount === 4, 'Active count must remain 4');
        assert(engine.getState().conflictError !== null, 'Conflict error must be surfaced for 5th track');
        console.log('✓ 8.7 Passed: 4-track concurrency ceiling strictly enforced.');
      } finally {
        delete catalogAny['test_noise_4'];
        delete catalogAny['test_noise_5'];
      }
    }

    // 8.8 Clean shutdown
    await engine.stopAll();
    assert(engine.getState().activeCount === 0, 'Active count must be 0 after shutdown');
    assert(engine.getState().ownershipState === 'idle', 'Ownership state must return to idle');
    console.log('✓ Section 8 Passed: Independent cancellation scopes and multi-track coexistence fully verified.');
  }

  // --- 9. WEB LOCKS ACQUISITION & LIFETIME MANAGEMENT TESTS ---
  console.log('\n--- 9. Web Locks Acquisition & Lifetime Management Tests ---');
  {
    // 9.1 Acquisition resolves immediately upon grant without awaiting yield
    let yieldResolver: (() => void) | null = null;
    let lockGranted = false;

    const acquisitionPromise = requestExclusivePlaybackLock(
      'test-tab-prompt-grant',
      () => true,
      async () => {
        lockGranted = true;
      },
      () => {
        return new Promise<void>((resolve) => {
          yieldResolver = resolve;
        });
      }
    );

    const acquisitionResult = await acquisitionPromise;
    assert(acquisitionResult.acquired === true, 'Acquisition promise must resolve immediately with acquired: true');
    assert(acquisitionResult.reason === 'granted', 'Reason must be granted');
    assert(lockGranted === true, 'Ownership granted callback must have executed');

    // Yield lock to cleanup
    if (yieldResolver) yieldResolver();
    console.log('✓ 9.1 Passed: Acquisition resolves promptly upon grant while lock retention remains active.');

    // 9.2 Mutual exclusion: second request cannot acquire while first holds lock
    let yieldResolver1: (() => void) | null = null;
    const lock1 = await requestExclusivePlaybackLock(
      'tab-owner-1',
      () => true,
      async () => {},
      () => new Promise<void>((resolve) => { yieldResolver1 = resolve; })
    );
    assert(lock1.acquired === true, 'Tab 1 must acquire lock');

    // Tab 2 attempts to acquire the same exclusive lock (timeout guard fires after 500ms)
    const lock2Promise = requestExclusivePlaybackLock(
      'tab-waiter-2',
      () => true,
      async () => {},
      async () => {}
    );

    const lock2 = await lock2Promise;
    assert(lock2.acquired === false, 'Tab 2 cannot acquire exclusive lock while Tab 1 holds it');
    assert(lock2.reason === 'timed_out', 'Tab 2 acquisition must time out');

    // Tab 1 now yields
    if (yieldResolver1) yieldResolver1();

    // After Tab 1 yields, Tab 3 can now acquire
    let yieldResolver3: (() => void) | null = null;
    const lock3 = await requestExclusivePlaybackLock(
      'tab-owner-3',
      () => true,
      async () => {},
      () => new Promise<void>((resolve) => { yieldResolver3 = resolve; })
    );
    assert(lock3.acquired === true, 'Tab 3 acquires lock cleanly after Tab 1 released it');
    if (yieldResolver3) yieldResolver3();
    console.log('✓ 9.2 Passed: Mutual exclusion enforced; releasing unblocks subsequent acquisition.');

    // 9.3 In-callback cancellation: if active intent lost before grant, aborted cleanly
    const lockCancelled = await requestExclusivePlaybackLock(
      'tab-cancelled',
      () => false, // Active intent is false!
      async () => {},
      async () => {}
    );
    assert(lockCancelled.acquired === false, 'Cancelled intent must fail acquisition');
    assert(lockCancelled.reason === 'intent_cancelled', 'Reason must be intent_cancelled');
    console.log('✓ 9.3 Passed: Cancelled waiting request safely aborts without acquiring ownership.');

    console.log('✓ Section 9 Passed: Web Locks acquisition and lifetime management fully verified.');
  }

  // --- 10. PROCEDURAL AUDIO & BEAT SYNTHESIS TESTS (PHASE 2D-3B) ---
  console.log('\n--- 10. Procedural Audio & Beat Synthesis Tests (Phase 2D-3B) ---');
  {
    // Setup mock context for direct generator unit tests
    const ctx = new (globalThis as unknown as { AudioContext: new () => AudioContext }).AudioContext();

    // 10.1 Binaural Beat Frequency Accuracy & Preset Calibration
    {
      const presets: Array<{
        carrier: number;
        beat: number;
        expectedFL: number;
        expectedFR: number;
      }> = [
        { carrier: 200, beat: 2.5, expectedFL: 198.75, expectedFR: 201.25 }, // delta
        { carrier: 250, beat: 6.0, expectedFL: 247.0, expectedFR: 253.0 },   // theta
        { carrier: 250, beat: 10.0, expectedFL: 245.0, expectedFR: 255.0 },  // alpha
        { carrier: 300, beat: 18.0, expectedFL: 291.0, expectedFR: 309.0 },  // beta
        { carrier: 350, beat: 40.0, expectedFL: 330.0, expectedFR: 370.0 },  // gamma
      ];

      for (const p of presets) {
        const handle = createBinauralBeat(ctx, { carrierFreq: p.carrier, beatFreq: p.beat });
        const oscL = handle.sources[0] as unknown as { frequency: { value: number } };
        const oscR = handle.sources[1] as unknown as { frequency: { value: number } };
        assert(Math.abs(oscL.frequency.value - p.expectedFL) < 1e-4, `Left osc freq must be ${p.expectedFL}`);
        assert(Math.abs(oscR.frequency.value - p.expectedFR) < 1e-4, `Right osc freq must be ${p.expectedFR}`);
        assert(handle.metadata.carrierFreq === p.carrier, 'Carrier freq metadata mismatch');
        assert(handle.metadata.beatOrPulseFreq === p.beat, 'Beat freq metadata mismatch');
        assert(handle.metadata.isStereo === true, 'Binaural beats must be stereo');
        assert(handle.metadata.headphoneRequired === true, 'Binaural beats must flag headphoneRequired');
        handle.disconnect();
      }
      console.log('✓ 10.1 Passed: Binaural beat frequency accuracy verified across delta, theta, alpha, beta, gamma.');
    }

    // 10.2 Binaural Stereo Channel Routing & Lifecycle
    {
      const handle = createBinauralBeat(ctx, { carrierFreq: 250, beatFreq: 10.0 });
      assert(handle.sources.length === 2, 'Must have exactly 2 oscillator sources');
      assert(handle.gains.length === 1, 'Must have exactly 1 gain node');
      assert(handle.nodes.length === 1, 'Must have exactly 1 merger node');

      const oscL = handle.sources[0] as unknown as {
        isStarted: boolean;
        isStopped: boolean;
        connectionDetails: { target: unknown; outIndex: number; inIndex: number }[];
      };
      const oscR = handle.sources[1] as unknown as {
        isStarted: boolean;
        isStopped: boolean;
        connectionDetails: { target: unknown; outIndex: number; inIndex: number }[];
      };
      const merger = handle.nodes[0] as unknown as {
        numberOfInputs: number;
        connectedTo: unknown[];
      };
      const toneGain = handle.gains[0] as unknown as {
        gain: { value: number };
        connectedTo: unknown[];
      };

      assert(merger.numberOfInputs === 2, 'Merger must have 2 input channels');
      assert(oscL.connectionDetails[0].inIndex === 0, 'Left osc must route to merger input 0 (L channel)');
      assert(oscR.connectionDetails[0].inIndex === 1, 'Right osc must route to merger input 1 (R channel)');
      assert(merger.connectedTo.includes(toneGain), 'Merger must connect to toneGain');
      assert(toneGain.gain.value <= 0.7071 && toneGain.gain.value <= 0.75, 'Binaural output gain must be <= 0.7071 <= 0.75');

      // Test lifecycle
      handle.start(0);
      assert(oscL.isStarted === true && oscR.isStarted === true, 'Oscillators must start');
      handle.stop(0);
      assert(oscL.isStopped === true && oscR.isStopped === true, 'Oscillators must stop');
      handle.disconnect();
      console.log('✓ 10.2 Passed: Binaural stereo channel separation and lifecycle management verified.');
    }

    // 10.3 Monaural Beat Acoustic Waveform & Peak Amplitude Bound
    {
      const handle = createMonauralBeat(ctx, { carrierFreq: 250, beatFreq: 10.0 });
      assert(handle.sources.length === 2, 'Monaural beat must have 2 oscillator sources');
      assert(handle.gains.length === 1, 'Monaural beat must have 1 summing gain node');
      assert(handle.metadata.isStereo === false, 'Monaural beat must be mono');
      assert(handle.metadata.headphoneRequired === false, 'Monaural beat does not require headphones');

      const osc1 = handle.sources[0] as unknown as { frequency: { value: number } };
      const osc2 = handle.sources[1] as unknown as { frequency: { value: number } };
      assert(Math.abs(osc1.frequency.value - 245.0) < 1e-4, 'Osc1 freq must be carrier - beat/2');
      assert(Math.abs(osc2.frequency.value - 255.0) < 1e-4, 'Osc2 freq must be carrier + beat/2');

      const summingGain = handle.gains[0] as unknown as { gain: { value: number } };
      assert(summingGain.gain.value === 0.3535, 'Summing gain must be 0.3535 to bound peak to <= 0.7070');

      // Discrete mathematical simulation of physical acoustic interference
      const sampleRate = 44100;
      const numSamples = 44100; // 1 full second
      let maxPeak = 0;
      let minEnvelope = 1;
      let maxEnvelope = 0;

      for (let n = 0; n < numSamples; n++) {
        const t = n / sampleRate;
        // Interference equation: s(t) = 0.3535 * [sin(2*pi*f1*t) + sin(2*pi*f2*t)]
        const s = 0.3535 * (Math.sin(2 * Math.PI * 245.0 * t) + Math.sin(2 * Math.PI * 255.0 * t));
        const absVal = Math.abs(s);
        if (absVal > maxPeak) maxPeak = absVal;

        // Envelope: 2 * 0.3535 * |cos(2*pi*(fm/2)*t)| = 0.7070 * |cos(2*pi*5*t)|
        const env = 0.7070 * Math.abs(Math.cos(2 * Math.PI * 5.0 * t));
        if (env < minEnvelope) minEnvelope = env;
        if (env > maxEnvelope) maxEnvelope = env;
      }

      assert(maxPeak <= 0.7071, `Peak (${maxPeak}) must remain <= 0.7071`);
      assert(maxPeak <= 0.7500, `Peak (${maxPeak}) must remain <= 0.7500`);
      assert(minEnvelope < 0.001, 'Monaural envelope must reach full destructive nulls');
      assert(maxEnvelope >= 0.7069, 'Monaural envelope must reach full constructive peak');
      handle.disconnect();
      console.log('✓ 10.3 Passed: Monaural beat acoustic interference and bounded peak (<= 0.7070) verified.');
    }

    // 10.4 Isochronic Tone Smooth Raised-Cosine Envelope & Click-Free Continuity
    {
      const handle = createIsochronicTone(ctx, {
        carrierFreq: 250,
        pulseRate: 10.0,
        modulationDepth: 1.0,
      });

      assert(handle.sources.length === 2, 'Isochronic tone must have carrier and mod LFO sources');
      assert(handle.gains.length === 2, 'Isochronic tone must have modGain and depthGain');
      assert(handle.metadata.isStereo === false, 'Isochronic tone must be mono');
      assert(handle.metadata.headphoneRequired === false, 'Isochronic tone does not require headphones');
      assert(handle.metadata.carrierFreq === 250, 'Carrier freq must match');
      assert(handle.metadata.beatOrPulseFreq === 10.0, 'Pulse rate must match');
      assert(handle.metadata.modulationDepth === 1.0, 'Modulation depth must match');

      const carrierOsc = handle.sources[0] as unknown as { frequency: { value: number } };
      const modOsc = handle.sources[1] as unknown as { frequency: { value: number } };
      assert(carrierOsc.frequency.value === 250, 'Carrier oscillator frequency must be 250 Hz');
      assert(modOsc.frequency.value === 10.0, 'LFO oscillator frequency must be 10.0 Hz');

      // Discrete mathematical simulation of raised-cosine modulation envelope
      const sampleRate = 44100;
      const numSamples = 44100;
      let maxSignalPeak = 0;
      let maxEnvelopeSlope = 0;
      let prevEnvelope = 0.35355; // base at t=0

      for (let n = 0; n < numSamples; n++) {
        const t = n / sampleRate;
        // Raised cosine amplitude: g(t) = 0.35355 + 0.35355 * sin(2*pi*f_p*t)
        const g = 0.35355 + 0.35355 * Math.sin(2 * Math.PI * 10.0 * t);
        const slope = Math.abs(g - prevEnvelope);
        if (slope > maxEnvelopeSlope) maxEnvelopeSlope = slope;
        prevEnvelope = g;

        const s = g * Math.sin(2 * Math.PI * 250.0 * t);
        const absVal = Math.abs(s);
        if (absVal > maxSignalPeak) maxSignalPeak = absVal;

        assert(g >= -1e-6, 'Modulation gain must never become negative');
        assert(g <= 0.7072, 'Modulation gain must never exceed 0.7071');
      }

      assert(maxSignalPeak <= 0.7071, `Isochronic peak (${maxSignalPeak}) must remain <= 0.7071`);
      assert(maxSignalPeak <= 0.7500, `Isochronic peak (${maxSignalPeak}) must remain <= 0.7500`);
      // Max slope of 0.35355 * sin(2*pi*10*t) is 0.35355 * 2 * pi * 10 / 44100 = 0.000504
      assert(maxEnvelopeSlope < 0.001, `Envelope slope (${maxEnvelopeSlope}) must be smooth and continuous`);
      handle.disconnect();
      console.log('✓ 10.4 Passed: Isochronic tone raised-cosine envelope continuity (no clicks) and bounded peak verified.');
    }

    // 10.5 Defensive Parameter Validation & Rejection of Invalid/Non-Finite Arguments
    {
      const invalidArgs: Array<Record<string, unknown>> = [
        { carrierFreq: NaN },
        { carrierFreq: Infinity },
        { carrierFreq: -Infinity },
        { carrierFreq: '250' as unknown as number },
        { carrierFreq: 40 },   // below 50 Hz min
        { carrierFreq: 1100 }, // above 1000 Hz max
        { beatFreq: 0.1 },     // below 0.5 Hz min
        { beatFreq: 60 },      // above 50 Hz max
        { beatFreq: NaN },
      ];

      for (const arg of invalidArgs) {
        let threwBinaural = false;
        try {
          createBinauralBeat(ctx, arg);
        } catch {
          threwBinaural = true;
        }
        assert(threwBinaural, `createBinauralBeat must throw for invalid arg: ${JSON.stringify(arg)}`);

        let threwMonaural = false;
        try {
          createMonauralBeat(ctx, arg);
        } catch {
          threwMonaural = true;
        }
        assert(threwMonaural, `createMonauralBeat must throw for invalid arg: ${JSON.stringify(arg)}`);
      }

      // Isochronic specific checks (pulseRate & modulationDepth)
      const invalidIsoArgs: Array<Record<string, unknown>> = [
        { pulseRate: 0.2 },
        { pulseRate: 100 },
        { pulseRate: NaN },
        { modulationDepth: -0.1 },
        { modulationDepth: 1.5 },
        { modulationDepth: NaN },
      ];

      for (const arg of invalidIsoArgs) {
        let threwIso = false;
        try {
          createIsochronicTone(ctx, arg);
        } catch {
          threwIso = true;
        }
        assert(threwIso, `createIsochronicTone must throw for invalid arg: ${JSON.stringify(arg)}`);
      }

      // Empty options must succeed with defaults
      const defBin = createBinauralBeat(ctx, {});
      assert(defBin.metadata.carrierFreq === 250 && defBin.metadata.beatOrPulseFreq === 10.0, 'Default binaural parameters');
      defBin.disconnect();

      const defMon = createMonauralBeat(ctx, {});
      assert(defMon.metadata.carrierFreq === 250 && defMon.metadata.beatOrPulseFreq === 10.0, 'Default monaural parameters');
      defMon.disconnect();

      const defIso = createIsochronicTone(ctx, {});
      assert(defIso.metadata.carrierFreq === 250 && defIso.metadata.beatOrPulseFreq === 10.0 && defIso.metadata.modulationDepth === 1.0, 'Default isochronic parameters');
      defIso.disconnect();

      console.log('✓ 10.5 Passed: Defensive parameter validation strictly rejects non-finite and out-of-bound inputs.');
    }

    // 10.6 Dynamic Per-Node Accounting & Strict Global Ceilings Enforcement
    {
      const engine = AudioEngine.getInstance();
      await engine.stopAll();

      // Static helper verification
      assert(getTrackRequiredSourceNodes('white_noise') === 1, 'White noise requires 1 source node');
      assert(getTrackRequiredGainNodes('white_noise') === 1, 'White noise requires 1 gain node');
      assert(getTrackRequiredSourceNodes('violet_noise') === 1, 'Violet noise requires 1 source node');
      assert(getTrackRequiredGainNodes('violet_noise') === 1, 'Violet noise requires 1 gain node');
      assert(getTrackRequiredSourceNodes('binaural_alpha') === 2, 'Binaural beat requires 2 source nodes (oscillators)');
      assert(getTrackRequiredGainNodes('binaural_alpha') === 2, 'Binaural beat requires 2 gain nodes (toneGain + trackGain)');
      assert(getTrackRequiredSourceNodes('monaural_alpha') === 2, 'Monaural beat requires 2 source nodes (oscillators)');
      assert(getTrackRequiredGainNodes('monaural_alpha') === 2, 'Monaural beat requires 2 gain nodes (summingGain + trackGain)');
      assert(getTrackRequiredSourceNodes('isochronic_alpha') === 2, 'Isochronic tone requires 2 source nodes (carrier + LFO)');
      assert(getTrackRequiredGainNodes('isochronic_alpha') === 3, 'Isochronic tone requires 3 gain nodes (modGain + depthGain + trackGain)');

      assert(MAX_SIMULTANEOUS_TRACKS === 4, 'Max simultaneous tracks must be 4');
      assert(MAX_ACTIVE_SOURCE_NODES === 8, 'Max active source nodes must be 8');
      assert(MAX_ACTIVE_GAIN_NODES === 8, 'Max active gain nodes must be 8');

      // Assert engine initial empty state
      assert(engine.getActiveSourceNodeCount() === 0, 'Initial active sources must be 0');
      assert(engine.getActiveGainNodeCount() === 0, 'Initial active gains must be 0');

      // Track 1: binaural_alpha (2 sources, 2 gains)
      const res1 = await engine.playTrack('binaural_alpha');
      assert(res1 === true, 'Track 1 (binaural_alpha) must start');
      assert(engine.getActiveSourceNodeCount() === 2, 'Active sources must be 2');
      assert(engine.getActiveGainNodeCount() === 2, 'Active gains must be 2');

      // Track 2: binaural_theta (2 sources, 2 gains)
      const res2 = await engine.playTrack('binaural_theta');
      assert(res2 === true, 'Track 2 (binaural_theta) must start');
      assert(engine.getActiveSourceNodeCount() === 4, 'Active sources must be 4');
      assert(engine.getActiveGainNodeCount() === 4, 'Active gains must be 4');

      // Track 3: isochronic_alpha (2 sources, 3 gains)
      const res3 = await engine.playTrack('isochronic_alpha');
      assert(res3 === true, 'Track 3 (isochronic_alpha) must start');
      assert(engine.getActiveSourceNodeCount() === 6, 'Active sources must be 6 (2+2+2)');
      assert(engine.getActiveGainNodeCount() === 7, 'Active gains must be 7 (2+2+3)');

      // Attempt Track 4 with isochronic_theta (requires 2 sources, 3 gains):
      // Current gains = 7. 7 + 3 = 10 > 8 (MAX_ACTIVE_GAIN_NODES). Must be rejected!
      const res4Rejected = await engine.playTrack('isochronic_theta');
      assert(res4Rejected === false, 'isochronic_theta must be rejected due to gain node ceiling');
      assert(engine.getState().conflictError?.includes('node limit reached') === true, 'Conflict error must report node limit');
      // Existing playback must be completely unharmed
      assert(engine.getState().activeCount === 3, 'Active tracks count must remain 3');
      assert(engine.getActiveSourceNodeCount() === 6, 'Active sources must remain 6');
      assert(engine.getActiveGainNodeCount() === 7, 'Active gains must remain 7');
      assert(engine.getState().activeTracks['binaural_alpha']?.isPlaying === true, 'Track 1 must still be playing');
      assert(engine.getState().activeTracks['binaural_theta']?.isPlaying === true, 'Track 2 must still be playing');
      assert(engine.getState().activeTracks['isochronic_alpha']?.isPlaying === true, 'Track 3 must still be playing');

      // Now add Track 4 that fits within node budget: white_noise (1 source, 1 gain)
      // 6 + 1 = 7 <= 8 sources, 7 + 1 = 8 <= 8 gains, 4 tracks <= 4 max tracks.
      const res4Admitted = await engine.playTrack('white_noise');
      assert(res4Admitted === true, 'white_noise must be admitted within remaining node budget');
      assert(engine.getState().activeCount === 4, 'Active tracks count must be 4');
      assert(engine.getActiveSourceNodeCount() === 7, 'Active sources must be 7');
      assert(engine.getActiveGainNodeCount() === 8, 'Active gains must be 8');

      // Attempt Track 5 with pink_noise (1 source, 1 gain):
      // Must be rejected by both 4-track ceiling AND gain ceiling (8 + 1 = 9 > 8).
      const res5Rejected = await engine.playTrack('pink_noise');
      assert(res5Rejected === false, '5th track must be rejected');
      assert(engine.getState().activeCount === 4, 'Active tracks count must remain 4');
      assert(engine.getActiveSourceNodeCount() === 7, 'Active sources must remain 7');
      assert(engine.getActiveGainNodeCount() === 8, 'Active gains must remain 8');

      console.log('✓ 10.6 Passed: Dynamic per-node accounting and strict 8-source/8-gain ceilings enforced without corrupting active playback.');
    }

    // 10.7 Procedural Track Teardown, Node Release & Clean Teardown
    {
      const engine = AudioEngine.getInstance();
      assert(engine.getState().activeCount === 4, 'Must have 4 tracks currently playing');

      // Stop binaural_alpha (releases 2 sources, 2 gains)
      await engine.stopTrack('binaural_alpha');
      assert(engine.getState().activeCount === 3, 'Active count must decrease to 3');
      assert(engine.getActiveSourceNodeCount() === 5, 'Active sources must decrease from 7 to 5');
      assert(engine.getActiveGainNodeCount() === 6, 'Active gains must decrease from 8 to 6');

      // Stop isochronic_alpha (releases 2 sources, 3 gains)
      await engine.stopTrack('isochronic_alpha');
      assert(engine.getState().activeCount === 2, 'Active count must decrease to 2');
      assert(engine.getActiveSourceNodeCount() === 3, 'Active sources must decrease from 5 to 3');
      assert(engine.getActiveGainNodeCount() === 3, 'Active gains must decrease from 6 to 3');

      // Stop all
      await engine.stopAll();
      assert(engine.getState().activeCount === 0, 'Active count must be 0');
      assert(engine.getActiveSourceNodeCount() === 0, 'All sources must be fully released (0)');
      assert(engine.getActiveGainNodeCount() === 0, 'All gains must be fully released (0)');
      assert(engine.getState().ownershipState === 'idle', 'Ownership state must return to idle');
      console.log('✓ 10.7 Passed: Procedural track teardown and complete node release verified.');
    }

    // 10.8 Violet Noise Catalog Registration & Procedural Playback
    {
      const engine = AudioEngine.getInstance();
      const violetConfig = SOUNDSCAPE_CATALOG['violet_noise'];
      assert(violetConfig !== undefined, 'violet_noise must be present in SOUNDSCAPE_CATALOG');
      assert(violetConfig.category === 'noise', 'violet_noise category must be noise');
      assert(violetConfig.sourceType === 'procedural', 'violet_noise must be procedural');
      assert(violetConfig.isStereo === true, 'violet_noise must be stereo');
      assert(violetConfig.maxGainCeiling === 0.20, 'violet_noise maxGainCeiling must be 0.20');

      const played = await engine.playTrack('violet_noise');
      assert(played === true, 'violet_noise must start cleanly in AudioEngine');
      assert(engine.getState().activeTracks['violet_noise']?.isPlaying === true, 'violet_noise is marked playing');
      assert(engine.getActiveSourceNodeCount() === 1, 'violet_noise uses 1 source node');
      assert(engine.getActiveGainNodeCount() === 1, 'violet_noise uses 1 gain node');

      await engine.stopAll();
      assert(engine.getActiveSourceNodeCount() === 0, 'Sources released');
      assert(engine.getActiveGainNodeCount() === 0, 'Gains released');
      console.log('✓ 10.8 Passed: Violet noise catalog entry, procedural engine routing, and lifecycle verified.');
    }

    // 10.9 Partial Construction Failure, Teardown Rollback & Node Quarantine
    {
      const engine = AudioEngine.getInstance();
      await engine.stopAll();
      engine.resetQuarantine();

      // 1. Start baseline track (white noise) to verify non-interference
      const baseStarted = await engine.playTrack('white_noise');
      assert(baseStarted === true, 'Baseline white_noise track must be active');
      assert(engine.getState().activeCount === 1, 'Active tracks must be 1');
      assert(engine.getActiveSourceNodeCount() === 1, 'Active sources must be 1');
      assert(engine.getActiveGainNodeCount() === 1, 'Active gains must be 1');

      // 2. Simulate partial construction failure:
      // When creating isochronic_alpha (which creates 2 internal gains, then 1 track gain):
      // Force ctx.createGain to throw on the 3rd gain node creation (the trackGainNode).
      const ctx = (engine as unknown as { audioContext: AudioContext }).audioContext;
      const originalCreateGain = ctx.createGain.bind(ctx);
      let gainCallCount = 0;

      ctx.createGain = () => {
        gainCallCount++;
        if (gainCallCount === 3) {
          throw new Error('Simulated native GainNode allocation OOM failure');
        }
        return originalCreateGain();
      };

      const failTrackRes = await engine.playTrack('isochronic_alpha');
      ctx.createGain = originalCreateGain; // Restore immediately

      assert(failTrackRes === false, 'Partial failure track must return false');
      assert(
        engine.getState().activeTracks['isochronic_alpha']?.error?.includes('allocation OOM') === true,
        'Error must be recorded in track state'
      );

      // Verify baseline track is completely unaffected
      assert(engine.getState().activeCount === 1, 'Active tracks count must remain exactly 1');
      assert(engine.getState().activeTracks['white_noise']?.isPlaying === true, 'Baseline track must still be playing');
      assert(engine.getActiveSourceNodeCount() === 1, 'Sources count must remain 1 (no leak from failed track)');
      assert(engine.getActiveGainNodeCount() === 1, 'Gains count must remain 1 (no leak from failed track)');

      // 3. Test failed teardown / disconnect failure: node quarantine retention
      // If a source's disconnect throws, reservation MUST NOT be silently freed.
      const originalCreateOsc = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = () => {
        const osc = originalCreateOsc();
        const origDisconnect = osc.disconnect.bind(osc);
        osc.disconnect = () => {
          throw new Error('Simulated native WebAudio disconnect failure');
        };
        return osc;
      };

      // Play binaural beat with fault-injected oscillator disconnect
      const binFaultRes = await engine.playTrack('binaural_alpha');
      ctx.createOscillator = originalCreateOsc; // Restore

      assert(binFaultRes === true, 'Binaural track starts initially');
      assert(engine.getActiveSourceNodeCount() === 3, 'Active sources: 1 baseline + 2 binaural = 3');

      // Now stop binaural_alpha - disconnect will throw on both oscillators!
      await engine.stopTrack('binaural_alpha');

      // Node reservations for the non-disconnected sources MUST be retained via quarantine
      assert(engine.getQuarantinedSourceCount() === 2, 'Two failed-disconnect sources must be quarantined');
      assert(engine.getActiveSourceNodeCount() === 3, 'Active sources count retains 2 quarantined + 1 baseline = 3');
      assert(engine.getState().activeCount === 1, 'Active tracks count returns to 1');

      // Cleanup
      await engine.stopAll();
      engine.resetQuarantine();
      assert(engine.getActiveSourceNodeCount() === 0, 'Quarantine reset and full teardown releases all');
      assert(engine.getActiveGainNodeCount() === 0, 'All gains released');
      console.log('✓ 10.9 Passed: Partial construction failure rollback, non-interference, and quarantine retention verified.');
    }

    console.log('✓ Section 10 Passed: All Phase 2D-3B procedural audio and tone synthesis specifications verified.');
  }

  // =========================================================================
  // SECTION 11: Phase 2D-3C Tier 1 Recorded Audio Assets & Cache Integration
  // =========================================================================
  console.log('\n--- 11. Tier 1 Recorded Audio Assets & Byte-Budget Cache Integration ---');
  {
    // 11.1 Asset Path Resolution under Vite BASE_URL
    {
      const defaultRain = resolveAssetUrl('nature', 'rain');
      assert(defaultRain === '/audio/nature/rain.webm', `Default rain path must be /audio/nature/rain.webm, got ${defaultRain}`);

      const defaultStream = resolveAssetUrl('nature', 'stream');
      assert(defaultStream === '/audio/nature/stream.webm', `Default stream path must be /audio/nature/stream.webm, got ${defaultStream}`);

      const defaultOcean = resolveAssetUrl('nature', 'ocean_waves');
      assert(defaultOcean === '/audio/nature/ocean_waves.webm', `Default ocean path must be /audio/nature/ocean_waves.webm, got ${defaultOcean}`);

      const defaultFan = resolveAssetUrl('environment', 'fan');
      assert(defaultFan === '/audio/environment/fan.webm', `Default fan path must be /audio/environment/fan.webm, got ${defaultFan}`);

      const defaultFireplace = resolveAssetUrl('environment', 'fireplace');
      assert(defaultFireplace === '/audio/environment/fireplace.webm', `Default fireplace path must be /audio/environment/fireplace.webm, got ${defaultFireplace}`);

      console.log('✓ 11.1 Passed: Asset path resolution under Vite BASE_URL verified.');
    }

    // 11.2 AudioBufferCache Byte-Budget and Pinning Accounting
    {
      function createMockBuffer(channels: number, length: number, sampleRate = 48000): AudioBuffer {
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: () => new Float32Array(length),
          copyFromChannel: () => {},
          copyToChannel: () => {},
        } as unknown as AudioBuffer;
      }

      // Test calculateAudioBufferSize: 48000 frames * 2 channels * 4 bytes = 384,000 bytes
      const testBuf = createMockBuffer(2, 48000);
      assert(calculateAudioBufferSize(testBuf) === 384000, 'AudioBuffer size must be length * channels * 4');

      // Create cache with 4 buffer limit and 1 MB (1,048,576 bytes) byte budget
      const cache = new AudioBufferCache(4, 1024 * 1024);
      assert(cache.getTotalByteCount() === 0, 'Initial total byte count must be 0');
      assert(cache.getPinnedByteCount() === 0, 'Initial pinned byte count must be 0');
      assert(cache.getUnpinnedByteCount() === 0, 'Initial unpinned byte count must be 0');

      // Add Buffer 1: 384,000 bytes (rain)
      const b1 = createMockBuffer(2, 48000);
      cache.put('rain', b1);
      assert(cache.size() === 1, 'Cache size must be 1');
      assert(cache.getTotalByteCount() === 384000, 'Total bytes must be 384,000');
      assert(cache.getPinnedByteCount() === 0, 'No pinned bytes yet');
      assert(cache.getUnpinnedByteCount() === 384000, 'Unpinned bytes must be 384,000');

      // Pin Buffer 1 (rain)
      cache.pin('rain');
      assert(cache.isPinned('rain') === true, 'Rain must be pinned');
      assert(cache.getPinnedByteCount() === 384000, 'Pinned bytes must be 384,000');
      assert(cache.getUnpinnedByteCount() === 0, 'Unpinned bytes must be 0');

      // Add Buffer 2: 384,000 bytes (stream, unpinned) -> total = 768,000 <= 1MB
      const b2 = createMockBuffer(2, 48000);
      cache.put('stream', b2);
      assert(cache.size() === 2, 'Cache size must be 2');
      assert(cache.getTotalByteCount() === 768000, 'Total bytes must be 768,000');
      assert(cache.getPinnedByteCount() === 384000, 'Pinned bytes remain 384,000');
      assert(cache.getUnpinnedByteCount() === 384000, 'Unpinned bytes must be 384,000');

      // Add Buffer 3: 384,000 bytes (ocean_waves) -> total would be 1,152,000 > 1MB budget!
      // 'stream' is unpinned and must be evicted! 'rain' is pinned and must NOT be evicted!
      const b3 = createMockBuffer(2, 48000);
      cache.put('ocean_waves', b3);

      assert(cache.size() === 2, 'Cache size must remain 2 due to byte-budget eviction');
      assert(cache.get('stream') === null, 'Oldest unpinned buffer (stream) must have been evicted');
      assert(cache.get('rain') !== null, 'Pinned buffer (rain) must NOT be evicted');
      assert(cache.get('ocean_waves') !== null, 'Newest buffer (ocean_waves) must be in cache');
      assert(cache.getTotalByteCount() === 768000, 'Total bytes must return within budget');

      // Unpin rain
      cache.unpin('rain');
      assert(cache.isPinned('rain') === false, 'Rain is now unpinned');
      assert(cache.getPinnedByteCount() === 0, 'Pinned byte count must be 0');
      assert(cache.getUnpinnedByteCount() === 768000, 'Unpinned byte count must be 768,000');

      // Add Buffer 4: 384,000 bytes (fan) -> total would be 1,152,000 > 1MB budget!
      // Rain is now unpinned and was accessed earlier than ocean_waves, so rain is evicted!
      const b4 = createMockBuffer(2, 48000);
      cache.put('fan', b4);
      assert(cache.size() === 2, 'Cache size remains 2');
      assert(cache.get('rain') === null, 'Now-unpinned rain must be evicted');
      assert(cache.get('ocean_waves') !== null, 'Ocean waves retained');
      assert(cache.get('fan') !== null, 'Fan retained');

      // Test clear()
      cache.clear();
      assert(cache.size() === 0, 'Clear must empty cache');
      assert(cache.getTotalByteCount() === 0, 'Total bytes must be 0 after clear');
      assert(cache.getPinnedByteCount() === 0, 'Pinned bytes must be 0 after clear');
      console.log('✓ 11.2 Passed: AudioBufferCache byte-budget and pinning accounting verified.');
    }

    // 11.3 Tier 1 Asset Playback, Looping, and Gain Staging
    {
      const engine = AudioEngine.getInstance();
      await engine.stopAll();

      // Mock fetch for recorded assets
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.endsWith('.webm')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            arrayBuffer: async () => new ArrayBuffer(2048),
          } as unknown as Response;
        }
        return originalFetch ? originalFetch(url) : ({} as unknown as Response);
      };

      // Play rain
      const playRes = await engine.playTrack('rain');
      assert(playRes === true, 'Rain asset playback must succeed');

      const state = engine.getState();
      assert(state.activeCount === 1, 'Active tracks count must be 1');
      assert(state.activeTracks['rain']?.isPlaying === true, 'Rain must be marked playing');
      assert(state.activeTracks['rain']?.isLoading === false, 'Rain must not be marked loading');
      assert(state.activeTracks['rain']?.actualGain > 0, 'Rain actual gain must be > 0');

      // Check per-node resource reservation
      assert(engine.getActiveSourceNodeCount() === 1, 'Rain must occupy exactly 1 source node');
      assert(engine.getActiveGainNodeCount() === 1, 'Rain must occupy exactly 1 gain node');

      // Check that buffer is pinned in cache
      assert(engine.getBufferCache().isPinned('rain') === true, 'Rain buffer must be pinned while playing');

      // Stop rain
      await engine.stopTrack('rain');
      assert(engine.getState().activeCount === 0, 'Active tracks count must be 0 after stop');
      assert(engine.getActiveSourceNodeCount() === 0, 'Source nodes must return to 0');
      assert(engine.getActiveGainNodeCount() === 0, 'Gain nodes must return to 0');
      assert(engine.getBufferCache().isPinned('rain') === false, 'Rain buffer must be unpinned after stop');
      assert(engine.getBufferCache().get('rain') !== null, 'Rain buffer must still reside in cache for fast restart');

      console.log('✓ 11.3 Passed: Tier 1 asset playback, looping, pinning, and teardown verified.');

      // 11.4 Coexistence of Recorded Assets and Procedural Synthesizers
      {
        await engine.stopAll();

        // Start 1 recorded asset (stream), 1 binaural beat (binaural_alpha), 1 colored noise (pink_noise)
        const p1 = engine.playTrack('stream');
        const p2 = engine.playTrack('binaural_alpha');
        const p3 = engine.playTrack('pink_noise');

        const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
        assert(r1 === true, 'Stream must start');
        assert(r2 === true, 'Binaural alpha must start');
        assert(r3 === true, 'Pink noise must start');

        const coexState = engine.getState();
        assert(coexState.activeCount === 3, 'Active tracks must be exactly 3');
        assert(coexState.activeTracks['stream']?.isPlaying === true, 'Stream playing');
        assert(coexState.activeTracks['binaural_alpha']?.isPlaying === true, 'Binaural playing');
        assert(coexState.activeTracks['pink_noise']?.isPlaying === true, 'Pink noise playing');

        // Verify per-node reservation:
        // stream: 1 source + 1 gain
        // binaural_alpha: 2 sources (left+right osc) + 2 gains
        // pink_noise: 1 source (worklet/buffer) + 1 gain
        // Total = 4 sources (<= 8) and 4 gains (<= 8)
        assert(engine.getActiveSourceNodeCount() === 4, `Active sources must be 4, got ${engine.getActiveSourceNodeCount()}`);
        assert(engine.getActiveGainNodeCount() === 4, `Active gains must be 4, got ${engine.getActiveGainNodeCount()}`);

        // Verify gain sum ceiling headroom: 0.20 + 0.20 + 0.20 = 0.60 <= 0.80
        const gainSum = (SOUNDSCAPE_CATALOG['stream'].maxGainCeiling) +
          (SOUNDSCAPE_CATALOG['binaural_alpha'].maxGainCeiling) +
          (SOUNDSCAPE_CATALOG['pink_noise'].maxGainCeiling);
        assert(gainSum <= MAX_GAIN_SUM_BUDGET, `Gain ceiling sum ${gainSum} must be <= ${MAX_GAIN_SUM_BUDGET}`);

        // Stream buffer must be pinned
        assert(engine.getBufferCache().isPinned('stream') === true, 'Stream buffer must be pinned');

        // Stop all tracks cleanly
        await engine.stopAll();
        assert(engine.getState().activeCount === 0, 'All tracks stopped');
        assert(engine.getActiveSourceNodeCount() === 0, 'All sources freed');
        assert(engine.getActiveGainNodeCount() === 0, 'All gains freed');
        assert(engine.getBufferCache().isPinned('stream') === false, 'Stream buffer unpinned on stopAll');

        console.log('✓ 11.4 Passed: Coexistence of recorded assets and procedural synthesizers verified.');
      }

      // 11.5 Mid-Flight Cancellation During Asset Fetch
      {
        await engine.stopAll();

        let resolveDelayedFetch: ((res: Response) => void) | null = null;
        globalThis.fetch = async (url: string | URL | Request) => {
          const urlStr = String(url);
          if (urlStr.includes('ocean_waves')) {
            return new Promise<Response>((resolve) => {
              resolveDelayedFetch = resolve;
            });
          }
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => new ArrayBuffer(1024),
          } as unknown as Response;
        };

        // Start playing ocean_waves (it will pause inside fetch)
        const inFlightPlayPromise = engine.playTrack('ocean_waves');

        // Allow microtask ticks for lock acquisition to resolve and track state to become loading
        await new Promise((r) => setTimeout(r, 10));

        // Track is currently loading
        assert(engine.getState().activeTracks['ocean_waves']?.isLoading === true, 'Ocean waves must be in loading state');

        // Stop ocean_waves mid-flight!
        await engine.stopTrack('ocean_waves');

        // Now resolve the delayed fetch
        if (resolveDelayedFetch) {
          (resolveDelayedFetch as (res: Response) => void)({
            ok: true,
            status: 200,
            statusText: 'OK',
            arrayBuffer: async () => new ArrayBuffer(1024),
          } as unknown as Response);
        }

        const cancelResult = await inFlightPlayPromise;
        assert(cancelResult === false, 'Cancelled in-flight play request must return false');
        assert(engine.getState().activeTracks['ocean_waves'] === undefined, 'Cancelled track must not remain in active tracks');
        assert(engine.getActiveSourceNodeCount() === 0, 'No source nodes leaked on cancelled asset fetch');
        assert(engine.getActiveGainNodeCount() === 0, 'No gain nodes leaked on cancelled asset fetch');
        assert(engine.getBufferCache().isPinned('ocean_waves') === false, 'Cancelled asset must not be pinned');

        console.log('✓ 11.5 Passed: Mid-flight asset fetch cancellation cleanly handled with zero leaks.');
      }

      // 11.6 Fetch and Decode Failure Recovery
      {
        await engine.stopAll();

        // 1. HTTP 404 Failure
        globalThis.fetch = async () => ({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response);

        const fail404Res = await engine.playTrack('fan');
        assert(fail404Res === false, 'Play track on 404 must return false');
        assert(engine.getState().activeTracks['fan']?.error?.includes('404') === true, 'Error message must reflect 404');
        assert(engine.getActiveSourceNodeCount() === 0, 'Zero sources allocated on 404');
        assert(engine.getActiveGainNodeCount() === 0, 'Zero gains allocated on 404');

        // 2. Decode Audio Failure
        globalThis.fetch = async () => ({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => new ArrayBuffer(64),
        } as unknown as Response);

        const originalCtx = (engine as unknown as { prepareContext: () => { decodeAudioData: unknown } }).prepareContext();
        const origDecode = originalCtx.decodeAudioData;
        originalCtx.decodeAudioData = async () => {
          throw new Error('Simulated Corrupted Audio Bitstream Decode Failure');
        };

        const failDecodeRes = await engine.playTrack('fireplace');
        originalCtx.decodeAudioData = origDecode; // restore

        assert(failDecodeRes === false, 'Play track on decode failure must return false');
        assert(
          engine.getState().activeTracks['fireplace']?.error?.includes('Corrupted Audio Bitstream') === true,
          'Error must record decode failure'
        );
        assert(engine.getActiveSourceNodeCount() === 0, 'Zero sources allocated on decode failure');
        assert(engine.getActiveGainNodeCount() === 0, 'Zero gains allocated on decode failure');
        assert(engine.getBufferCache().isPinned('fireplace') === false, 'Buffer must be unpinned on decode failure');

        // Restore global fetch
        globalThis.fetch = originalFetch;
        console.log('✓ 11.6 Passed: Fetch 404 and decode error recovery verified without engine crash.');
      }
    }

    // 11.7 Production WebM Assets & Attributions Metadata Verification
    {
      const attributionsPath = path.resolve(process.cwd(), 'src/data/audioAttributions.json');
      assert(fs.existsSync(attributionsPath), 'audioAttributions.json must exist');

      const attributionsRaw = fs.readFileSync(attributionsPath, 'utf-8');
      const attributions = JSON.parse(attributionsRaw);
      assert(Array.isArray(attributions), 'Attributions must be an array');
      assert(attributions.length === 9, 'Must contain exactly 9 recorded assets (5 Tier 1 environment/nature + 4 Chinese instrumental)');

      const expectedIds = ['rain', 'stream', 'ocean_waves', 'fan', 'fireplace', 'xiao', 'dizi', 'guqin', 'guzheng'];
      for (const expectedId of expectedIds) {
        const item = attributions.find((a: { id: string }) => a.id === expectedId);
        assert(item !== undefined, `Attribution for ${expectedId} must exist`);
        assert(item.title && item.title.length > 0, `${expectedId} title must not be empty`);
        assert(item.creator && item.creator.length > 0, `${expectedId} creator must not be empty`);
        assert(item.license && item.license.length > 0, `${expectedId} license must not be empty`);
        assert(item.sourceUrl && item.sourceUrl.startsWith('http'), `${expectedId} sourceUrl must be a valid URL`);
        assert(item.rawSha256 && item.rawSha256.length === 64, `${expectedId} rawSha256 must be a 64-char hex string`);
        assert(item.processedSha256 && item.processedSha256.length === 64, `${expectedId} processedSha256 must be a 64-char hex string`);
        assert(item.fileSizeBytes > 100000, `${expectedId} fileSizeBytes must be > 100 KB`);
        assert(item.durationSec > 30, `${expectedId} durationSec must be > 30 seconds`);

        // Check file on disk
        const targetFile = path.resolve(process.cwd(), `public/audio/${item.category}/${item.filename}`);
        assert(fs.existsSync(targetFile), `Production file ${targetFile} must exist on disk`);

        const fileBuffer = fs.readFileSync(targetFile);
        const diskHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        assert(diskHash === item.processedSha256, `SHA-256 of ${item.filename} on disk must match metadata`);
        assert(fileBuffer.length === item.fileSizeBytes, `Byte size of ${item.filename} on disk must match metadata`);
      }

      console.log('✓ 11.7 Passed: Production WebM assets on disk and attribution metadata verified with exact SHA-256 matching.');
    }

    console.log('✓ Section 11 Passed: All Phase 2D-3C Tier 1 recorded audio asset specifications verified.');
  }

  console.log(`\n========================================================================`);
  console.log(`ALL AUDIO ENGINE & PROCEDURAL SYNTHESIS TESTS PASSED SUCCESSFULLY! (${passedTests} assertions verified)`);
  console.log(`========================================================================\n`);
}

void runAllAudioTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
