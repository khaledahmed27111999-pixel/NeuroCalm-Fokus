/**
 * NeuroCalm & Fokus — Bounded AudioBuffer LRU Cache
 * Enforces a strict buffer retention limit (default 4) AND byte budget (default 75 MB)
 * with active buffer pinning for currently audible tracks.
 */

import { SoundscapeId } from '../types/audio';

export const MAX_CACHED_BUFFERS = 4;
export const DEFAULT_MAX_CACHE_BYTES = 75 * 1024 * 1024; // 75 MB (78,643,200 bytes)

/**
 * Calculates raw PCM memory consumed by an AudioBuffer in bytes.
 * Web Audio decodes to 32-bit floating point PCM (4 bytes per sample per channel).
 */
export function calculateAudioBufferSize(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * 4;
}

interface CacheEntry {
  soundId: SoundscapeId;
  buffer: AudioBuffer;
  byteLength: number;
  lastAccessed: number;
}

export class AudioBufferCache {
  private cache = new Map<SoundscapeId, CacheEntry>();
  private pinned = new Set<SoundscapeId>();
  private pendingLoads = new Map<SoundscapeId, Promise<AudioBuffer | null>>();
  private accessSequence = 0;
  private readonly maxBuffers: number;
  private readonly maxBytes: number;

  constructor(
    maxBuffers: number = MAX_CACHED_BUFFERS,
    maxBytes: number = DEFAULT_MAX_CACHE_BYTES
  ) {
    this.maxBuffers = maxBuffers;
    this.maxBytes = maxBytes;
  }

  /**
   * Check if a buffer exists in cache. Updates lastAccessed.
   */
  get(soundId: SoundscapeId): AudioBuffer | null {
    const entry = this.cache.get(soundId);
    if (!entry) return null;
    entry.lastAccessed = ++this.accessSequence;
    return entry.buffer;
  }

  /**
   * Insert a decoded buffer into the cache.
   * Evicts the oldest unpinned buffer if count exceeds maxBuffers OR bytes exceed maxBytes.
   */
  put(soundId: SoundscapeId, buffer: AudioBuffer): void {
    const byteLength = calculateAudioBufferSize(buffer);
    this.cache.set(soundId, {
      soundId,
      buffer,
      byteLength,
      lastAccessed: ++this.accessSequence,
    });
    this.evictIfNecessary();
  }

  /**
   * Pin an active buffer so it cannot be evicted while playing.
   */
  pin(soundId: SoundscapeId): void {
    this.pinned.add(soundId);
  }

  /**
   * Unpin a stopped buffer, making it eligible for LRU eviction.
   */
  unpin(soundId: SoundscapeId): void {
    this.pinned.delete(soundId);
    this.evictIfNecessary();
  }

  /**
   * Check if an asset is currently pinned.
   */
  isPinned(soundId: SoundscapeId): boolean {
    return this.pinned.has(soundId);
  }

  /**
   * Current number of cached AudioBuffers.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Maximum buffer count limit.
   */
  getMaxBuffers(): number {
    return this.maxBuffers;
  }

  /**
   * Maximum byte budget limit.
   */
  getMaxBytes(): number {
    return this.maxBytes;
  }

  /**
   * Total decoded byte count of all cached AudioBuffers.
   */
  getTotalByteCount(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.byteLength;
    }
    return total;
  }

  /**
   * Decoded byte count of currently pinned (actively playing) AudioBuffers.
   */
  getPinnedByteCount(): number {
    let total = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.pinned.has(key)) {
        total += entry.byteLength;
      }
    }
    return total;
  }

  /**
   * Decoded byte count of unpinned (eligible for eviction) AudioBuffers.
   */
  getUnpinnedByteCount(): number {
    let total = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (!this.pinned.has(key)) {
        total += entry.byteLength;
      }
    }
    return total;
  }

  /**
   * List cached soundscape IDs.
   */
  getCachedKeys(): SoundscapeId[] {
    return Array.from(this.cache.keys());
  }

  /**
   * List currently pinned soundscape IDs.
   */
  getPinnedKeys(): SoundscapeId[] {
    return Array.from(this.pinned);
  }

  /**
   * Dedupes concurrent fetch/decode requests for the same asset.
   */
  async loadOrWait(
    soundId: SoundscapeId,
    loader: () => Promise<AudioBuffer | null>
  ): Promise<AudioBuffer | null> {
    const existing = this.get(soundId);
    if (existing) return existing;

    const pending = this.pendingLoads.get(soundId);
    if (pending) return pending;

    const loadPromise = (async () => {
      try {
        const buffer = await loader();
        if (buffer) {
          this.put(soundId, buffer);
        }
        return buffer;
      } finally {
        this.pendingLoads.delete(soundId);
      }
    })();

    this.pendingLoads.set(soundId, loadPromise);
    return loadPromise;
  }

  /**
   * Evict the oldest unpinned entry if total count > maxBuffers OR total bytes > maxBytes.
   */
  private evictIfNecessary(): void {
    while (
      this.cache.size > this.maxBuffers ||
      this.getTotalByteCount() > this.maxBytes
    ) {
      let oldestKey: SoundscapeId | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        // Active pinned buffers are immune to eviction
        if (!this.pinned.has(key) && entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }

      // If all cached buffers are currently pinned, we cannot evict further
      if (!oldestKey) {
        break;
      }

      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all entries and unpin all buffers (e.g. for testing or full reset).
   */
  clear(): void {
    this.cache.clear();
    this.pinned.clear();
    this.pendingLoads.clear();
  }
}
