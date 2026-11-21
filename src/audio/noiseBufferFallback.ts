/**
 * NeuroCalm & Fokus — Procedural Noise AudioBuffer Fallback
 * Generates 30-second seamless looped AudioBuffers when AudioWorklet is unavailable.
 */

import {
  WhiteNoiseGenerator,
  PinkNoiseGenerator,
  BrownNoiseGenerator,
  VioletNoiseGenerator,
} from './dsp/noiseGenerators';
import { ProceduralNoiseId } from '../types/audio';

/**
 * Cache for generated fallback AudioBuffers to avoid redundant generation.
 */
const fallbackBufferCache = new Map<string, AudioBuffer>();

/**
 * Generate a 30-second procedural noise buffer with an equal-power boundary crossfade
 * to prevent audio clicks when looped.
 *
 * Limitation Notice:
 * Pre-generated AudioBuffers are periodic (repeating every 30 seconds), unlike
 * continuous AudioWorklet streams which are non-repeating infinite noise.
 */
export function generateProceduralNoiseBuffer(
  audioContext: AudioContext,
  noiseId: ProceduralNoiseId,
  durationSeconds = 30
): AudioBuffer {
  const cacheKey = `${noiseId}_${audioContext.sampleRate}_${durationSeconds}`;
  const existing = fallbackBufferCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const sampleRate = audioContext.sampleRate;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  // Use the exact production DSP generators
  let generator:
    | WhiteNoiseGenerator
    | PinkNoiseGenerator
    | BrownNoiseGenerator
    | VioletNoiseGenerator;
  if (noiseId === 'pink_noise') {
    generator = new PinkNoiseGenerator(Math.random);
  } else if (noiseId === 'brown_noise') {
    generator = new BrownNoiseGenerator(Math.random);
  } else if (noiseId === 'violet_noise') {
    generator = new VioletNoiseGenerator(Math.random);
  } else {
    generator = new WhiteNoiseGenerator(Math.random);
  }

  // Generate complete buffer
  generator.generateBlock(channelData, numSamples);

  // Apply a gentle 50ms equal-power crossfade at buffer boundaries for seamless looping
  const fadeSamples = Math.floor(sampleRate * 0.05); // 50ms
  for (let i = 0; i < fadeSamples; i++) {
    const progress = i / fadeSamples;
    // Equal-power crossfade coefficients
    const gainIn = Math.sin(progress * 0.5 * Math.PI);
    const gainOut = Math.cos(progress * 0.5 * Math.PI);

    const startIdx = i;
    const endIdx = numSamples - fadeSamples + i;

    // Blend the tail into the head
    const blended = channelData[startIdx] * gainIn + channelData[endIdx] * gainOut;
    channelData[startIdx] = blended;
    channelData[endIdx] = blended;
  }

  fallbackBufferCache.set(cacheKey, audioBuffer);
  return audioBuffer;
}

/**
 * Clear the fallback buffer cache if necessary.
 */
export function clearFallbackBufferCache(): void {
  fallbackBufferCache.clear();
}
