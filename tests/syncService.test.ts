/**
 * NeuroCalm & Fokus — Phase CLOUD-1: Synchronization Engine & Outbox Unit Tests
 */

import assert from 'node:assert';

// Ensure in-memory localStorage for Node.js test runner
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
}
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  (globalThis as any).localStorage = new MockStorage();
}

import {
  enqueueMutation,
  getPendingBatch,
  getPendingCount,
  removeAcknowledgedMutations,
  recordMutationRetry,
  resetOutbox,
} from '../src/services/outboxService';
import {
  getOrCreateDeviceId,
  loadDeviceCursor,
  saveDeviceCursor,
} from '../src/services/deviceService';
import { getSyncState } from '../src/services/syncService';

console.log('--- Starting Phase CLOUD-1 Synchronization Unit Tests ---');

// 1. Device ID & Format Validation
{
  const deviceId1 = getOrCreateDeviceId();
  const deviceId2 = getOrCreateDeviceId();

  assert.strictEqual(typeof deviceId1, 'string', 'Device ID must be a string');
  assert.strictEqual(deviceId1, deviceId2, 'Device ID must be stable and persistent across calls');
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(deviceId1), `Device ID must be a valid RFC 4122 UUID v4: received ${deviceId1}`);
  console.log('✓ Device identity generates and persists stable RFC 4122 UUID v4');
}

// 2. Device Sync Cursor Persistence
{
  const testUserId = '00000000-0000-4000-8000-000000000001';
  const initialCursor = loadDeviceCursor(testUserId);

  assert.strictEqual(initialCursor.lastSyncedRev, 0, 'Initial cursor rev should be 0');
  assert.strictEqual(initialCursor.lastChangeSeq, 0, 'Initial cursor seq should be 0');

  const updatedCursor = {
    ...initialCursor,
    lastSyncedRev: 42,
    lastChangeSeq: 105,
    lastActiveAt: Date.now(),
  };
  saveDeviceCursor(testUserId, updatedCursor);

  const reloaded = loadDeviceCursor(testUserId);
  assert.strictEqual(reloaded.lastSyncedRev, 42, 'Reloaded cursor must match saved revision');
  assert.strictEqual(reloaded.lastChangeSeq, 105, 'Reloaded cursor must match saved change sequence');
  console.log('✓ Device sync cursors persist monotonically per user');
}

// 3. Durable Outbox Enqueue & Batch Slicing
{
  resetOutbox();
  assert.strictEqual(getPendingCount(), 0, 'Outbox must start empty');

  const entityId1 = '11111111-1111-4111-8111-111111111111';
  const mutation1 = enqueueMutation('tasks', entityId1, 'INSERT', { title: 'First Task', status: 'todo' }, 0);

  assert.strictEqual(getPendingCount(), 1, 'Outbox count should be 1 after enqueue');
  assert.strictEqual(mutation1.entity_type, 'tasks');
  assert.strictEqual(mutation1.operation, 'INSERT');
  assert.strictEqual(mutation1.retry_count, 0);

  const entityId2 = '22222222-2222-4222-8222-222222222222';
  const mutation2 = enqueueMutation('tasks', entityId2, 'UPDATE', { title: 'Updated Task', status: 'in_progress' }, 1);

  assert.strictEqual(getPendingCount(), 2, 'Outbox count should be 2');

  const batch = getPendingBatch(10);
  assert.strictEqual(batch.length, 2, 'Batch should contain both pending mutations in FIFO order');
  assert.strictEqual(batch[0].mutation_id, mutation1.mutation_id, 'First mutation in batch must match FIFO queue order');
  assert.strictEqual(batch[1].mutation_id, mutation2.mutation_id, 'Second mutation in batch must match FIFO queue order');

  console.log('✓ Outbox queue enqueues and maintains strict FIFO order');
}

// 4. Outbox Retry & Error Preservation (Never Drop Data on Network Errors)
{
  const batch = getPendingBatch(1);
  assert.strictEqual(batch.length, 1);
  const targetId = batch[0].mutation_id;

  recordMutationRetry(targetId, 'Network timeout connecting to server');
  const updatedBatch = getPendingBatch(1);
  assert.strictEqual(updatedBatch[0].retry_count, 1, 'Retry count must increment');
  assert.strictEqual(updatedBatch[0].last_error, 'Network timeout connecting to server', 'Error must be preserved');
  assert.strictEqual(getPendingCount(), 2, 'Mutations must NEVER be dropped on error');

  console.log('✓ Outbox increments retry count and preserves data safely on network errors');
}

// 5. Outbox Acknowledgment & Atomic Removal
{
  const batch = getPendingBatch(10);
  const removeId = batch[0].mutation_id;
  const keepId = batch[1].mutation_id;

  removeAcknowledgedMutations([removeId]);
  assert.strictEqual(getPendingCount(), 1, 'Outbox count should decrease by 1');

  const remaining = getPendingBatch(10);
  assert.strictEqual(remaining[0].mutation_id, keepId, 'Remaining mutation must be the unacknowledged one');

  removeAcknowledgedMutations([keepId]);
  assert.strictEqual(getPendingCount(), 0, 'Outbox should be empty after all acknowledged');

  console.log('✓ Acknowledged mutations are removed atomically without affecting unacknowledged items');
}

// 6. Sync Service Initial State & Unauthenticated Safety
{
  const state = getSyncState();
  assert.strictEqual(typeof state.isSyncing, 'boolean');
  assert.strictEqual(typeof state.pendingOutboxCount, 'number');
  console.log('✓ Sync service initializes cleanly and exposes observable state snapshot');
}

console.log('--- Phase CLOUD-1 Synchronization Unit Tests Completed Successfully ---');
