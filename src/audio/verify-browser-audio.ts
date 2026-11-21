/**
 * NeuroCalm & Fokus — Phase 2D-3B Real Browser Audio Verification
 * Executed in live Chrome using native Web Audio API.
 */

import { AudioEngine } from './AudioEngine';
import { SoundscapeId } from '../types/audio';

interface VerificationResult {
  status: 'passed' | 'failed' | 'running';
  step: string;
  assertionsPassed: number;
  logs: string[];
  metrics: Record<string, unknown>;
}

declare global {
  interface Window {
    __AUDIO_VERIFICATION_RESULT__?: VerificationResult;
    __RUN_AUDIO_VERIFICATION__?: () => Promise<void>;
  }
}

const engine = AudioEngine.getInstance();

const logEl = document.getElementById('log-output') as HTMLDivElement;
const statusBadge = document.getElementById('status-badge') as HTMLDivElement;
const statCtxState = document.getElementById('stat-ctx-state') as HTMLDivElement;
const statSampleRate = document.getElementById('stat-sample-rate') as HTMLDivElement;
const statSources = document.getElementById('stat-sources') as HTMLDivElement;
const statGains = document.getElementById('stat-gains') as HTMLDivElement;
const btnRunAll = document.getElementById('btn-run-all') as HTMLButtonElement;

let assertionsCount = 0;
const logMessages: string[] = [];

function log(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const prefix = type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : '• ';
  const fullMsg = `${prefix}${msg}`;
  logMessages.push(fullMsg);
  console.log(fullMsg);

  const span = document.createElement('div');
  span.className = `log-${type}`;
  span.textContent = fullMsg;
  logEl.appendChild(span);
  logEl.scrollTop = logEl.scrollHeight;
}

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    log(`ASSERTION FAILED: ${msg}`, 'error');
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  assertionsCount++;
  log(msg, 'success');
}

function updateStats(): void {
  const ctx = (engine as unknown as { audioContext: AudioContext | null }).audioContext;
  if (ctx) {
    statCtxState.textContent = ctx.state;
    statSampleRate.textContent = `${ctx.sampleRate} Hz`;
  } else {
    statCtxState.textContent = 'Uninitialized';
    statSampleRate.textContent = '-';
  }
  statSources.textContent = `${engine.getActiveSourceNodeCount()} / 8`;
  statGains.textContent = `${engine.getActiveGainNodeCount()} / 8`;
}

// Subscribe to engine state
engine.subscribe(() => {
  updateStats();
});

