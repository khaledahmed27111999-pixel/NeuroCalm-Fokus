/**
 * NeuroCalm & Fokus — Phase 3B-4 Chinese Traditional Instrumental Test Suite
 * Validates catalog calibration, gain staging, asset file SHA-256 hashes,
 * licensing attributions, sound benefits knowledge layer, bilingual localization,
 * and audio engine playback coexistence.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SOUNDSCAPE_CATALOG, resolveAssetUrl, AudioEngine } from '../src/audio/AudioEngine';
import { SOUND_BENEFITS_DATA, getSoundBenefits } from '../src/data/soundBenefits';
import audioAttributions from '../src/data/audioAttributions.json';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { InstrumentalSoundId } from '../src/types/audio';

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

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  createGain() { return new MockGainNode(); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
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
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  async decodeAudioData() { return this.createBuffer(2, 48000 * 60, 48000); }
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
(globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel = MockBroadcastChannel;

// Mock fetch
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new ArrayBuffer(1024),
} as unknown as Response);

const INSTRUMENT_IDS: InstrumentalSoundId[] = ['xiao', 'dizi', 'guqin', 'guzheng'];

async function runChineseInstrumentalTests(): Promise<void> {
  console.log('=== NEUROCALM & FOKUS — PHASE 3B-4 CHINESE INSTRUMENTAL TEST SUITE ===\n');

  // 1. Catalog & Gain Calibration
  console.log('--- 1. Catalog Calibration & Gain Staging ---');
  {
    const expectedConfigs: Record<InstrumentalSoundId, { maxGainCeiling: number; defaultVolume: number }> = {
      xiao: { maxGainCeiling: 0.20, defaultVolume: 0.70 },
      dizi: { maxGainCeiling: 0.16, defaultVolume: 0.65 },
      guqin: { maxGainCeiling: 0.20, defaultVolume: 0.75 },
      guzheng: { maxGainCeiling: 0.18, defaultVolume: 0.70 },
    };

    let totalInstrumentGainCeiling = 0;

    for (const id of INSTRUMENT_IDS) {
      const config = SOUNDSCAPE_CATALOG[id];
      assert(config !== undefined, `Instrument '${id}' must be registered in SOUNDSCAPE_CATALOG`);
      assert(config.category === 'instrumental', `'${id}' category must be 'instrumental'`);
      assert(config.sourceType === 'asset', `'${id}' sourceType must be 'asset'`);
      assert(config.isStereo === true, `'${id}' must be stereo`);
      assert(config.maxGainCeiling === expectedConfigs[id].maxGainCeiling, `'${id}' maxGainCeiling mismatch`);
      assert(config.defaultVolume === expectedConfigs[id].defaultVolume, `'${id}' defaultVolume mismatch`);
      totalInstrumentGainCeiling += config.maxGainCeiling;
    }

    // All 4 instruments combined must never exceed MAX_GAIN_SUM_BUDGET (0.80)
    assert(
      totalInstrumentGainCeiling <= 0.80,
      `Sum of all 4 instrument gain ceilings (${totalInstrumentGainCeiling}) must be <= 0.80`
    );
    console.log(`✓ 1.1 Passed: All 4 instruments cataloged. Total simultaneous gain: ${totalInstrumentGainCeiling.toFixed(2)} <= 0.80.`);
  }

  // 2. Asset Path Resolution
  console.log('\n--- 2. Asset URL Resolution ---');
  {
    for (const id of INSTRUMENT_IDS) {
      const url = resolveAssetUrl('instrumental', id);
      assert(url === `/audio/instrumental/${id}.webm`, `Resolved URL for ${id} must be /audio/instrumental/${id}.webm (got ${url})`);
    }
    console.log('✓ 2.1 Passed: All 4 instrumental asset URLs resolve to /audio/instrumental/*.webm.');
  }

  // 3. Asset Files on Disk & SHA-256 Hashes
  console.log('\n--- 3. Production WebM Assets on Disk & SHA-256 Hashes ---');
  {
    const expectedHashes: Record<InstrumentalSoundId, { sha256: string; size: number }> = {
      xiao: {
        sha256: '2ff466e041e69634a32cb4d9d5c0f668f69aa7f33b882543690b8853f29d6029',
        size: 889710,
      },
      dizi: {
        sha256: '45a64733f8b2ca6119ec2f488a9dac500bd01a48464d2cd8580ec55df5fc37cb',
        size: 459886,
      },
      guqin: {
        sha256: '45e81fce94a1e63000f15d0ec53e20108093059afa18b05791ae71a6b5f831a6',
        size: 937728,
      },
      guzheng: {
        sha256: 'e9792641f0e369f97e3562af0a8d9d46bfb8ed1031c5b8528d23d4f4bbb3de94',
        size: 789646,
      },
    };

    for (const id of INSTRUMENT_IDS) {
      const filePath = path.resolve(process.cwd(), `public/audio/instrumental/${id}.webm`);
      assert(fs.existsSync(filePath), `Asset file ${filePath} must exist on disk`);

      const buf = fs.readFileSync(filePath);
      assert(buf.length === expectedHashes[id].size, `Byte size mismatch for ${id}.webm: expected ${expectedHashes[id].size}, got ${buf.length}`);

      const computedSha = crypto.createHash('sha256').update(buf).digest('hex');
      assert(computedSha === expectedHashes[id].sha256, `SHA-256 mismatch for ${id}.webm: expected ${expectedHashes[id].sha256}, got ${computedSha}`);
    }
    console.log('✓ 3.1 Passed: All 4 production WebM files verified on disk with exact byte counts and SHA-256 hashes.');
  }

  // 4. Attributions & Licensing Integrity
  console.log('\n--- 4. Audio Attributions & Licensing Metadata ---');
  {
    const expectedRawHashes: Record<InstrumentalSoundId, string> = {
      xiao: '5fe56306aa61f971fd5ffa6b387786af3315d88a05fb6cae6424f459aa003b66',
      dizi: 'bef7e7d2b25c3c4d4a5c47c09f48082928c8766260b6d41536d68c5dad89fd60',
      guqin: 'e71a8ac2d5b4d165ee3e02da84f654412e05f1296f8987e663c3d2c70bdbaf6e',
      guzheng: '96f9ce7b1a1e9e48c03ce6f37a5690a0cc85960d36b6298d4ec5bcf32877bfc7',
    };

    const expectedCreators: Record<InstrumentalSoundId, string> = {
      xiao: 'xserra',
      dizi: 'CarlosCarty',
      guqin: 'xserra',
      guzheng: 'xserra',
    };

    for (const id of INSTRUMENT_IDS) {
      const item = audioAttributions.find((a: { id: string }) => a.id === id);
      assert(item !== undefined, `Attribution entry for '${id}' must exist in audioAttributions.json`);
      assert(item.category === 'instrumental', `'${id}' attribution category must be 'instrumental'`);
      assert(item.licenseType === 'CC-BY-4.0', `'${id}' licenseType must be CC-BY-4.0`);
      assert(item.creator === expectedCreators[id], `'${id}' creator must be ${expectedCreators[id]}`);
      assert(item.rawSha256 === expectedRawHashes[id], `'${id}' rawSha256 must match recorded raw archive hash`);
      assert(item.processedSha256.length === 64, `'${id}' processedSha256 must be valid hex`);
      assert(item.sourceUrl.startsWith('https://freesound.org/'), `'${id}' sourceUrl must be an authentic Freesound URL`);
      assert(item.durationSec > 25, `'${id}' durationSec must be > 25 seconds`);
    }
    console.log('✓ 4.1 Passed: All 4 attributions fully compliant with CC-BY 4.0 terms, sources, and hashes.');
  }

  // 5. Sound Benefits Knowledge Layer Integrity (Qualitative Categories Only)
  console.log('\n--- 5. Qualitative Information & Tier Isolation Integrity ---');
  {
    const ARABIC_REGEX = /[\u0600-\u06FF]/;
    const FORBIDDEN_WORDS = [
      'cure', 'heal', 'disease', 'medical', 'prescription', 'fda',
      'autonomic', 'sympathetic', 'reactivity', 'deceleration', 'workload'
    ];

    for (const id of INSTRUMENT_IDS) {
      const entry = getSoundBenefits(id);
      assert(entry !== null, `Benefits entry for '${id}' must exist`);
      assert(entry?.soundId === id, `'${id}' benefits soundId must match`);

      // Strictly verify ZERO scientific evidence tiers for traditional instruments
      assert(entry?.supported === undefined, `'${id}' must NOT contain 'supported' scientific tier`);
      assert(entry?.promising === undefined, `'${id}' must NOT contain 'promising' scientific tier`);
      assert(entry?.potential === undefined, `'${id}' must NOT contain 'potential' scientific tier`);

      // Verify all 3 qualitative categories populated
      assert(Boolean(entry?.soundCharacter && entry.soundCharacter.length > 0), `'${id}' must have soundCharacter`);
      assert(Boolean(entry?.listeningExperience && entry.listeningExperience.length > 0), `'${id}' must have listeningExperience`);
      assert(Boolean(entry?.suitableContexts && entry.suitableContexts.length > 0), `'${id}' must have suitableContexts`);

      const allItems = [
        ...(entry?.soundCharacter ?? []),
        ...(entry?.listeningExperience ?? []),
        ...(entry?.suitableContexts ?? []),
      ];
      for (const item of allItems) {
        assert(item.en.trim().length >= 20, `'${id}' English description too short`);
        assert(item.ar.trim().length >= 15, `'${id}' Arabic description too short`);
        assert(ARABIC_REGEX.test(item.ar), `'${id}' Arabic text must contain valid Arabic script`);

        for (const bad of FORBIDDEN_WORDS) {
          assert(!item.en.toLowerCase().includes(bad), `Forbidden word '${bad}' found in ${id}: ${item.en}`);
        }
      }
    }
    console.log('✓ 5.1 Passed: Qualitative categories (Sound Character, Listening Experience, Suitable Contexts) verified with strict zero-scientific-tier isolation.');
  }

  // 6. Bilingual Localization & RTL Parity
  console.log('\n--- 6. Bilingual Localization & RTL Parity ---');
  {
    const keysToCheck = [
      'mixerCategoryInstrumental',
      'soundXiao', 'soundXiaoDesc',
      'soundDizi', 'soundDiziDesc',
      'soundGuqin', 'soundGuqinDesc',
      'soundGuzheng', 'soundGuzhengDesc',
      'instrumentalSoundCharacter',
      'instrumentalListeningExperience',
      'instrumentalSuitableContexts',
      'instrumentalToggleOpen',
      'instrumentalToggleClose',
      'instrumentalDisclaimer',
    ];

    for (const key of keysToCheck) {
      const enVal = (en as Record<string, string>)[key];
      const arVal = (ar as Record<string, string>)[key];
      assert(Boolean(enVal && enVal.trim().length > 0), `Key '${key}' missing or empty in en.ts`);
      assert(Boolean(arVal && arVal.trim().length > 0), `Key '${key}' missing or empty in ar.ts`);
      assert(/[\u0600-\u06FF]/.test(arVal), `Arabic translation for '${key}' must contain Arabic text`);
    }
    console.log(`✓ 6.1 Passed: Full bilingual parity verified across all instrumental keys.`);
  }

  // 7. AudioEngine Playback Lifecycle & Coexistence
  console.log('\n--- 7. AudioEngine Playback Lifecycle & Multi-Track Coexistence ---');
  {
    const engine = AudioEngine.getInstance();

    // Reset state
    await engine.stopAll();
    assert(engine.getState().activeCount === 0, 'Active count must be 0 after stopAll');

    // Play Xiao (instrumental)
    const xiaoSuccess = await engine.playTrack('xiao');
    assert(xiaoSuccess === true, 'Playing xiao must succeed');
    assert(engine.getState().activeTracks['xiao']?.isPlaying === true, 'Xiao must be reported as playing');
    assert(engine.getState().activeCount === 1, 'Active count must be 1');

    // Play Rain (nature asset) alongside Xiao
    const rainSuccess = await engine.playTrack('rain');
    assert(rainSuccess === true, 'Playing rain alongside xiao must succeed');
    assert(engine.getState().activeCount === 2, 'Active count must be 2');

    // Play Binaural Alpha (procedural synthesis) alongside Xiao and Rain
    const toneSuccess = await engine.playTrack('binaural_alpha');
    assert(toneSuccess === true, 'Playing binaural_alpha alongside xiao and rain must succeed');
    assert(engine.getState().activeCount === 3, 'Active count must be 3');

    // Play Guzheng (second instrument)
    const guzhengSuccess = await engine.playTrack('guzheng');
    assert(guzhengSuccess === true, 'Playing guzheng alongside other tracks must succeed');
    assert(engine.getState().activeCount === 4, 'Active count must be 4');

    // Attempting a 5th track must be rejected by the 4-track ceiling
    const fifthTrack = await engine.playTrack('dizi');
    assert(fifthTrack === false, '5th track must be rejected by 4-track ceiling');
    assert(engine.getState().activeCount === 4, 'Active count must remain 4');

    // Adjust volume on Xiao
    engine.setTrackVolume('xiao', 0.5);
    assert(engine.getState().activeTracks['xiao']?.volume === 0.5, 'Xiao volume must be updated to 0.5');

    // Stop Xiao independently
    await engine.stopTrack('xiao');
    assert(engine.getState().activeTracks['xiao'] === undefined, 'Xiao must be stopped and removed from active tracks');
    assert(engine.getState().activeCount === 3, 'Active count must be 3 after stopping xiao');
    assert(engine.getState().activeTracks['rain']?.isPlaying === true, 'Rain must continue playing uninterrupted');
    assert(engine.getState().activeTracks['guzheng']?.isPlaying === true, 'Guzheng must continue playing uninterrupted');

    // Stop all tracks cleanly
    await engine.stopAll();
    assert(engine.getState().activeCount === 0, 'Active count must be 0 after stopAll');
    assert(engine.getState().activeTracks['rain'] === undefined, 'Rain must be stopped');
    assert(engine.getState().activeTracks['guzheng'] === undefined, 'Guzheng must be stopped');

    console.log('✓ 7.1 Passed: Multi-track coexistence (instrumental + nature + procedural), 4-track ceiling, and clean teardown verified.');
  }

  console.log(`\n========================================================================`);
  console.log(`ALL PHASE 3B-4 CHINESE INSTRUMENTAL TESTS PASSED! (${passedTests} assertions verified)`);
  console.log(`========================================================================\n`);
}

void runChineseInstrumentalTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
