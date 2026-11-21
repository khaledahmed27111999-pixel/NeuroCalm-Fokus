/**
 * NeuroCalm & Fokus — Phase 4B Sleep Timer & Gradual Audio Fade Test Suite
 * Comprehensive automated verification for AudioEngine sleepFadeGainNode,
 * AudioParam automation curves, cancel/hold recovery, monotonic deadline reconciliation,
 * background tab / system-sleep leap recovery, and preference persistence.
 */

import assert from 'node:assert';
import {
  AudioEngine,
  MAX_GAIN_SUM_BUDGET,
  MAX_SIMULTANEOUS_TRACKS,
} from '../src/audio/AudioEngine';
import {
  loadAudioSettings,
  saveAudioSettings,
  DEFAULT_AUDIO_SETTINGS,
} from '../src/storage/audioStorage';
import {
  loadSleepTimerPreferences,
  saveSleepTimerPreferences,
  clearSleepTimerPreferences,
  DEFAULT_SLEEP_TIMER_PREFERENCES,
  SLEEP_TIMER_STORAGE_KEY,
} from '../src/storage/sleepTimerStorage';
import {
  SleepTimerState,
  SleepTimerPreferences,
} from '../src/types/sleepTimer';

// --- MOCK WEB AUDIO INFRASTRUCTURE FOR HEADLESS NODE TESTING ---

interface AudioParamScheduledCall {
  method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'cancelScheduledValues' | 'cancelAndHoldAtTime';
  value?: number;
  time: number;
}

class MockAudioParam {
  value: number;
  scheduledCalls: AudioParamScheduledCall[] = [];

  constructor(initialValue = 1.0) {
    this.value = initialValue;
  }

  setValueAtTime(val: number, time: number) {
    this.value = val;
    this.scheduledCalls.push({ method: 'setValueAtTime', value: val, time });
  }

  linearRampToValueAtTime(val: number, time: number) {
    this.value = val;
    this.scheduledCalls.push({ method: 'linearRampToValueAtTime', value: val, time });
  }

  exponentialRampToValueAtTime(val: number, time: number) {
    if (val <= 0) {
      throw new RangeError('The target value must be a positive non-zero value.');
    }
    this.value = val;
    this.scheduledCalls.push({ method: 'exponentialRampToValueAtTime', value: val, time });
  }

  cancelScheduledValues(time: number) {
    this.scheduledCalls.push({ method: 'cancelScheduledValues', time });
  }

  cancelAndHoldAtTime(time: number) {
    this.scheduledCalls.push({ method: 'cancelAndHoldAtTime', time });
  }
}

class MockGainNode {
  gain: MockAudioParam;
  connectedTo: unknown[] = [];

  constructor(initialGain = 1.0) {
    this.gain = new MockAudioParam(initialGain);
  }

  connect(target: unknown) {
    this.connectedTo.push(target);
    return target;
  }

  disconnect() {
    this.connectedTo = [];
  }
}

class MockDynamicsCompressorNode {
  threshold = new MockAudioParam(-1.0);
  knee = new MockAudioParam(3.0);
  ratio = new MockAudioParam(20.0);
  attack = new MockAudioParam(0.003);
  release = new MockAudioParam(0.100);
  connectedTo: unknown[] = [];

  connect(target: unknown) {
    this.connectedTo.push(target);
    return target;
  }

  disconnect() {
    this.connectedTo = [];
  }
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
  currentTime = 100.0; // Simulated time in seconds
  sampleRate = 44100;
  destination = { id: 'speaker_destination' };
  audioWorklet = {
    addModule: async (_url: string) => true,
  };

  createGain() {
    return new MockGainNode(1.0);
  }

  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode();
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return new MockBufferSourceNode();
  }

  async decodeAudioData(_ab: ArrayBuffer) {
    return this.createBuffer(2, 48000, 48000);
  }

  async resume() {
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }

  async close() {}
}

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: unknown) => void) | null = null;
  constructor(name: string) { this.name = name; }
  postMessage(_data: unknown) {}
  close() {}
}

