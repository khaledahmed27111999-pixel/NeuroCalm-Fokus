/**
 * NeuroCalm & Fokus — Device Identity & Cursor Persistence Service
 * Phase CLOUD-1: Stable client identification and monotonic sync checkpointing.
 */

import { DeviceCursor } from '../types/sync';
import { getSupabaseClient } from '../lib/supabaseClient';

const DEVICE_ID_KEY = 'neurocalm_device_id';
const DEVICE_CURSOR_PREFIX = 'neurocalm_cursor_';

let inMemoryDeviceId: string | null = null;

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves the persistent device ID from local storage, or generates and saves a new one.
 */
export function getOrCreateDeviceId(): string {
  if (inMemoryDeviceId) {
    return inMemoryDeviceId;
  }

  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      inMemoryDeviceId = existing;
      return existing;
    }
    const newId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    inMemoryDeviceId = newId;
    return newId;
  } catch {
    inMemoryDeviceId = generateUUID();
    return inMemoryDeviceId;
  }
}

/**
 * Returns a human-friendly name for this device.
 */
export function getDeviceName(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'Web' : 'Node';
  return `NeuroCalm Web (${platform})`;
}

/**
 * Loads the local sync cursor for a given user.
 */
export function loadDeviceCursor(userId: string): DeviceCursor {
  const deviceId = getOrCreateDeviceId();
  const fallback: DeviceCursor = {
    deviceId,
    deviceName: getDeviceName(),
    lastSyncedRev: 0,
    lastChangeSeq: 0,
    lastActiveAt: Date.now(),
  };

  try {
    const raw = localStorage.getItem(`${DEVICE_CURSOR_PREFIX}${userId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      deviceId: parsed.deviceId || deviceId,
      deviceName: parsed.deviceName || getDeviceName(),
      lastSyncedRev: typeof parsed.lastSyncedRev === 'number' ? parsed.lastSyncedRev : 0,
      lastChangeSeq: typeof parsed.lastChangeSeq === 'number' ? parsed.lastChangeSeq : 0,
      lastActiveAt: typeof parsed.lastActiveAt === 'number' ? parsed.lastActiveAt : Date.now(),
    };
  } catch {
    return fallback;
  }
}

/**
 * Persists the local sync cursor for a given user.
 */
export function saveDeviceCursor(userId: string, cursor: DeviceCursor): void {
  try {
    localStorage.setItem(`${DEVICE_CURSOR_PREFIX}${userId}`, JSON.stringify(cursor));
  } catch (err) {
    console.warn('[DeviceService] Failed to persist local sync cursor:', err);
  }
}

/**
 * Registers or updates this device's cursor in the hosted Supabase device_sync_cursors table.
 * Direct table access is permitted for authenticated users by Migration 001.
 */
export async function updateHostedDeviceCursor(
  userId: string,
  lastSyncedRev: number
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const deviceId = getOrCreateDeviceId();
  const deviceName = getDeviceName();

  try {
    const { error } = await client
      .from('device_sync_cursors')
      .upsert({
        device_id: deviceId,
        user_id: userId,
        device_name: deviceName,
        last_synced_rev: lastSyncedRev,
        last_active_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[DeviceService] Hosted cursor update notice:', error.message);
    }
  } catch (err) {
    console.warn('[DeviceService] Network error updating hosted cursor:', err);
  }
}