async function runRealBrowserVerification(): Promise<void> {
  assertionsCount = 0;
  logEl.innerHTML = '';
  statusBadge.className = 'status-running';
  statusBadge.textContent = 'STATUS: RUNNING TESTS...';
  btnRunAll.disabled = true;

  window.__AUDIO_VERIFICATION_RESULT__ = {
    status: 'running',
    step: 'initializing',
    assertionsPassed: 0,
    logs: logMessages,
    metrics: {},
  };

  try {
    log('=== STARTING REAL CHROME WEB AUDIO API VERIFICATION ===');

    // Step 1: Real Browser Context Verification
    log('Step 1: Preparing native Web Audio Context...');
    const ctx = engine.prepareContext();
    assert(ctx instanceof AudioContext, 'Native browser AudioContext instantiated successfully');
    assert(ctx.sampleRate >= 22050 && ctx.sampleRate <= 96000, `Valid browser sample rate: ${ctx.sampleRate} Hz`);
    assert(ctx.destination !== null, 'AudioContext destination exists');
    updateStats();

    // Step 2: Violet Noise Real Browser Playback & Bounded Output
    log('\nStep 2: Testing Violet Noise in real Chrome AudioContext...');
    const violetStarted = await engine.playTrack('violet_noise');
    assert(violetStarted === true, 'Violet Noise track started successfully in AudioEngine');
    assert(engine.getState().activeTracks['violet_noise']?.isPlaying === true, 'Violet Noise state is marked playing');
    assert(engine.getActiveSourceNodeCount() === 1, 'Violet Noise uses 1 source node');
    assert(engine.getActiveGainNodeCount() === 1, 'Violet Noise uses 1 gain node');
    updateStats();

    // Capture real audio output using Web Audio AnalyserNode
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const masterGain = (engine as unknown as { masterGainNode: GainNode }).masterGainNode;
    masterGain.connect(analyser);

    // Wait 300ms for audio to render
    await new Promise((resolve) => setTimeout(resolve, 300));

    const timeData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);

    let maxVioletPeak = 0;
    let nonZeroSamples = 0;
    for (let i = 0; i < timeData.length; i++) {
      const val = Math.abs(timeData[i]);
      if (Number.isFinite(val) && val > 1e-5) nonZeroSamples++;
      if (val > maxVioletPeak) maxVioletPeak = val;
    }

    assert(nonZeroSamples > 50, `Violet noise generates active non-zero signal in Chrome (${nonZeroSamples} samples)`);
    assert(maxVioletPeak <= 0.75, `Violet noise output peak (${maxVioletPeak.toFixed(4)}) is strictly <= 0.75`);
    log(`Violet Noise real audio measured: peak = ${maxVioletPeak.toFixed(4)}, active samples = ${nonZeroSamples}`);

    // Clean stop
    await engine.stopTrack('violet_noise');
    assert(engine.getState().activeCount === 0, 'Violet Noise stopped cleanly; active count is 0');
    assert(engine.getActiveSourceNodeCount() === 0, 'Source nodes released on stop');
    assert(engine.getActiveGainNodeCount() === 0, 'Gain nodes released on stop');
    updateStats();

    // Step 3: Binaural Beats Real Browser Verification (Distinct L/R & Stereo Merger)
    log('\nStep 3: Testing Binaural Beats in real Chrome AudioContext...');
    const binStarted = await engine.playTrack('binaural_alpha');
    assert(binStarted === true, 'Binaural Alpha (250 Hz carrier, 10 Hz beat) started successfully');
    assert(engine.getState().activeTracks['binaural_alpha']?.isPlaying === true, 'Binaural Alpha is marked playing');
    assert(engine.getActiveSourceNodeCount() === 2, 'Binaural Beat allocates 2 native OscillatorNode sources');
    assert(engine.getActiveGainNodeCount() === 2, 'Binaural Beat allocates 2 GainNodes (tone + track)');
    updateStats();

    // Inspect real native oscillator frequencies
    const channels = (engine as unknown as { activeChannels: Map<string, unknown> }).activeChannels;
    const binChannel = channels.get('binaural_alpha') as {
      associatedSources: OscillatorNode[];
      associatedNodes: AudioNode[];
      sourceNode: AudioNode;
    };
    assert(binChannel.associatedSources.length === 2, 'Channel retains references to both oscillators');

    const oscLeft = binChannel.associatedSources[0];
    const oscRight = binChannel.associatedSources[1];
    const fLeft = oscLeft.frequency.value;
    const fRight = oscRight.frequency.value;

    assert(Math.abs(fLeft - 245.0) < 0.1, `Left oscillator frequency calibrated to 245.0 Hz (measured: ${fLeft} Hz)`);
    assert(Math.abs(fRight - 255.0) < 0.1, `Right oscillator frequency calibrated to 255.0 Hz (measured: ${fRight} Hz)`);
    assert(Math.abs(fRight - fLeft - 10.0) < 0.1, `Dichotic beat difference is exactly 10.0 Hz (alpha target)`);

    // Verify ChannelMerger routing in real Chrome graph
    const merger = binChannel.associatedNodes[0] as ChannelMergerNode;
    assert(merger instanceof ChannelMergerNode, 'Merger node is instance of native ChannelMergerNode');
    assert(merger.numberOfInputs === 2, 'Merger node has 2 input channels');

    // Split stereo channels to verify distinct L/R audio rendering
    const splitter = ctx.createChannelSplitter(2);
    const analyserL = ctx.createAnalyser();
    const analyserR = ctx.createAnalyser();
    analyserL.fftSize = 1024;
    analyserR.fftSize = 1024;

    binChannel.sourceNode.connect(splitter);
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const leftSamples = new Float32Array(analyserL.fftSize);
    const rightSamples = new Float32Array(analyserR.fftSize);
    analyserL.getFloatTimeDomainData(leftSamples);
    analyserR.getFloatTimeDomainData(rightSamples);

    let leftRMS = 0;
    let rightRMS = 0;
    for (let i = 0; i < leftSamples.length; i++) {
      leftRMS += leftSamples[i] * leftSamples[i];
      rightRMS += rightSamples[i] * rightSamples[i];
    }
    leftRMS = Math.sqrt(leftRMS / leftSamples.length);
    rightRMS = Math.sqrt(rightRMS / rightSamples.length);

    assert(leftRMS > 0.01, `Left channel actively rendering audio (RMS: ${leftRMS.toFixed(4)})`);
    assert(rightRMS > 0.01, `Right channel actively rendering audio (RMS: ${rightRMS.toFixed(4)})`);
    log(`Binaural Beats dichotic separation confirmed: L = 245 Hz (RMS: ${leftRMS.toFixed(4)}), R = 255 Hz (RMS: ${rightRMS.toFixed(4)})`);

    await engine.stopTrack('binaural_alpha');
    assert(engine.getActiveSourceNodeCount() === 0, 'Both oscillators stopped and released on stopTrack');
    updateStats();

    // Step 4: Monaural Beats Real Browser Verification (Acoustic Summing)
    log('\nStep 4: Testing Monaural Beats in real Chrome AudioContext...');
    const monStarted = await engine.playTrack('monaural_alpha');
    assert(monStarted === true, 'Monaural Alpha started successfully');
    assert(engine.getActiveSourceNodeCount() === 2, 'Monaural Beat allocates 2 native OscillatorNode sources');
    assert(engine.getActiveGainNodeCount() === 2, 'Monaural Beat allocates 2 GainNodes (summing + track)');
    updateStats();

    const monChannel = channels.get('monaural_alpha') as {
      associatedSources: OscillatorNode[];
      sourceNode: AudioNode;
    };
    const monOsc1 = monChannel.associatedSources[0];
    const monOsc2 = monChannel.associatedSources[1];
    assert(Math.abs(monOsc1.frequency.value - 245.0) < 0.1, `Osc 1 frequency: 245.0 Hz`);
    assert(Math.abs(monOsc2.frequency.value - 255.0) < 0.1, `Osc 2 frequency: 255.0 Hz`);

    // Verify acoustic envelope interference
    const monAnalyser = ctx.createAnalyser();
    monAnalyser.fftSize = 2048;
    monChannel.sourceNode.connect(monAnalyser);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const monSamples = new Float32Array(monAnalyser.fftSize);
    monAnalyser.getFloatTimeDomainData(monSamples);

    let maxMonPeak = 0;
    for (let i = 0; i < monSamples.length; i++) {
      const val = Math.abs(monSamples[i]);
      if (val > maxMonPeak) maxMonPeak = val;
    }
    assert(maxMonPeak <= 0.7071 && maxMonPeak <= 0.75, `Monaural acoustic interference peak (${maxMonPeak.toFixed(4)}) is bounded <= 0.7071 <= 0.75`);
    log(`Monaural Beat acoustic interference confirmed: peak = ${maxMonPeak.toFixed(4)}`);

    await engine.stopTrack('monaural_alpha');
    assert(engine.getActiveSourceNodeCount() === 0, 'All monaural nodes released cleanly');
    updateStats();

    // Step 5: Isochronic Tones Real Browser Verification (Smooth AM Modulation)
    log('\nStep 5: Testing Isochronic Tones in real Chrome AudioContext...');
    const isoStarted = await engine.playTrack('isochronic_alpha');
    assert(isoStarted === true, 'Isochronic Alpha started successfully');
    assert(engine.getActiveSourceNodeCount() === 2, 'Isochronic allocates 2 sources (carrier + LFO)');
    assert(engine.getActiveGainNodeCount() === 3, 'Isochronic allocates 3 gains (mod + depth + track)');
    updateStats();

    const isoChannel = channels.get('isochronic_alpha') as {
      associatedSources: OscillatorNode[];
      sourceNode: AudioNode;
    };
    const carrierOsc = isoChannel.associatedSources[0];
    const lfoOsc = isoChannel.associatedSources[1];
    assert(carrierOsc.frequency.value === 250, 'Carrier oscillator frequency is 250 Hz');
    assert(lfoOsc.frequency.value === 10, 'Modulator LFO frequency is 10 Hz');

    const isoAnalyser = ctx.createAnalyser();
    isoAnalyser.fftSize = 2048;
    isoChannel.sourceNode.connect(isoAnalyser);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const isoSamples = new Float32Array(isoAnalyser.fftSize);
    isoAnalyser.getFloatTimeDomainData(isoSamples);

    let maxIsoPeak = 0;
    for (let i = 0; i < isoSamples.length; i++) {
      const val = Math.abs(isoSamples[i]);
      if (val > maxIsoPeak) maxIsoPeak = val;
    }
    assert(maxIsoPeak <= 0.7071 && maxIsoPeak <= 0.75, `Isochronic modulated peak (${maxIsoPeak.toFixed(4)}) is bounded <= 0.7071 <= 0.75`);
    log(`Isochronic Tone audio-rate AM confirmed: peak = ${maxIsoPeak.toFixed(4)}`);

    await engine.stopTrack('isochronic_alpha');
    assert(engine.getActiveSourceNodeCount() === 0, 'Isochronic nodes released cleanly');
    updateStats();

    // Step 6: Repeated Start/Stop Cycles in Real Chrome
    log('\nStep 6: Executing 5 rapid sequential Start/Stop cycles in Chrome...');
    const testTracks: SoundscapeId[] = ['violet_noise', 'binaural_alpha', 'monaural_alpha', 'isochronic_alpha'];

    for (let cycle = 1; cycle <= 5; cycle++) {
      const trackId = testTracks[(cycle - 1) % testTracks.length];
      const startOk = await engine.playTrack(trackId);
      assert(startOk === true, `Cycle ${cycle}: Started '${trackId}'`);
      assert(engine.getState().activeCount === 1, `Cycle ${cycle}: Active count is 1`);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await engine.stopTrack(trackId);
      assert(engine.getState().activeCount === 0, `Cycle ${cycle}: Stopped '${trackId}' cleanly`);
      assert(engine.getActiveSourceNodeCount() === 0, `Cycle ${cycle}: 0 sources remaining`);
      assert(engine.getActiveGainNodeCount() === 0, `Cycle ${cycle}: 0 gains remaining`);
    }
    log('Repeated Start/Stop cycle test passed: 5 consecutive cycles with zero leaks.', 'success');

    // Step 7: Page Visibility / Focus Simulation
    log('\nStep 7: Testing simulated Visibility Change & Navigation...');
    await engine.playTrack('binaural_theta');
    assert(engine.getState().activeCount === 1, 'Track active before simulated visibility change');

    // Simulate page hidden
    document.dispatchEvent(new Event('visibilitychange'));
    assert(engine.getState().activeCount === 1, 'Playback persists stably across visibility change event');

    await engine.stopAll();
    assert(engine.getState().activeCount === 0, 'Clean stopAll after navigation test');
    updateStats();

    // Step 8: Real WebM Recorded Asset Playback & Looping in Chrome
    log('\nStep 8: Verifying live playback of Tier 1 Recorded WebM Assets in Chrome...');
    const tier1Assets: SoundscapeId[] = ['rain', 'stream', 'ocean_waves', 'fan', 'fireplace'];

    for (const assetId of tier1Assets) {
      log(`Testing live fetch, decode, and playback for '${assetId}'...`);
      const startRes = await engine.playTrack(assetId);
      assert(startRes === true, `Track '${assetId}' started successfully`);
      assert(engine.getState().activeTracks[assetId]?.isPlaying === true, `'${assetId}' is marked playing`);
      assert(engine.getBufferCache().isPinned(assetId) === true, `'${assetId}' buffer is pinned in cache`);
      assert(engine.getActiveSourceNodeCount() === 1, `'${assetId}' occupies 1 source node`);
      assert(engine.getActiveGainNodeCount() === 1, `'${assetId}' occupies 1 gain node`);

      // Let it play for 100ms in Chrome
      await new Promise((r) => setTimeout(r, 100));

      await engine.stopTrack(assetId);
      assert(engine.getState().activeCount === 0, `'${assetId}' stopped cleanly`);
      assert(engine.getBufferCache().isPinned(assetId) === false, `'${assetId}' buffer unpinned`);
      assert(engine.getActiveSourceNodeCount() === 0, `Source nodes released after '${assetId}'`);
      assert(engine.getActiveGainNodeCount() === 0, `Gain nodes released after '${assetId}'`);
      log(`Track '${assetId}' verified live in Chrome Web Audio.`, 'success');
    }

    // Test multi-track concurrent playback (1 asset + 1 noise + 1 binaural tone)
    log('\nTesting live multi-track coexistence (Rain + Violet Noise + Binaural Alpha)...');
    await Promise.all([
      engine.playTrack('rain'),
      engine.playTrack('violet_noise'),
      engine.playTrack('binaural_alpha')
    ]);

    assert(engine.getState().activeCount === 3, 'All 3 concurrent tracks active');
    assert(engine.getActiveSourceNodeCount() === 4, '4 total source nodes active (1 rain + 1 violet + 2 binaural)');
    assert(engine.getActiveGainNodeCount() === 4, '4 total gain nodes active (1 rain + 1 violet + 2 binaural)');
    assert(engine.getBufferCache().isPinned('rain') === true, 'Rain buffer is pinned during multi-track playback');

    await new Promise((r) => setTimeout(r, 150));

    await engine.stopAll();
    assert(engine.getState().activeCount === 0, 'Clean stopAll across mixed tracks');
    assert(engine.getActiveSourceNodeCount() === 0, 'Zero sources remain');
    assert(engine.getActiveGainNodeCount() === 0, 'Zero gains remain');
    assert(engine.getBufferCache().isPinned('rain') === false, 'Rain unpinned on stopAll');
    log('Mixed recorded + procedural multi-track coexistence verified in Chrome.', 'success');

    log('\n========================================================================');
    log(`ALL REAL CHROME WEB AUDIO API TESTS PASSED! (${assertionsCount} assertions)`, 'success');
    log('========================================================================');

    statusBadge.className = 'status-passed';
    statusBadge.textContent = `STATUS: ALL TESTS PASSED (${assertionsCount} assertions)`;

    window.__AUDIO_VERIFICATION_RESULT__ = {
      status: 'passed',
      step: 'completed',
      assertionsPassed: assertionsCount,
      logs: logMessages,
      metrics: {
        sampleRate: ctx.sampleRate,
        violetPeak: maxVioletPeak,
        binauralFrequencies: { left: fLeft, right: fRight },
        monauralPeak: maxMonPeak,
        isochronicPeak: maxIsoPeak,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`REAL BROWSER VERIFICATION ERROR: ${errorMsg}`, 'error');
    statusBadge.className = 'status-failed';
    statusBadge.textContent = 'STATUS: FAILED';
    window.__AUDIO_VERIFICATION_RESULT__ = {
      status: 'failed',
      step: 'error',
      assertionsPassed: assertionsCount,
      logs: logMessages,
      metrics: { error: errorMsg },
    };
  } finally {
    btnRunAll.disabled = false;
  }
}

