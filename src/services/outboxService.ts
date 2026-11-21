/**
 * NeuroCalm & Fokus — Durable Mutation Outbox Service
 * Phase CLOUD-2: Local-first queued mutation manager with tenant isolation.
 *
 * Guarantees:
 * 1. Mutations are never discarded on network failure.
 * 2. Mutation IDs are immutable across retries for idempotency.
 * 3. User isolation: User A's outbox is strictly isolated from User B's outbox.
 * 4. Safe guest queue: Unauthenticated mutations are held in guest outbox until account linking.
 */

import { SyncMutation, SyncEntityType, SyncOperation } from '../types/sync';
import { generateUUID, getOrCreateDeviceId } from './deviceService';
import { getActiveUserId } from './authService';

const OUTBOX_STORAGE_PREFIX = 'neurocalm_sync_outbox_';
const GUEST_OUTBOX_KEY = 'neurocalm_sync_outbox_guest';
const MAX_MUTATIONS_PER_BATCH = 50;

function resolveOutboxStorageKey(userId?: string | null): string {
  const uid = userId !== undefined ? userId : getActiveUserId();
  return uid ? `${OUTBOX_STORAGE_PREFIX}${uid}` : GUEST_OUTBOX_KEY;
}

function loadOutboxFromDisk(userId?: string | null): SyncMutation[] {
  try {
    const key = resolveOutboxStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is SyncMutation => {
      return (
        typeof m === 'object' &&
        m !== null &&
        typeof m.mutation_id === 'string' &&
        typeof m.entity_type === 'string' &&
        typeof m.entity_id === 'string' &&
        typeof m.operation === 'string' &&
        typeof m.base_server_rev === 'number' &&
        typeof m.client_id === 'string' &&
        typeof m.record_data === 'object'
      );
    });
  } catch (err) {
    console.warn('[OutboxService] Failed to load outbox from localStorage:', err);
    return [];
  }
}

function persistOutboxToDisk(mutations: SyncMutation[], userId?: string | null): void {
  try {
    const key = resolveOutboxStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(mutations));
  } catch (err) {
    console.warn('[OutboxService] Failed to persist outbox to localStorage:', err);
  }
}

/**
 * Enqueues a new domain mutation into the durable outbox.
 */
export function enqueueMutation(
  entityType: SyncEntityType,
  entityId: string,
  operation: SyncOperation,
  recordData: Record<string, unknown>,
  baseServerRev: number = 0,
  userId?: string | null
): SyncMutation {
  const mutations = loadOutboxFromDisk(userId);

  const mutation: SyncMutation = {
    mutation_id: generateUUID(),
    entity_type: entityType,
    entity_id: entityId,
    operation: operation,
    base_server_rev: baseServerRev,
    client_id: getOrCreateDeviceId(),
    record_data: recordData,
    created_at: new Date().toISOString(),
    retry_count: 0,
  };

  mutations.push(mutation);
  persistOutboxToDisk(mutations, userId);

  return mutation;
}

/**
 * Retrieves the current batch of pending mutations up to the batch limit for the active user.
 */
export function getPendingBatch(limit: number = MAX_MUTATIONS_PER_BATCH, userId?: string | null): SyncMutation[] {
  const mutations = loadOutboxFromDisk(userId);
  return mutations.slice(0, limit);
}

/**
 * Returns the total count of pending mutations in the outbox for the active user.
 */
export function getPendingCount(userId?: string | null): number {
  return loadOutboxFromDisk(userId).length;
}

/**
 * Removes successfully applied or acknowledged mutations from the active user's outbox.
 */
export function removeAcknowledgedMutations(mutationIds: string[], userId?: string | null): void {
  if (mutationIds.length === 0) return;

  const idSet = new Set(mutationIds);
  const current = loadOutboxFromDisk(userId);
  const updated = current.filter((m) => !idSet.has(m.mutation_id));
  persistOutboxToDisk(updated, userId);
}

/**
 * Records a failure or retry attempt on mutations without dropping them.
 */
export function recordMutationRetry(mutationId: string, errorMessage: string, userId?: string | null): void {
  const mutations = loadOutboxFromDisk(userId);
  const index = mutations.findIndex((m) => m.mutation_id === mutationId);
  if (index !== -1) {
    mutations[index].retry_count += 1;
    mutations[index].last_error = errorMessage;
    persistOutboxToDisk(mutations, userId);
  }
}

/**
 * Safely transfers unauthenticated guest mutations to an authenticated user's outbox upon explicit account linking.
 */
export function linkGuestMutationsToUser(userId: string): number {
  if (!userId) return 0;
  const guestMutations = loadOutboxFromDisk(null);
  if (guestMutations.length === 0) return 0;

  const userMutations = loadOutboxFromDisk(userId);
  const combined = [...userMutations, ...guestMutations];

  persistOutboxToDisk(combined, userId);
  persistOutboxToDisk([], null); // Clear guest outbox after transfer

  return guestMutations.length;
}

/**
 * Clears the active outbox (used in unit tests or explicit local resets).
 */
export function resetOutbox(userId?: string | null): void {
  try {
    const key = resolveOutboxStorageKey(userId);
    localStorage.removeItem(key);
  } catch {
    // Ignore storage clear failure
  }
}
