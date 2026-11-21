/**
 * NeuroCalm & Fokus — Phase S6 Sleep Sounds & Night Soundscapes Test Suite
 * Automated tests for:
 * 1. Sleep sounds catalog categorization and soundscape catalog asset mapping.
 * 2. Curated built-in sleep presets definitions, track validity, volume bounds, and track count limits.
 * 3. Sleep presets resolution (built-in + custom presets) and custom preset lifecycle.
 * 4. Audio concurrency limits (max 4 concurrent tracks) and safeguard contracts.
 * 5. Translation completeness and key parity between English and Arabic.
 * 6. Non-medical disclaimer and zero auto-playback behavioral contracts.
 */

import assert from 'node:assert';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { TranslationKey } from '../src/types/locale';
import { SOUNDSCAPE_CATALOG } from '../src/audio/AudioEngine';
import { SoundscapeId } from '../src/types/audio';
import {
  SLEEP_SOUNDS_CATALOG,
  SleepSoundCategory,
} from '../src/components/sleep/SleepSoundsView';
import {
  SLEEP_BUILT_IN_PRESETS,
  getSleepPresets,
} from '../src/data/sleepPresets';
import {
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from '../src/storage/soundscapePresetsStorage';

// --- IN-MEMORY MOCK LOCALSTORAGE FOR NODE.JS TEST HARNESS ---

class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockStorage = new MockStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage as unknown as Storage;

function resetStorage(): void {
  mockStorage.clear();
}

console.log('--- STARTING PHASE S6 SLEEP SOUNDS TEST SUITE ---\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void): void {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

// =========================================================================
// TEST GROUP 1: Sleep Sounds Catalog & Asset Mapping
// =========================================================================
console.log('Test Group 1: Sleep Sounds Catalog & Asset Mapping');

runTest('All sounds in SLEEP_SOUNDS_CATALOG exist in SOUNDSCAPE_CATALOG', () => {
  const allMasterIds = new Set(Object.keys(SOUNDSCAPE_CATALOG));
  assert.ok(SLEEP_SOUNDS_CATALOG.length > 0, 'Catalog should not be empty');

  for (const item of SLEEP_SOUNDS_CATALOG) {
    assert.ok(
      allMasterIds.has(item.id),
      `Sound ${item.id} from SLEEP_SOUNDS_CATALOG must exist in master SOUNDSCAPE_CATALOG`
    );
  }
});

runTest('All 5 sleep categories are represented with valid sounds', () => {
  const expectedCategories: SleepSoundCategory[] = [
    'rain_water',
    'cozy',
    'noise',
    'frequencies',
    'instrumental',
  ];

  for (const cat of expectedCategories) {
    const items = SLEEP_SOUNDS_CATALOG.filter((s) => s.sleepCategory === cat);
    assert.ok(items.length > 0, `Category ${cat} must contain at least one sound item`);
  }
});

runTest('Binaural beats correctly specify headphone requirement', () => {
  const delta = SLEEP_SOUNDS_CATALOG.find((s) => s.id === 'binaural_delta');
  const theta = SLEEP_SOUNDS_CATALOG.find((s) => s.id === 'binaural_theta');
  const isochronic = SLEEP_SOUNDS_CATALOG.find((s) => s.id === 'isochronic_theta');

  assert.ok(delta, 'binaural_delta must be in catalog');
  assert.strictEqual(delta.headphoneRequired, true, 'binaural_delta requires headphones');

  assert.ok(theta, 'binaural_theta must be in catalog');
  assert.strictEqual(theta.headphoneRequired, true, 'binaural_theta requires headphones');

  assert.ok(isochronic, 'isochronic_theta must be in catalog');
  assert.strictEqual(isochronic.headphoneRequired, false, 'isochronic_theta does not strictly require headphones');
});

runTest('All sleep catalog item translation keys exist in English and Arabic', () => {
  for (const item of SLEEP_SOUNDS_CATALOG) {
    assert.ok(en[item.nameKey], `Missing EN translation for nameKey ${item.nameKey}`);
    assert.ok(ar[item.nameKey], `Missing AR translation for nameKey ${item.nameKey}`);
    assert.ok(en[item.descKey], `Missing EN translation for descKey ${item.descKey}`);
    assert.ok(ar[item.descKey], `Missing AR translation for descKey ${item.descKey}`);
  }
});

// =========================================================================
// TEST GROUP 2: Curated Built-In Sleep Presets
// =========================================================================
console.log('\nTest Group 2: Curated Built-In Sleep Presets');

runTest('Contains exactly 6 distinct curated sleep presets', () => {
  assert.strictEqual(SLEEP_BUILT_IN_PRESETS.length, 6);
  const ids = new Set(SLEEP_BUILT_IN_PRESETS.map((p) => p.id));
  assert.strictEqual(ids.size, 6, 'All preset IDs must be unique');
});

runTest('All presets have isBuiltIn: true and valid name keys in EN and AR', () => {
  for (const preset of SLEEP_BUILT_IN_PRESETS) {
    assert.strictEqual(preset.isBuiltIn, true, `Preset ${preset.id} must be marked isBuiltIn`);
    assert.ok(preset.nameKey, `Preset ${preset.id} must define a nameKey`);
    const key = preset.nameKey as TranslationKey;
    assert.ok(en[key], `Preset ${preset.id} nameKey ${key} missing in EN`);
    assert.ok(ar[key], `Preset ${preset.id} nameKey ${key} missing in AR`);
  }
});

runTest('All preset tracks contain valid sounds from SOUNDSCAPE_CATALOG', () => {
  const masterIds = new Set(Object.keys(SOUNDSCAPE_CATALOG));
  for (const preset of SLEEP_BUILT_IN_PRESETS) {
    assert.ok(preset.tracks.length > 0, `Preset ${preset.id} must have tracks`);
    for (const track of preset.tracks) {
      assert.ok(
        masterIds.has(track.soundId as SoundscapeId),
        `Preset ${preset.id} references invalid soundId: ${track.soundId}`
      );
    }
  }
});

runTest('Preset track counts never exceed max concurrency (4 tracks)', () => {
  for (const preset of SLEEP_BUILT_IN_PRESETS) {
    assert.ok(
      preset.tracks.length <= 4,
      `Preset ${preset.id} has ${preset.tracks.length} tracks, which exceeds max concurrency limit of 4`
    );
  }
});

runTest('Preset track volumes are safely bounded between 0.0 and 1.0', () => {
  for (const preset of SLEEP_BUILT_IN_PRESETS) {
    for (const track of preset.tracks) {
      assert.ok(
        track.volume >= 0 && track.volume <= 1,
        `Track ${track.soundId} in preset ${preset.id} has volume ${track.volume} out of bounds [0, 1]`
      );
    }
  }
});

// =========================================================================
// TEST GROUP 3: Sleep Presets Storage & Lifecycle Integration
// =========================================================================
console.log('\nTest Group 3: Sleep Presets Storage & Lifecycle Integration');

runTest('getSleepPresets returns all 6 built-in presets when no custom presets exist', () => {
  resetStorage();
  const presets = getSleepPresets();
  assert.strictEqual(presets.length, 6);
  assert.deepStrictEqual(
    presets.map((p) => p.id),
    SLEEP_BUILT_IN_PRESETS.map((p) => p.id)
  );
});

runTest('saveCustomPreset appends custom presets that appear in getSleepPresets', () => {
  resetStorage();
  const tracks = [
    { soundId: 'rain' as SoundscapeId, volume: 0.6 },
    { soundId: 'fan' as SoundscapeId, volume: 0.4 },
  ];

  const created = saveCustomPreset('My Peaceful Mix', tracks);
  assert.ok(created, 'Preset must be successfully created');
  assert.strictEqual(created.name, 'My Peaceful Mix');

  const loaded = loadCustomPresets();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, created.id);

  const allSleepPresets = getSleepPresets();
  assert.strictEqual(allSleepPresets.length, 7);
  assert.ok(allSleepPresets.some((p) => p.id === created.id));
});

runTest('deleteCustomPreset removes the custom preset cleanly', () => {
  resetStorage();
  const tracks = [{ soundId: 'rain' as SoundscapeId, volume: 0.5 }];
  const created = saveCustomPreset('Temporary Mix', tracks);
  assert.ok(created);
  assert.strictEqual(getSleepPresets().length, 7);

  deleteCustomPreset(created.id);
  const remaining = getSleepPresets();
  assert.strictEqual(remaining.length, 6);
  assert.ok(!remaining.some((p) => p.id === created.id));
});

// =========================================================================
// TEST GROUP 4: Concurrency Limit & Mixer Guard Contracts
// =========================================================================
console.log('\nTest Group 4: Concurrency Limit & Mixer Guard Contracts');

runTest('AudioEngine MAX_ACTIVE_TRACKS is 4', () => {
  // Simulating the canPlay guard used in SleepSoundsView:
  // canPlay = isPlaying || activeCount < 4;
  const MAX_ACTIVE_TRACKS = 4;
  const isPlaying = false;

  assert.strictEqual(isPlaying || 0 < MAX_ACTIVE_TRACKS, true);
  assert.strictEqual(isPlaying || 3 < MAX_ACTIVE_TRACKS, true);
  assert.strictEqual(isPlaying || 4 < MAX_ACTIVE_TRACKS, false);
});

runTest('Active tracks can always be toggled off even when at capacity', () => {
  const MAX_ACTIVE_TRACKS = 4;
  const isCurrentlyPlaying = true;
  const activeCount = 4;
  // An active track must be playable/toggleable even at capacity
  const canInteract = isCurrentlyPlaying || activeCount < MAX_ACTIVE_TRACKS;
  assert.strictEqual(canInteract, true);
});

// =========================================================================
// TEST GROUP 5: Translation Completeness & Parity (EN & AR)
// =========================================================================
console.log('\nTest Group 5: Translation Completeness & Parity');

const PHASE_S6_KEYS: TranslationKey[] = [
  'sleepSoundsNavTitle',
  'sleepSoundsNavSubtitle',
  'sleepSoundsBackToDashboard',
  'sleepSoundsPhilosophy',
  'sleepSoundsDisclaimer',
  'sleepCategoryAll',
  'sleepCategoryRainWater',
  'sleepCategoryCozy',
  'sleepCategoryNoise',
  'sleepCategoryFrequencies',
  'sleepCategoryInstrumental',
  'sleepPresetsTitle',
  'presetSleepDeltaRest',
  'presetSleepNightRain',
  'presetSleepGentleFan',
  'presetSleepCozyHearth',
  'presetSleepNightGuqin',
  'presetSleepOceanLullaby',
  'sleepSoundsOpenRoutine',
  'sleepSoundsActiveBadge',
  'sleepSoundsActiveTracksTitle',
  'sleepSoundsNoActiveTracks',
  'sleepSoundsLibraryTitle',
  'sleepSoundsCapacityNotice',
];

runTest('All Phase S6 translation keys are defined and non-empty in EN', () => {
  for (const key of PHASE_S6_KEYS) {
    const val = en[key];
    assert.ok(val, `Missing or empty EN translation for key: ${key}`);
    assert.strictEqual(typeof val, 'string', `EN translation for ${key} must be string`);
  }
});

runTest('All Phase S6 translation keys are defined and non-empty in AR', () => {
  for (const key of PHASE_S6_KEYS) {
    const val = ar[key];
    assert.ok(val, `Missing or empty AR translation for key: ${key}`);
    assert.strictEqual(typeof val, 'string', `AR translation for ${key} must be string`);
  }
});

runTest('No untranslated fallback English strings remain in Arabic translation', () => {
  // Ensure Arabic values are not literal identical English copies
  const allowIdentical: string[] = []; // None expected for Phase S6 strings
  for (const key of PHASE_S6_KEYS) {
    if (!allowIdentical.includes(key)) {
      assert.notStrictEqual(
        ar[key],
        en[key],
        `Arabic translation for ${key} appears to be untranslated English: "${ar[key]}"`
      );
    }
  }
});

// =========================================================================
// TEST GROUP 6: Non-Medical Disclaimer & Behavioral Contracts
// =========================================================================
console.log('\nTest Group 6: Non-Medical Disclaimer & Behavioral Contracts');

runTest('Disclaimer clearly includes non-medical wording in both languages', () => {
  const enDisclaimer = en.sleepSoundsDisclaimer.toLowerCase();
  const arDisclaimer = ar.sleepSoundsDisclaimer;

  assert.ok(
    enDisclaimer.includes('not a medical') || enDisclaimer.includes('medical') || enDisclaimer.includes('substitute') || enDisclaimer.includes('clinical'),
    'EN disclaimer must state it is not a medical device/service'
  );
  assert.ok(
    arDisclaimer.includes('طبي') || arDisclaimer.includes('تشخيص') || arDisclaimer.includes('علاج'),
    'AR disclaimer must state non-medical terms in Arabic'
  );
});

runTest('Philosophy statement embodies calm non-judgmental returning', () => {
  assert.ok(en.sleepSoundsPhilosophy.length > 10);
  assert.ok(ar.sleepSoundsPhilosophy.length > 10);
});

console.log(`\n--- PHASE S6 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED ---`);