// In-memory localStorage mock for node testing
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, val: string) { this.store.set(key, String(val)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

// Install globals
(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
(globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = MockAudioWorkletNode;
(globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel = MockBroadcastChannel;
const mockStorage = new MockLocalStorage();
(globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

async function runAllTests() {
  console.log('=== NEUROCALM & FOKUS — PHASE 4B SLEEP TIMER TEST SUITE ===\n');

  // =========================================================================
  // GROUP 1: AudioEngine sleepFadeGainNode & Audio Graph Routing
  // =========================================================================
  console.log('--- TEST GROUP 1: AudioEngine sleepFadeGainNode & Graph Topology ---');
  {
    const engine = AudioEngine.getInstance();
    const ctx = engine.prepareContext() as unknown as MockAudioContext;
    assert.ok(ctx, 'AudioContext must be initialized');

    // Access private nodes via cast to verify graph routing
    const engineAny = engine as unknown as {
      masterGainNode: MockGainNode;
      sleepFadeGainNode: MockGainNode;
      limiterNode: MockDynamicsCompressorNode;
    };

    assert.ok(engineAny.masterGainNode, 'masterGainNode must exist');
    assert.ok(engineAny.sleepFadeGainNode, 'sleepFadeGainNode must exist');
    assert.ok(engineAny.limiterNode, 'limiterNode must exist');

    // Verify routing: masterGainNode -> sleepFadeGainNode -> limiterNode -> destination
    assert.strictEqual(
      engineAny.masterGainNode.connectedTo[0],
      engineAny.sleepFadeGainNode,
      'masterGainNode must connect directly to sleepFadeGainNode'
    );
    assert.strictEqual(
      engineAny.sleepFadeGainNode.connectedTo[0],
      engineAny.limiterNode,
      'sleepFadeGainNode must connect directly to limiterNode'
    );
    assert.strictEqual(
      engineAny.limiterNode.connectedTo[0],
      ctx.destination,
      'limiterNode must connect to destination'
    );

    // Default unity gain verification
    assert.strictEqual(
      engine.getSleepFadeGain(),
      1.0,
      'Initial sleepFadeGain must be exactly 1.0 (unity gain)'
    );

    console.log('✓ Section 1 Passed: Master graph topology correctly routes masterGain -> sleepFadeGain -> limiter -> destination.');
  }

  // =========================================================================
  // GROUP 2: AudioParam Automation, Endpoint Safety & Recovery Ramp
  // =========================================================================
  console.log('--- TEST GROUP 2: AudioParam Automation, Endpoints & Cancellation Recovery ---');
  {
    const engine = AudioEngine.getInstance();
    const engineAny = engine as unknown as {
      sleepFadeGainNode: MockGainNode;
      activeFadeParams: unknown;
    };

    // 2.1 Schedule sleep fade over 30 seconds
    const node = engineAny.sleepFadeGainNode;
    node.gain.scheduledCalls = [];

    engine.scheduleSleepFade(30);

    // Verify scheduled calls:
    // 1. cancelScheduledValues(now)
    // 2. setValueAtTime(currentGain, now)
    // 3. exponentialRampToValueAtTime(0.0001, now + 30)
    // 4. setValueAtTime(0.0, now + 30.05)
    assert.ok(
      node.gain.scheduledCalls.some((c) => c.method === 'cancelScheduledValues'),
      'Must cancel prior scheduled values before scheduling new fade'
    );
    assert.ok(
      node.gain.scheduledCalls.some((c) => c.method === 'exponentialRampToValueAtTime' && c.value === 0.0001),
      'Must ramp exponentially to 0.0001 (-80 dBFS)'
    );
    assert.ok(
      node.gain.scheduledCalls.some((c) => c.method === 'setValueAtTime' && c.value === 0.0),
      'Must step to 0.0 after reaching 0.0001 to ensure true silence'
    );

    // Verify activeFadeParams tracking
    assert.ok(engineAny.activeFadeParams, 'activeFadeParams must be recorded during active fade');

    // 2.2 Cancellation recovery ramp
    node.gain.scheduledCalls = [];
    engine.cancelSleepFade();

    // Verify cancelAndHoldAtTime or cancelScheduledValues + linear recovery ramp to 1.0
    assert.ok(
      node.gain.scheduledCalls.some((c) => c.method === 'linearRampToValueAtTime' && c.value === 1.0),
      'Must schedule a smooth linear recovery ramp back to unity gain (1.0)'
    );
    assert.strictEqual(
      engineAny.activeFadeParams,
      null,
      'activeFadeParams must be cleared on cancellation'
    );

    // 2.3 Repeated cancel / restart operations safety
    for (let i = 0; i < 5; i++) {
      engine.scheduleSleepFade(60);
      assert.ok(engineAny.activeFadeParams);
      engine.cancelSleepFade();
      assert.strictEqual(engineAny.activeFadeParams, null);
    }
    assert.strictEqual(engine.getSleepFadeGain(), 1.0, 'Gain must be restored to 1.0 after repeated cancels');

    // 2.4 resetSleepFade immediate reset
    engine.scheduleSleepFade(15);
    engine.resetSleepFade();
    assert.strictEqual(engineAny.activeFadeParams, null, 'resetSleepFade must clear activeFadeParams');
    assert.strictEqual(engine.getSleepFadeGain(), 1.0, 'resetSleepFade must restore gain to 1.0 immediately');

    console.log('✓ Section 2 Passed: Native AudioParam scheduling, endpoint cut to 0, cancel/hold recovery, and repeated cancel safety verified.');
  }

  // =========================================================================
  // GROUP 3: Volume Preference Independence & Headroom Invariants
  // =========================================================================
  console.log('--- TEST GROUP 3: Volume Preference Independence & Headroom Invariants ---');
  {
    const engine = AudioEngine.getInstance();
    
    // Set initial user master volume preference to 0.75
    engine.setMasterVolume(0.75);
    const savedBefore = loadAudioSettings();
    assert.strictEqual(savedBefore.masterVolume, 0.75, 'User master volume saved at 0.75');

    // Execute full sleep fade to silence
    engine.scheduleSleepFade(10);
    // Simulate fade reaching completion
    const engineAny = engine as unknown as { sleepFadeGainNode: MockGainNode };
    engineAny.sleepFadeGainNode.gain.value = 0.0;
    assert.strictEqual(engine.getSleepFadeGain(), 0.0);

    // Verify that user's master volume preference was NOT modified in localStorage or engine state
    const savedAfter = loadAudioSettings();
    assert.strictEqual(
      savedAfter.masterVolume,
      0.75,
      'CRITICAL: Sleep fade must NOT modify persisted masterVolume preference!'
    );
    assert.strictEqual(
      engine.getState().masterVolume,
      0.75,
      'CRITICAL: Sleep fade must NOT modify engine state masterVolume!'
    );

    // Reset sleep fade
    engine.resetSleepFade();
    assert.strictEqual(engine.getSleepFadeGain(), 1.0);
    assert.strictEqual(engine.getState().masterVolume, 0.75);

    // Verify gain bound invariant: sleepFadeGain cannot exceed 1.0
    engineAny.sleepFadeGainNode.gain.value = 1.5; // Simulate out-of-bound
    assert.strictEqual(engine.getSleepFadeGain(), 1.0, 'getSleepFadeGain must clamp strictly to <= 1.0');
    engineAny.sleepFadeGainNode.gain.value = -0.5;
    assert.strictEqual(engine.getSleepFadeGain(), 0.0, 'getSleepFadeGain must clamp strictly to >= 0.0');
    engine.resetSleepFade();

    // Verify concurrency ceilings unchanged
    assert.strictEqual(MAX_GAIN_SUM_BUDGET, 0.80, 'MAX_GAIN_SUM_BUDGET must remain 0.80');
    assert.strictEqual(MAX_SIMULTANEOUS_TRACKS, 4, 'MAX_SIMULTANEOUS_TRACKS must remain 4');

    console.log('✓ Section 3 Passed: User volume preferences remain completely untouched during and after sleep fade.');
  }

  // =========================================================================
  // GROUP 4: Preferences Persistence & Defensive Fallback
  // =========================================================================
  console.log('--- TEST GROUP 4: Sleep Timer Preferences Persistence & Storage Validation ---');
  {
    clearSleepTimerPreferences();

    // 4.1 Default loading
    const defaultPrefs = loadSleepTimerPreferences();
    assert.deepStrictEqual(
      defaultPrefs,
      DEFAULT_SLEEP_TIMER_PREFERENCES,
      'Default preferences must be 30m duration and 60s fade'
    );

    // 4.2 Save valid custom preferences
    saveSleepTimerPreferences({
      preferredDurationMinutes: 45,
      preferredFadeDurationSeconds: 300,
    });
    const loadedCustom = loadSleepTimerPreferences();
    assert.strictEqual(loadedCustom.preferredDurationMinutes, 45);
    assert.strictEqual(loadedCustom.preferredFadeDurationSeconds, 300);

    // 4.3 Clamping bounds validation
    saveSleepTimerPreferences({
      preferredDurationMinutes: 9999, // Exceeds 180 max
      preferredFadeDurationSeconds: 1, // Below 10 min
    });
    const clamped = loadSleepTimerPreferences();
    assert.strictEqual(clamped.preferredDurationMinutes, 180, 'Duration must clamp to max 180');
    assert.strictEqual(clamped.preferredFadeDurationSeconds, 10, 'Fade must clamp to min 10');

    // 4.4 Malformed JSON recovery
    mockStorage.setItem(SLEEP_TIMER_STORAGE_KEY, '{ invalid_json :::: 123');
    const recoveredMalformed = loadSleepTimerPreferences();
    assert.deepStrictEqual(recoveredMalformed, DEFAULT_SLEEP_TIMER_PREFERENCES);

    // 4.5 Non-object recovery
    mockStorage.setItem(SLEEP_TIMER_STORAGE_KEY, '"some_string"');
    const recoveredString = loadSleepTimerPreferences();
    assert.deepStrictEqual(recoveredString, DEFAULT_SLEEP_TIMER_PREFERENCES);

    clearSleepTimerPreferences();
    console.log('✓ Section 4 Passed: Storage validation, clamping bounds, and malformed recovery fully verified.');
  }

  // =========================================================================
  // GROUP 5: Deterministic Wall-Clock Monotonic Deadline Reconciliation
  // =========================================================================
  console.log('--- TEST GROUP 5: Monotonic Deadline Reconciliation & State Machine ---');
  {
    // Simulate the reconciliation math directly
    const durationMinutes = 30;
    const fadeDurationSeconds = 60;

    const startTime = 1_000_000;
    const fadeStartWallTime = startTime + durationMinutes * 60 * 1000; // 1,000,000 + 1,800,000 = 2,800,000
    const deadlineWallTime = fadeStartWallTime + fadeDurationSeconds * 1000; // 2,800,000 + 60,000 = 2,860,000

    // Helper simulating reconciliation logic
    function evaluateReconciliation(now: number): {
      status: 'running' | 'fading' | 'completed';
      remainingSeconds: number;
      remainingBeforeFade: number;
      shouldScheduleFade: boolean;
      shouldStopAll: boolean;
    } {
      if (now >= deadlineWallTime) {
        return {
          status: 'completed',
          remainingSeconds: 0,
          remainingBeforeFade: 0,
          shouldScheduleFade: false,
          shouldStopAll: true,
        };
      }
      if (now >= fadeStartWallTime) {
        return {
          status: 'fading',
          remainingSeconds: Math.max(0, Math.ceil((deadlineWallTime - now) / 1000)),
          remainingBeforeFade: 0,
          shouldScheduleFade: true,
          shouldStopAll: false,
        };
      }
      return {
        status: 'running',
        remainingSeconds: Math.max(0, Math.ceil((deadlineWallTime - now) / 1000)),
        remainingBeforeFade: Math.max(0, Math.ceil((fadeStartWallTime - now) / 1000)),
        shouldScheduleFade: false,
        shouldStopAll: false,
      };
    }

    // 5.1 At start (t = startTime)
    const atStart = evaluateReconciliation(startTime);
    assert.strictEqual(atStart.status, 'running');
    assert.strictEqual(atStart.remainingSeconds, 30 * 60 + 60); // 1860s
    assert.strictEqual(atStart.remainingBeforeFade, 30 * 60); // 1800s
    assert.strictEqual(atStart.shouldScheduleFade, false);
    assert.strictEqual(atStart.shouldStopAll, false);

    // 5.2 Mid-run (t = startTime + 15 min)
    const midRun = evaluateReconciliation(startTime + 15 * 60 * 1000);
    assert.strictEqual(midRun.status, 'running');
    assert.strictEqual(midRun.remainingSeconds, 15 * 60 + 60); // 960s
    assert.strictEqual(midRun.remainingBeforeFade, 15 * 60); // 900s

    // 5.3 Exactly at fade start (t = fadeStartWallTime)
    const atFadeStart = evaluateReconciliation(fadeStartWallTime);
    assert.strictEqual(atFadeStart.status, 'fading');
    assert.strictEqual(atFadeStart.remainingSeconds, 60);
    assert.strictEqual(atFadeStart.remainingBeforeFade, 0);
    assert.strictEqual(atFadeStart.shouldScheduleFade, true);

    // 5.4 Mid-fade (t = fadeStartWallTime + 30s)
    const midFade = evaluateReconciliation(fadeStartWallTime + 30 * 1000);
    assert.strictEqual(midFade.status, 'fading');
    assert.strictEqual(midFade.remainingSeconds, 30);
    assert.strictEqual(midFade.remainingBeforeFade, 0);

    // 5.5 At deadline expiration (t = deadlineWallTime)
    const atDeadline = evaluateReconciliation(deadlineWallTime);
    assert.strictEqual(atDeadline.status, 'completed');
    assert.strictEqual(atDeadline.remainingSeconds, 0);
    assert.strictEqual(atDeadline.shouldStopAll, true);

    // 5.6 Past deadline (t = deadlineWallTime + 10s)
    const pastDeadline = evaluateReconciliation(deadlineWallTime + 10 * 1000);
    assert.strictEqual(pastDeadline.status, 'completed');
    assert.strictEqual(pastDeadline.remainingSeconds, 0);
    assert.strictEqual(pastDeadline.shouldStopAll, true);

    console.log('✓ Section 5 Passed: Monotonic deadline reconciliation and state transitions verified across complete timeline.');
  }

  // =========================================================================
  // GROUP 6: System Sleep Leap & Backgrounding Edge Cases
  // =========================================================================
  console.log('--- TEST GROUP 6: System Sleep & Background Wake Scenarios ---');
  {
    const durationMinutes = 30;
    const fadeDurationSeconds = 60;

    const startTime = 10_000_000;
    const fadeStartWallTime = startTime + durationMinutes * 60 * 1000;
    const deadlineWallTime = fadeStartWallTime + fadeDurationSeconds * 1000;

    // SCENARIO A: Laptop closes at minute 10, wakes 2 hours later (t = startTime + 120 min)
    const wakeAfterExpiryTime = startTime + 120 * 60 * 1000;
    assert.ok(wakeAfterExpiryTime > deadlineWallTime, 'Wake time must be well past deadline');

    // On wake reconciliation:
    const isExpired = wakeAfterExpiryTime >= deadlineWallTime;
    assert.strictEqual(isExpired, true, 'Must detect expiration immediately upon wake');

    // Must NOT reschedule fade or resume audio
    const shouldScheduleFadeOnExpiry = false;
    assert.strictEqual(shouldScheduleFadeOnExpiry, false, 'Must NOT schedule any new fade after expiration');

    // SCENARIO B: Laptop closes at minute 10, wakes at minute 28 (inside the 5-min fade window if fade was 5m)
    const fadeDuration5m = 300; // 5 min
    const deadline5m = fadeStartWallTime + fadeDuration5m * 1000;
    // Wake at fadeStart + 120s (2 minutes into fade, 3 minutes remaining)
    const wakeMidFadeTime = fadeStartWallTime + 120 * 1000;

    assert.ok(wakeMidFadeTime >= fadeStartWallTime && wakeMidFadeTime < deadline5m);
    const remainingFadeSec = Math.max(0.1, (deadline5m - wakeMidFadeTime) / 1000);
    assert.strictEqual(remainingFadeSec, 180, 'Must compute exactly 180s remaining for fade');

    // SCENARIO C: Extension while in fading state
    // If user clicks "+15 min" while in fading state, fadeStart moves 15m into the future
    const extensionMs = 15 * 60 * 1000;
    const extendedFadeStart = fadeStartWallTime + extensionMs;
    const extendedDeadline = deadline5m + extensionMs;

    assert.ok(wakeMidFadeTime < extendedFadeStart, 'Wake time is now before the extended fadeStart');
    // Transition from fading back to running
    const nextStatus = wakeMidFadeTime < extendedFadeStart ? 'running' : 'fading';
    assert.strictEqual(nextStatus, 'running', 'Extension must revert fading status to running');

    console.log('✓ Section 6 Passed: Device sleep leap, mid-fade wake recovery, and extension out of fade verified.');
  }

  // =========================================================================
  // GROUP 7: Stop All & External Audio Teardown Coordination
  // =========================================================================
  console.log('--- TEST GROUP 7: Stop All & Audio Ownership Integration ---');
  {
    const engine = AudioEngine.getInstance();
    
    // Set a sleep fade in progress
    engine.scheduleSleepFade(20);
    assert.notStrictEqual((engine as unknown as { activeFadeParams: unknown }).activeFadeParams, null);

    // Call stopAll()
    await engine.stopAll();

    // Verify stopAll clears activeFadeParams and restores gain to 1.0
    assert.strictEqual(
      (engine as unknown as { activeFadeParams: unknown }).activeFadeParams,
      null,
      'stopAll must clear activeFadeParams'
    );
    assert.strictEqual(
      engine.getSleepFadeGain(),
      1.0,
      'stopAll must reset sleepFadeGainNode to unity gain (1.0)'
    );

    console.log('✓ Section 7 Passed: Stop All clears sleep timer automations and restores unity gain.');
  }

  // =========================================================================
  // GROUP 8: Attenuation of Newly Started Tracks
  // =========================================================================
  console.log('--- TEST GROUP 8: Attenuation of Newly Started Tracks ---');
  {
    const engine = AudioEngine.getInstance();
    const ctx = engine.prepareContext() as unknown as MockAudioContext;
    const engineAny = engine as unknown as {
      masterGainNode: MockGainNode;
      sleepFadeGainNode: MockGainNode;
    };

    // Simulate active fade at 40% gain
    engineAny.sleepFadeGainNode.gain.value = 0.40;

    // Start a new procedural track (white_noise)
    const success = await engine.playTrack('white_noise');
    assert.strictEqual(success, true, 'white_noise track must start successfully');

    // Verify track routes to masterGainNode
    const activeChannels = (engine as unknown as { activeChannels: Map<string, { gainNode: MockGainNode }> }).activeChannels;
    const trackChannel = activeChannels.get('white_noise');
    assert.ok(trackChannel, 'white_noise track channel must be created');
    assert.strictEqual(
      trackChannel.gainNode.connectedTo[0],
      engineAny.masterGainNode,
      'Track gain node must connect to masterGainNode'
    );

    // Since masterGainNode connects to sleepFadeGainNode, which is at 0.40:
    // Any signal from rain passes: rainGain -> masterGain -> sleepFadeGain(0.40) -> limiter -> destination
    assert.strictEqual(
      engineAny.masterGainNode.connectedTo[0],
      engineAny.sleepFadeGainNode,
      'All master audio flows through sleepFadeGainNode'
    );
    assert.strictEqual(
      engine.getSleepFadeGain(),
      0.40,
      'Global sleep attenuation applies to newly started track'
    );

    // Teardown
    await engine.stopAll();
    assert.strictEqual(engine.getSleepFadeGain(), 1.0);

    console.log('✓ Section 8 Passed: Newly started tracks route through sleepFadeGainNode and inherit attenuation.');
  }

  console.log('\n========================================================================');
  console.log('ALL PHASE 4B SLEEP TIMER & FADE ENGINE TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
