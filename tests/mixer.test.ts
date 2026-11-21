/**
 * NeuroCalm & Fokus — Phase 2D-3D Soundscape Mixer & Preset Acceptance Test Suite
 * Validates sound selection, active track management, volume synchronization,
 * preset persistence, malformed data safety, and bilingual localization integrity.
 */

import {
  getAllPresets,
  BUILT_IN_PRESETS,
  saveCustomPreset,
  deleteCustomPreset,
  loadCustomPresets,
  clearCustomPresets,
  PRESETS_STORAGE_KEY,
} from '../src/storage/soundscapePresetsStorage';
import {
  AudioEngine,
  SOUNDSCAPE_CATALOG,
  MAX_SIMULTANEOUS_TRACKS,
} from '../src/audio/AudioEngine';
import {
  loadAudioSettings,
  saveAudioSettings,
  clearAudioSettings,
} from '../src/storage/audioStorage';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import audioAttributions from '../src/data/audioAttributions.json';
import type { SoundscapeId } from '../src/types/audio';

let passedTests = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    throw new Error(`TEST FAILED: ${msg}`);
  }
  passedTests++;
}

// In-memory mock localStorage for Node.js test environment
const mockStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => { mockStorage.set(key, String(val)); },
  removeItem: (key: string) => { mockStorage.delete(key); },
  clear: () => { mockStorage.clear(); },
};
(globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;

// Mock Web Audio Context
class MockGainNode {
  gain = {
    value: 1.0,
    setValueAtTime: (val: number) => { this.gain.value = val; },
    exponentialRampToValueAtTime: (val: number) => { this.gain.value = val; },
  };
  connectedTo: unknown[] = [];
  connect(target: unknown) { this.connectedTo.push(target); }
  disconnect() { this.connectedTo = []; }
}

class MockAudioBufferSourceNode {
  buffer: unknown = null;
  loop = false;
  connectedTo: unknown[] = [];
  start() {}
  stop() {}
  connect(target: unknown) { this.connectedTo.push(target); }
  disconnect() { this.connectedTo = []; }
}

class MockDynamicsCompressorNode {
  threshold = { setValueAtTime: () => {} };
  knee = { setValueAtTime: () => {} };
  ratio = { setValueAtTime: () => {} };
  attack = { setValueAtTime: () => {} };
  release = { setValueAtTime: () => {} };
  connectedTo: unknown[] = [];
  connect(target: unknown) { this.connectedTo.push(target); }
  disconnect() { this.connectedTo = []; }
}

class MockAudioWorkletNode {
  parameters = new Map<string, { setValueAtTime: (val: number) => void }>([
    ['noiseType', { setValueAtTime: () => {} }],
  ]);
  port = { postMessage: () => {}, onmessage: null };
  connectedTo: unknown[] = [];
  connect(target: unknown) { this.connectedTo.push(target); }
  disconnect() { this.connectedTo = []; }
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  audioWorklet = {
    addModule: async () => true,
  };
  createGain() { return new MockGainNode(); }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode(); }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440, setValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createChannelMerger(_inputs = 2) {
    return {
      connectedTo: [],
      connect: () => {},
      disconnect: () => {},
    };
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  async decodeAudioData() { return this.createBuffer(2, 48000, 48000); }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}

class MockBroadcastChannel {
  name: string;
  onmessage: unknown = null;
  constructor(name: string) { this.name = name; }
  postMessage() {}
  close() {}
}

(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
(globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = MockAudioWorkletNode;
(globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel = MockBroadcastChannel;

// Mock fetch
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new ArrayBuffer(1024),
} as unknown as Response);

async function runMixerTests(): Promise<void> {
  console.log('=== NEUROCALM & FOKUS — PHASE 2D-3D SOUNDSCAPE MIXER TEST SUITE ===\n');

  // 1. Modality Catalog & Classification
  console.log('--- 1. Modality Catalog & Classification Verification ---');
  {
    const expectedModalities: SoundscapeId[] = [
      'rain', 'stream', 'ocean_waves', 'fan', 'fireplace',
      'white_noise', 'pink_noise', 'brown_noise', 'violet_noise',
      'binaural_delta', 'binaural_theta', 'binaural_alpha', 'binaural_beta', 'binaural_gamma',
      'monaural_alpha', 'isochronic_alpha', 'isochronic_theta',
      'xiao', 'dizi', 'guqin', 'guzheng',
    ];

    for (const id of expectedModalities) {
      const config = SOUNDSCAPE_CATALOG[id];
      assert(config !== undefined, `Modality '${id}' must exist in SOUNDSCAPE_CATALOG`);
      assert(config.maxGainCeiling <= 0.20, `'${id}' maxGainCeiling must be <= 0.20`);
      assert(config.defaultVolume >= 0.5 && config.defaultVolume <= 1.0, `'${id}' defaultVolume must be safe`);

      if (id.startsWith('binaural_')) {
        assert(config.headphoneRequired === true, `Binaural beat '${id}' must flag headphoneRequired`);
        assert(config.isStereo === true, `Binaural beat '${id}' must be stereo`);
      }
    }
    console.log(`✓ 1.1 Passed: All 21 available audio modalities verified in catalog.`);
  }

  // 2. Preset Storage & Persistence
  console.log('\n--- 2. Soundscape Preset Storage & Persistence Tests ---');
  {
    clearCustomPresets();

    // 2.1 Built-in Presets
    const initialPresets = getAllPresets();
    assert(initialPresets.length === 4, 'Must contain exactly 4 default built-in presets');

    const deepFocus = initialPresets.find((p) => p.id === 'deep_focus');
    assert(deepFocus !== undefined, 'Deep Focus preset must exist');
    assert(deepFocus?.tracks.length === 3, 'Deep Focus must have 3 tracks');
    assert(deepFocus?.tracks.some((t) => t.soundId === 'rain') === true, 'Deep focus includes rain');
    assert(deepFocus?.tracks.some((t) => t.soundId === 'brown_noise') === true, 'Deep focus includes brown noise');
    assert(deepFocus?.tracks.some((t) => t.soundId === 'binaural_beta') === true, 'Deep focus includes binaural beta');

    // 2.2 Saving a Custom Preset
    const saved = saveCustomPreset('Night Rain & Calm', [
      { soundId: 'rain', volume: 0.8 },
      { soundId: 'stream', volume: 0.6 },
    ]);
    assert(saved !== null, 'Custom preset must be saved');
    assert(saved?.name === 'Night Rain & Calm', 'Preset name must match');
    assert(saved?.tracks.length === 2, 'Preset tracks count must match');

    // Verify persistence across reload
    const reloaded = loadCustomPresets();
    assert(reloaded.length === 1, 'Custom presets reloaded from storage');
    assert(reloaded[0].id === saved?.id, 'Custom preset ID preserved');

    // All presets includes built-in + custom
    const all = getAllPresets();
    assert(all.length === 5, '5 total presets (4 built-in + 1 custom)');

    // 2.3 Built-in preset cannot be deleted
    const deleteBuiltIn = deleteCustomPreset('deep_focus');
    assert(deleteBuiltIn === false, 'Cannot delete built-in preset');
    assert(getAllPresets().length === 5, 'Built-in preset remains intact');

    // 2.4 Deleting a Custom Preset
    const deleteCustom = deleteCustomPreset(saved!.id);
    assert(deleteCustom === true, 'Custom preset must be deleted');
    assert(loadCustomPresets().length === 0, 'Custom presets list is now empty');
    assert(getAllPresets().length === 4, 'Returns to 4 built-in presets');

    // 2.5 Defensive Validation & Malformed Data Handling
    mockLocalStorage.setItem(
      PRESETS_STORAGE_KEY,
      JSON.stringify([
        null,
        'not-an-object',
        { id: 'corrupt_1', name: 'Corrupt', tracks: 'not-an-array' },
        {
          id: 'valid_rescued',
          name: 'Rescued Preset',
          tracks: [
            { soundId: 'rain', volume: 15.0 }, // must clamp to 1.0
            { soundId: 'invalid_xyz', volume: 0.5 }, // dropped
            { soundId: 'fan', volume: -5.0 }, // must clamp to 0.0
          ],
        },
      ])
    );

    const safeLoaded = loadCustomPresets();
    assert(safeLoaded.length === 1, 'Safely filtered corrupted entries, keeping valid rescued');
    assert(safeLoaded[0].name === 'Rescued Preset', 'Rescued preset name preserved');
    assert(safeLoaded[0].tracks.length === 2, 'Dropped invalid_xyz track');
    assert(safeLoaded[0].tracks[0].volume === 1.0, 'Volume 15.0 clamped to 1.0');
    assert(safeLoaded[0].tracks[1].volume === 0.0, 'Volume -5.0 clamped to 0.0');

    // Non-JSON corrupted string
    mockLocalStorage.setItem(PRESETS_STORAGE_KEY, '{invalid-json{{{');
    assert(loadCustomPresets().length === 0, 'Malformed JSON returns empty array without throwing');

    clearCustomPresets();
    console.log('✓ 2.1 Passed: Soundscape preset creation, reload, deletion, and defensive validation verified.');
  }

  // 3. Audio Engine & Mixer State Synchronization
  console.log('\n--- 3. Audio Engine & Mixer State Synchronization Tests ---');
  {
    const engine = AudioEngine.getInstance();
    await engine.stopAll();

    // Initial state
    assert(engine.getState().activeCount === 0, 'Initial activeCount is 0');
    assert(Object.keys(engine.getState().activeTracks).length === 0, 'No active tracks initially');

    // Start 1 track (rain)
    const rainStarted = await engine.playTrack('rain');
    assert(rainStarted === true, 'Rain started successfully');
    assert(engine.getState().activeCount === 1, 'activeCount is 1');
    assert(engine.getState().activeTracks['rain']?.isPlaying === true, 'Rain marked isPlaying');

    // Volume adjustment
    engine.setTrackVolume('rain', 0.85);
    assert(engine.getState().activeTracks['rain']?.volume === 0.85, 'Track volume updated to 0.85');
    const settings = loadAudioSettings();
    assert(settings.trackVolumes['rain'] === 0.85, 'Track volume persisted to storage');

    // Master volume & mute
    engine.setMasterVolume(0.9);
    assert(engine.getState().masterVolume === 0.9, 'Master volume updated to 0.9');
    assert(loadAudioSettings().masterVolume === 0.9, 'Master volume persisted to storage');

    engine.toggleMute();
    assert(engine.getState().isMuted === true, 'isMuted is true');
    engine.toggleMute();
    assert(engine.getState().isMuted === false, 'isMuted restored to false');

    // Start 2 more tracks (ocean_waves + pink_noise)
    await engine.playTrack('ocean_waves');
    await engine.playTrack('pink_noise');
    assert(engine.getState().activeCount === 3, 'activeCount is 3');

    // Start 4th track (binaural_alpha) -> reaches limit of 4
    await engine.playTrack('binaural_alpha');
    assert(engine.getState().activeCount === 4, 'activeCount is 4 (limit reached)');

    // Attempt to start a 5th track (fan) -> must be rejected cleanly
    const fanAttempt = await engine.playTrack('fan');
    assert(fanAttempt === false, '5th track rejected by concurrency ceiling');
    assert(engine.getState().activeCount === 4, 'activeCount remains 4');
    assert(engine.getState().activeTracks['fan'] === undefined, 'Fan not added to active tracks');
    assert(
      engine.getState().conflictError?.includes('Maximum of 4') === true,
      'Conflict error set explaining 4-track limit'
    );

    // Clear conflict error
    engine.clearConflictError();
    assert(engine.getState().conflictError === null, 'Conflict error cleared');

    // Stop 1 track (rain) -> frees slot
    await engine.stopTrack('rain');
    assert(engine.getState().activeCount === 3, 'activeCount reduced to 3');
    assert(engine.getState().activeTracks['rain'] === undefined, 'Rain removed from active tracks');

    // Now starting fan succeeds
    const fanRetry = await engine.playTrack('fan');
    assert(fanRetry === true, 'Fan succeeds once a slot was freed');
    assert(engine.getState().activeCount === 4, 'activeCount back to 4');

    // Stop all tracks
    await engine.stopAll();
    assert(engine.getState().activeCount === 0, 'activeCount is 0 after stopAll');
    assert(Object.keys(engine.getState().activeTracks).length === 0, 'All tracks removed');

    console.log('✓ 3.1 Passed: Track start/stop, volume sync, master volume, and 4-track limit verified.');
  }

  // 4. Bilingual Localization & RTL Integrity
  console.log('\n--- 4. Bilingual Localization & RTL Integrity Tests ---');
  {
    const enKeys = Object.keys(en);
    const arKeys = Object.keys(ar);

    assert(enKeys.length === arKeys.length, `Locale key count mismatch: EN has ${enKeys.length}, AR has ${arKeys.length}`);

    // Check all mixer-related translation keys
    const requiredMixerKeys = [
      'mixerTitle', 'mixerSubtitle', 'mixerMasterVolume', 'mixerMuteAll', 'mixerUnmuteAll',
      'mixerStopAll', 'mixerActiveTracksTitle', 'mixerActiveTracksCount', 'mixerMaxTracksReached',
      'mixerEmptyActiveTitle', 'mixerEmptyActiveDesc', 'mixerCategoriesTitle', 'mixerCategoryAll',
      'mixerCategoryNature', 'mixerCategoryEnvironment', 'mixerCategoryNoise', 'mixerCategoryTonal', 'mixerCategoryInstrumental',
      'mixerSoundPlay', 'mixerSoundStop', 'mixerSoundActive', 'mixerSoundLoading', 'mixerSoundError',
      'mixerHeadphonesRequired', 'mixerSpeakersOrHeadphones', 'mixerPresetsTitle',
      'mixerPresetSaveButton', 'mixerPresetSaveTitle', 'mixerPresetNamePrompt',
      'mixerPresetNamePlaceholder', 'mixerPresetDelete', 'mixerCreditsButton',
      'mixerCreditsTitle', 'mixerCreditsSubtitle', 'mixerCreditsClose',
      'mixerNowPlaying', 'mixerOpenMixer',
      'presetDeepFocus', 'presetGentleCalm', 'presetCozyEvening', 'presetSteadyMasking',
      'soundRain', 'soundRainDesc', 'soundStream', 'soundStreamDesc',
      'soundOceanWaves', 'soundOceanWavesDesc', 'soundFan', 'soundFanDesc',
      'soundFireplace', 'soundFireplaceDesc', 'soundWhiteNoise', 'soundWhiteNoiseDesc',
      'soundPinkNoise', 'soundPinkNoiseDesc', 'soundBrownNoise', 'soundBrownNoiseDesc',
      'soundVioletNoise', 'soundVioletNoiseDesc', 'soundBinauralDelta', 'soundBinauralDeltaDesc',
      'soundBinauralTheta', 'soundBinauralThetaDesc', 'soundBinauralAlpha', 'soundBinauralAlphaDesc',
      'soundBinauralBeta', 'soundBinauralBetaDesc', 'soundBinauralGamma', 'soundBinauralGammaDesc',
      'soundMonauralAlpha', 'soundMonauralAlphaDesc', 'soundIsochronicAlpha', 'soundIsochronicAlphaDesc',
      'soundIsochronicTheta', 'soundIsochronicThetaDesc',
      'soundXiao', 'soundXiaoDesc', 'soundDizi', 'soundDiziDesc',
      'soundGuqin', 'soundGuqinDesc', 'soundGuzheng', 'soundGuzhengDesc',
    ];

    for (const key of requiredMixerKeys) {
      assert(key in en, `Key '${key}' missing in English translation dictionary`);
      assert(key in ar, `Key '${key}' missing in Arabic translation dictionary`);
      assert((en as Record<string, string>)[key].trim().length > 0, `English text for '${key}' must not be empty`);
      assert((ar as Record<string, string>)[key].trim().length > 0, `Arabic text for '${key}' must not be empty`);
    }

    console.log(`✓ 4.1 Passed: 100% complete bilingual parity verified across all ${requiredMixerKeys.length} mixer keys.`);
  }

  // 5. Audio Attributions Metadata Integrity
  console.log('\n--- 5. Audio Attributions Metadata Integrity Tests ---');
  {
    assert(Array.isArray(audioAttributions), 'Attributions must be an array');
    assert(audioAttributions.length === 9, 'Must contain all 9 recorded assets (5 environment/nature + 4 Chinese instrumental)');

    for (const item of audioAttributions) {
      assert(item.id.length > 0, 'Attribution id must not be empty');
      assert(item.name.length > 0, 'Attribution name must not be empty');
      assert(item.title.length > 0, 'Attribution title must not be empty');
      assert(item.creator.length > 0, 'Attribution creator must not be empty');
      assert(item.license.length > 0, 'Attribution license must not be empty');
      assert(item.sourceUrl.startsWith('http'), 'Attribution sourceUrl must be an HTTP URL');
      assert(item.processedSha256.length === 64, 'Attribution processedSha256 must be a 64-char hex string');
    }

    console.log('✓ 5.1 Passed: Audio attributions metadata integrity verified.');
  }

  console.log(`\n========================================================================`);
  console.log(`ALL PHASE 2D-3D SOUNDSCAPE MIXER TESTS PASSED! (${passedTests} assertions verified)`);
  console.log(`========================================================================\n`);
}

void runMixerTests().catch((err) => {
  console.error('Mixer Test Suite Failed:', err);
  process.exit(1);
});