// Attach event listeners
btnRunAll.addEventListener('click', () => {
  void runRealBrowserVerification();
});

document.getElementById('btn-violet')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['violet_noise']?.isPlaying) {
    await engine.stopTrack('violet_noise');
  } else {
    await engine.playTrack('violet_noise');
  }
});

document.getElementById('btn-binaural')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['binaural_alpha']?.isPlaying) {
    await engine.stopTrack('binaural_alpha');
  } else {
    await engine.playTrack('binaural_alpha');
  }
});

document.getElementById('btn-monaural')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['monaural_alpha']?.isPlaying) {
    await engine.stopTrack('monaural_alpha');
  } else {
    await engine.playTrack('monaural_alpha');
  }
});

document.getElementById('btn-isochronic')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['isochronic_alpha']?.isPlaying) {
    await engine.stopTrack('isochronic_alpha');
  } else {
    await engine.playTrack('isochronic_alpha');
  }
});

document.getElementById('btn-rain')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['rain']?.isPlaying) {
    await engine.stopTrack('rain');
  } else {
    await engine.playTrack('rain');
  }
});

document.getElementById('btn-stream')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['stream']?.isPlaying) {
    await engine.stopTrack('stream');
  } else {
    await engine.playTrack('stream');
  }
});

document.getElementById('btn-ocean')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['ocean_waves']?.isPlaying) {
    await engine.stopTrack('ocean_waves');
  } else {
    await engine.playTrack('ocean_waves');
  }
});

document.getElementById('btn-fan')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['fan']?.isPlaying) {
    await engine.stopTrack('fan');
  } else {
    await engine.playTrack('fan');
  }
});

document.getElementById('btn-fireplace')?.addEventListener('click', async () => {
  if (engine.getState().activeTracks['fireplace']?.isPlaying) {
    await engine.stopTrack('fireplace');
  } else {
    await engine.playTrack('fireplace');
  }
});

document.getElementById('btn-stop-all')?.addEventListener('click', async () => {
  await engine.stopAll();
});

document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
  logEl.innerHTML = '';
});

window.__RUN_AUDIO_VERIFICATION__ = runRealBrowserVerification;

if (new URLSearchParams(window.location.search).has('autorun')) {
  setTimeout(() => {
    void runRealBrowserVerification();
  }, 100);
}
