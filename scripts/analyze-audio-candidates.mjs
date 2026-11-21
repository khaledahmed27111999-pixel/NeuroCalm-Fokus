import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function resolveChromeExecutable() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  console.error('\n[Error] Unable to locate a Chromium or Google Chrome executable.');
  console.error('Please install Google Chrome or set the CHROME_PATH environment variable:');
  console.error('  Windows: set CHROME_PATH=C:\\Path\\To\\chrome.exe');
  console.error('  macOS/Linux: export CHROME_PATH=/path/to/google-chrome\n');
  process.exit(1);
}

const CHROME_PATH = resolveChromeExecutable();
const DEBUG_PORT = 9222;
const TEMP_PROFILE = path.join(os.tmpdir(), `chrome-audio-analyze-${Date.now()}`);

console.log('--- Launching Chrome for Candidate Audio Decoding & DSP Analysis ---');

const chromeProc = spawn(
  CHROME_PATH,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/',
  ],
  { stdio: 'ignore' }
);

function cleanup() {
  try {
    chromeProc.kill('SIGKILL');
  } catch {}
}

process.on('exit', cleanup);
process.on('SIGINT', cleanup);

async function waitForCDP() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for Chrome DevTools endpoint');
}

async function run() {
  const page = await waitForCDP();
  console.log(`Connected to Chrome DevTools: ${page.url}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  };

  await sendCommand('Runtime.enable');

  // Script to execute in Chrome's Web Audio context
  const evalScript = `
    (async () => {
      const ctx = new AudioContext();
      const candidates = [
        { id: 'rain', file: '/audio_candidates/rain_raw.ogg' },
        { id: 'stream', file: '/audio_candidates/stream_raw.wav' },
        { id: 'ocean_waves_1', file: '/audio_candidates/ocean_waves_luftrum.ogg' },
        { id: 'ocean_waves_2', file: '/audio_candidates/ocean_waves_raw.ogg' },
        { id: 'fan', file: '/audio_candidates/fan_raw.ogg' },
        { id: 'fireplace', file: '/audio_candidates/fireplace_raw.ogg' }
      ];

      const results = [];

      for (const c of candidates) {
        try {
          const res = await fetch(c.file);
          if (!res.ok) throw new Error('Fetch failed: ' + res.status);
          const arrayBuffer = await res.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);

          const channels = buffer.numberOfChannels;
          const length = buffer.length;
          const duration = buffer.duration;
          const sampleRate = buffer.sampleRate;
          const decodedMemoryBytes = length * channels * 4;

          let maxPeak = 0;
          let sumSquares = 0;
          let sumValues = 0;

          const ch0 = buffer.getChannelData(0);
          const ch1 = channels > 1 ? buffer.getChannelData(1) : null;

          let crossCorrelationSum = 0;
          let ch0SqSum = 0;
          let ch1SqSum = 0;

          for (let i = 0; i < length; i++) {
            const v0 = ch0[i];
            const abs0 = Math.abs(v0);
            if (abs0 > maxPeak) maxPeak = abs0;
            sumSquares += v0 * v0;
            sumValues += v0;

            if (ch1) {
              const v1 = ch1[i];
              const abs1 = Math.abs(v1);
              if (abs1 > maxPeak) maxPeak = abs1;
              sumSquares += v1 * v1;
              sumValues += v1;

              crossCorrelationSum += v0 * v1;
              ch0SqSum += v0 * v0;
              ch1SqSum += v1 * v1;
            }
          }

          const totalSamples = length * channels;
          const rms = Math.sqrt(sumSquares / totalSamples);
          const dcOffset = sumValues / totalSamples;
          const lufsApprox = 10 * Math.log10(rms * rms + 1e-12) - 0.691;
          const stereoCorrelation = ch1 ? crossCorrelationSum / (Math.sqrt(ch0SqSum * ch1SqSum) || 1) : null;

          // Loop boundary delta (difference between sample 0 and sample length-1)
          const loopDelta0 = Math.abs(ch0[0] - ch0[length - 1]);
          const loopDelta1 = ch1 ? Math.abs(ch1[0] - ch1[length - 1]) : 0;

          results.push({
            id: c.id,
            file: c.file,
            success: true,
            duration: duration,
            sampleRate: sampleRate,
            channels: channels,
            length: length,
            decodedMemoryBytes: decodedMemoryBytes,
            decodedMemoryMB: (decodedMemoryBytes / (1024 * 1024)).toFixed(2),
            samplePeak: maxPeak.toFixed(4),
            peakDbfs: (20 * Math.log10(maxPeak || 1e-5)).toFixed(2),
            rms: rms.toFixed(4),
            rmsDbfs: (20 * Math.log10(rms || 1e-5)).toFixed(2),
            lufsEstimate: lufsApprox.toFixed(2),
            dcOffset: dcOffset.toFixed(6),
            stereoCorrelation: stereoCorrelation !== null ? stereoCorrelation.toFixed(4) : 'N/A (mono)',
            loopSeamDelta: Math.max(loopDelta0, loopDelta1).toFixed(4),
            clippingDetected: maxPeak >= 0.999
          });
        } catch (err) {
          results.push({
            id: c.id,
            file: c.file,
            success: false,
            error: err.message
          });
        }
      }

      await ctx.close();
      return results;
    })()
  `;

  console.log('Evaluating Web Audio decodeAudioData() on all candidate files in Chrome...');
  const evalResult = await sendCommand('Runtime.evaluate', {
    expression: evalScript,
    awaitPromise: true,
    returnByValue: true,
  });

  const analysis = evalResult.result?.value;
  console.log('\n========================================================================');
  console.log('CHROME NATIVE decodeAudioData() DSP ANALYSIS RESULTS:');
  console.log('========================================================================');
  console.log(JSON.stringify(analysis, null, 2));
  console.log('========================================================================\n');

  ws.close();
  cleanup();
}

run().catch((err) => {
  console.error('Candidate Analysis Failed:', err);
  cleanup();
  process.exit(1);
});
