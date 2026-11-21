import { spawn } from 'node:child_process';
import { writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
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
const TEMP_PROFILE = path.join(os.tmpdir(), `chrome-audio-process-${Date.now()}`);

console.log('--- Launching Chrome for Tier 1 Audio Processing & WebM Opus Encoding ---');

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

  const processingScript = `
    (async () => {
      const ctx = new AudioContext({ sampleRate: 48000 });

      // Equal-power circular loop crossfade helper
      function applyLoopCrossfade(buffer, fadeDurationSec) {
        const numChannels = buffer.numberOfChannels;
        const fadeSamples = Math.min(Math.floor(fadeDurationSec * buffer.sampleRate), Math.floor(buffer.length / 4));
        const outLength = buffer.length - fadeSamples;
        const outBuffer = ctx.createBuffer(numChannels, outLength, buffer.sampleRate);

        for (let ch = 0; ch < numChannels; ch++) {
          const inData = buffer.getChannelData(ch);
          const outData = outBuffer.getChannelData(ch);

          // Copy body
          for (let i = 0; i < outLength; i++) {
            outData[i] = inData[i];
          }

          // Crossfade: tail into head
          for (let i = 0; i < fadeSamples; i++) {
            const headIdx = i;
            const tailIdx = outLength + i;
            const theta = (Math.PI / 2) * (i / fadeSamples);
            const headGain = Math.sin(theta); // 0 -> 1
            const tailGain = Math.cos(theta); // 1 -> 0
            outData[headIdx] = inData[headIdx] * headGain + inData[tailIdx] * tailGain;
          }
        }
        return outBuffer;
      }

      // Gentle peak normalization helper (preserving dynamic contours)
      function normalizePeak(buffer, targetPeak = 0.7071) {
        let maxPeak = 0;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const data = buffer.getChannelData(ch);
          for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i]);
            if (a > maxPeak) maxPeak = a;
          }
        }
        if (maxPeak > 0) {
          const scale = targetPeak / maxPeak;
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
              data[i] *= scale;
            }
          }
        }
        return buffer;
      }

      // Slice buffer helper
      function sliceBuffer(buffer, startSec, durationSec) {
        const start = Math.floor(startSec * buffer.sampleRate);
        const len = Math.min(Math.floor(durationSec * buffer.sampleRate), buffer.length - start);
        const out = ctx.createBuffer(buffer.numberOfChannels, len, buffer.sampleRate);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const inData = buffer.getChannelData(ch);
          const outData = out.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            outData[i] = inData[start + i];
          }
        }
        return out;
      }

      // Convert dual-mono or stereo to single-channel mono
      function convertToMono(buffer) {
        if (buffer.numberOfChannels === 1) return buffer;
        const out = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
        const outData = out.getChannelData(0);
        const ch0 = buffer.getChannelData(0);
        const ch1 = buffer.getChannelData(1);
        for (let i = 0; i < buffer.length; i++) {
          outData[i] = 0.5 * (ch0[i] + ch1[i]);
        }
        return out;
      }

      // Assets to process
      const assetConfigs = [
        {
          id: 'rain',
          category: 'nature',
          rawFile: '/audio_candidates/rain_raw.ogg',
          targetDuration: 44.0,
          crossfadeSec: 1.5,
          targetPeak: 0.7071,
          toMono: false,
          bitrate: 64000
        },
        {
          id: 'stream',
          category: 'nature',
          rawFile: '/audio_candidates/stream_raw.wav',
          targetDuration: 60.0,
          crossfadeSec: 2.0,
          targetPeak: 0.7071,
          toMono: false,
          bitrate: 96000
        },
        {
          id: 'ocean_waves',
          category: 'nature',
          rawFile: '/audio_candidates/ocean_waves_luftrum.ogg',
          startOffset: 10.0,
          targetDuration: 62.0,
          crossfadeSec: 2.5,
          targetPeak: 0.8414,
          toMono: false,
          bitrate: 96000
        },
        {
          id: 'fan',
          category: 'environment',
          rawFile: '/audio_candidates/fan_raw.ogg',
          startOffset: 5.0,
          targetDuration: 52.0,
          crossfadeSec: 2.0,
          targetPeak: 0.7071,
          toMono: true, // Monophonic fan point source
          bitrate: 48000
        },
        {
          id: 'fireplace',
          category: 'environment',
          rawFile: '/audio_candidates/fireplace_raw.ogg',
          startOffset: 0.0,
          targetDuration: 58.0,
          crossfadeSec: 2.0,
          targetPeak: 0.7500,
          toMono: false,
          bitrate: 64000
        }
      ];

      console.log('Loading and conditioning candidate audio buffers in Chrome...');
      const conditionedBuffers = [];

      for (const config of assetConfigs) {
        const res = await fetch(config.rawFile);
        const rawBuffer = await ctx.decodeAudioData(await res.arrayBuffer());

        let sliced = rawBuffer;
        if (config.startOffset || (config.targetDuration && rawBuffer.duration > config.targetDuration)) {
          sliced = sliceBuffer(rawBuffer, config.startOffset || 0, config.targetDuration || rawBuffer.duration);
        }

        if (config.toMono) {
          sliced = convertToMono(sliced);
        }

        normalizePeak(sliced, config.targetPeak);
        const looped = applyLoopCrossfade(sliced, config.crossfadeSec);

        conditionedBuffers.push({
          config,
          buffer: looped
        });
      }

      console.log('Starting parallel WebM Opus MediaRecorder encoding...');

      // Record each conditioned buffer in real-time
      const recordPromises = conditionedBuffers.map(({ config, buffer }) => {
        return new Promise((resolve, reject) => {
          const dest = ctx.createMediaStreamDestination();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(dest);

          const recorder = new MediaRecorder(dest.stream, {
            mimeType: 'audio/webm; codecs=opus',
            audioBitsPerSecond: config.bitrate
          });

          const chunks = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' });
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            resolve({
              id: config.id,
              category: config.category,
              duration: buffer.duration,
              channels: buffer.numberOfChannels,
              sampleRate: buffer.sampleRate,
              byteLength: arrayBuffer.byteLength,
              base64
            });
          };

          recorder.start();
          source.start();

          // Stop recorder precisely when buffer playback finishes
          setTimeout(() => {
            try {
              recorder.stop();
              source.stop();
            } catch (err) {
              reject(err);
            }
          }, (buffer.duration * 1000) + 150);
        });
      });

      const encodedAssets = await Promise.all(recordPromises);
      await ctx.close();
      return encodedAssets;
    })()
  `;

  console.log('Triggering parallel encoding in Chrome (will take ~60 seconds to record in real time)...');
  const startTime = Date.now();

  const evalResult = await sendCommand('Runtime.evaluate', {
    expression: processingScript,
    awaitPromise: true,
    returnByValue: true,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Parallel encoding completed in ${durationSec}s!`);

  const encodedAssets = evalResult.result?.value;
  if (!encodedAssets || !Array.isArray(encodedAssets)) {
    throw new Error('Encoding failed: ' + JSON.stringify(evalResult));
  }

  // Save the encoded .webm files
  for (const asset of encodedAssets) {
    const targetDir = `public/audio/${asset.category}`;
    const targetPath = `${targetDir}/${asset.id}.webm`;
    const buffer = Buffer.from(asset.base64, 'base64');
    await writeFile(targetPath, buffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(`Saved ${targetPath} (${(buffer.length / 1024).toFixed(1)} KB, SHA-256: ${hash})`);
    asset.filePath = targetPath;
    asset.sha256 = hash;
    asset.sizeBytes = buffer.length;
    delete asset.base64; // free memory
  }

  // Now, test round-trip decoding in Chrome of all 5 newly saved .webm files!
  console.log('\nTesting round-trip decodeAudioData() on all 5 generated .webm files in Chrome...');
  const verifyScript = `
    (async () => {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const files = [
        { id: 'rain', path: '/audio/nature/rain.webm' },
        { id: 'stream', path: '/audio/nature/stream.webm' },
        { id: 'ocean_waves', path: '/audio/nature/ocean_waves.webm' },
        { id: 'fan', path: '/audio/environment/fan.webm' },
        { id: 'fireplace', path: '/audio/environment/fireplace.webm' }
      ];

      const metrics = [];

      for (const f of files) {
        const res = await fetch(f.path);
        if (!res.ok) throw new Error('Fetch failed: ' + f.path + ' (' + res.status + ')');
        const arrayBuf = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuf);

        let maxPeak = 0;
        let sumSquares = 0;
        let sumValues = 0;
        const channels = buffer.numberOfChannels;
        const len = buffer.length;

        const ch0 = buffer.getChannelData(0);
        const ch1 = channels > 1 ? buffer.getChannelData(1) : null;

        let crossCorr = 0;
        let s0 = 0;
        let s1 = 0;

        for (let i = 0; i < len; i++) {
          const v0 = ch0[i];
          const a0 = Math.abs(v0);
          if (a0 > maxPeak) maxPeak = a0;
          sumSquares += v0 * v0;
          sumValues += v0;

          if (ch1) {
            const v1 = ch1[i];
            const a1 = Math.abs(v1);
            if (a1 > maxPeak) maxPeak = a1;
            sumSquares += v1 * v1;
            sumValues += v1;
            crossCorr += v0 * v1;
            s0 += v0 * v0;
            s1 += v1 * v1;
          }
        }

        const totalSamples = len * channels;
        const rms = Math.sqrt(sumSquares / totalSamples);
        const dcOffset = sumValues / totalSamples;
        const corr = ch1 ? crossCorr / (Math.sqrt(s0 * s1) || 1) : null;

        // Seam delta
        const delta0 = Math.abs(ch0[0] - ch0[len - 1]);
        const delta1 = ch1 ? Math.abs(ch1[0] - ch1[len - 1]) : 0;

        metrics.push({
          id: f.id,
          path: f.path,
          duration: buffer.duration.toFixed(2),
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          length: buffer.length,
          decodedMemoryBytes: len * channels * 4,
          decodedMemoryMB: ((len * channels * 4) / (1024 * 1024)).toFixed(2),
          samplePeak: maxPeak.toFixed(4),
          peakDbfs: (20 * Math.log10(maxPeak || 1e-5)).toFixed(2),
          rms: rms.toFixed(4),
          rmsDbfs: (20 * Math.log10(rms || 1e-5)).toFixed(2),
          dcOffset: dcOffset.toFixed(6),
          stereoCorrelation: corr !== null ? corr.toFixed(4) : 'N/A (mono)',
          loopSeamDelta: Math.max(delta0, delta1).toFixed(4),
          clipping: maxPeak >= 0.999
        });
      }

      await ctx.close();
      return metrics;
    })()
  `;

  const verifyRes = await sendCommand('Runtime.evaluate', {
    expression: verifyScript,
    awaitPromise: true,
    returnByValue: true,
  });

  const finalMetrics = verifyRes.result?.value;
  console.log('\n========================================================================');
  console.log('FINAL PRODUCTION WEBM/OPUS ASSET METRICS (ROUND-TRIP VERIFIED IN CHROME):');
  console.log('========================================================================');
  console.log(JSON.stringify(finalMetrics, null, 2));
  console.log('========================================================================\n');

  ws.close();
  cleanup();
}

run().catch((err) => {
  console.error('Processing Pipeline Failed:', err);
  cleanup();
  process.exit(1);
});
