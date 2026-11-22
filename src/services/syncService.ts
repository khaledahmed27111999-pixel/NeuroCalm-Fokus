/**
 * NeuroCalm & Fokus — Live Cloud Synchronization Service
 * Phase CLOUD-1: Real-time & Batched RPC-Driven Synchronization Engine
 *
 * Architecture:
 * - Direct writes revoked; all mutations pass through transactional sync_apply_batch.
 * - Keyset pagination replication feed consumed via get_sync_changes.
 * - Outbox atomicity: mutations are strictly preserved on network errors.
 * - Local-first: all domain stores continue reading and writing to localStorage.
 */

import { getSupabaseClient } from '../lib/supabaseClient';
import {
  SyncStatusState,
  MutationOutcome,
  SyncChangesPage,
  SyncChangeRecord,
} from '../types/sync';
import {
  getPendingBatch,
  getPendingCount,
  removeAcknowledgedMutations,
  recordMutationRetry,
  enqueueMutation,
} from './outboxService';
import {
  loadDeviceCursor,
  saveDeviceCursor,
  updateHostedDeviceCursor,
} from './deviceService';
import { getAuthState, subscribeAuthState } from './authService';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  getBackupCandidateTasks,
} from '../storage/taskStorage';
import { Task, TaskStatus } from '../types/task';

type SyncListener = (state: SyncStatusState) => void;
const listeners = new Set<SyncListener>();

let syncState: SyncStatusState = {
  isSyncing: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isAuthenticated: false,
  userId: null,
  lastSyncedAt: null,
  lastSyncedRev: 0,
  pendingOutboxCount: 0,
  lastError: null,
};

let autoSyncTimer: any = null;

function notifySyncListeners(): void {
  syncState.pendingOutboxCount = getPendingCount();
  for (const listener of listeners) {
    listener({ ...syncState });
  }
}

/**
 * Maps a cloud task status (from Supabase) to the local TaskStatus model.
 * - 'pending' -> 'todo'
 * - 'in_progress' -> 'in_progress'
 * - 'completed' -> 'completed'
 * - any other value falls back safely to 'todo'
 */
export function mapCloudStatusToLocal(cloudStatus: unknown, fallback: TaskStatus = 'todo'): TaskStatus {
  if (cloudStatus === 'pending' || cloudStatus === 'todo') return 'todo';
  if (cloudStatus === 'in_progress') return 'in_progress';
  if (cloudStatus === 'completed') return 'completed';
  return fallback;
}

/**
 * Maps a local TaskStatus model to the cloud Supabase status schema.
 * - 'todo' -> 'pending'
 * - 'in_progress' -> 'in_progress'
 * - 'completed' -> 'completed'
 */
export function mapLocalStatusToCloud(localStatus: TaskStatus | undefined): string {
  if (localStatus === 'todo') return 'pending';
  if (localStatus === 'in_progress') return 'in_progress';
  if (localStatus === 'completed') return 'completed';
  return 'pending';
}

/**
 * Applies a batch of incoming server deltas to the local domain storage.
 */
function applyIncomingDeltasLocally(changes: SyncChangeRecord[]): void {
  if (changes.length === 0) return;

  const taskChanges = changes.filter((c) => c.entity_type === 'tasks');
  if (taskChanges.length > 0) {
    const { tasks } = loadTasksFromStorage();
    const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));

    for (const c of taskChanges) {
      if (c.operation === 'DELETE') {
        taskMap.delete(c.entity_id);
      } else if (c.operation === 'INSERT' || c.operation === 'UPDATE') {
        const d = c.record_data;
        const existing = taskMap.get(c.entity_id);
        const incomingUpdatedAt = typeof d.updated_at === 'string' ? new Date(d.updated_at).getTime() : Date.now();

        // Safety rule: Do not replace a strictly newer local task with an older cloud delta
        if (existing && existing.updatedAt > incomingUpdatedAt) {
          continue;
        }

        const updatedTask: Task = {
          id: c.entity_id,
          title: (d.title as string) || existing?.title || 'Untitled Task',
          description: (d.notes as string) ?? (d.description as string) ?? existing?.description,
          priority: (d.priority as any) === 'low' || (d.priority as any) === 'high' ? (d.priority as any) : 'medium',
          status: mapCloudStatusToLocal(d.status, existing?.status || 'todo'),
          dueDate: (d.due_date as string) ?? (d.dueDate as string) ?? existing?.dueDate,
          createdAt: existing?.createdAt || (typeof d.created_at === 'string' ? new Date(d.created_at).getTime() : Date.now()),
          updatedAt: incomingUpdatedAt,
        };
        taskMap.set(c.entity_id, updatedTask);
      }
    }

    saveTasksToStorage(Array.from(taskMap.values()));
  }

  // Other entity deltas (sleep schedules, presets, settings) can be reconciled similarly
}

/**
 * Pushes pending outbox mutations to the hosted Supabase instance via sync_apply_batch.
 */
async function pushOutboxBatch(client: any): Promise<{ pushedCount: number; maxServerRev: number }> {
  const batch = getPendingBatch(50);
  if (batch.length === 0) {
    return { pushedCount: 0, maxServerRev: 0 };
  }

  const payload = batch.map((m) => ({
    mutation_id: m.mutation_id,
    entity_type: m.entity_type,
    entity_id: m.entity_id,
    operation: m.operation,
    base_server_rev: m.base_server_rev,
    client_id: m.client_id,
    record_data: m.record_data,
  }));

  const { data, error } = await client.rpc('sync_apply_batch', {
    p_mutations: payload,
  });

  if (error) {
    const errorMsg = error.message || 'sync_apply_batch RPC error';
    batch.forEach((m) => recordMutationRetry(m.mutation_id, errorMsg));
    throw new Error(errorMsg);
  }

  const results: MutationOutcome[] = data?.results || [];
  const ackedIds: string[] = [];
  let maxRev = 0;

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const original = batch[i];

    if (res.status === 'applied' || res.status === 'noop_already_current') {
      ackedIds.push(original.mutation_id);
      if (res.serverRev && res.serverRev > maxRev) {
        maxRev = res.serverRev;
      }
    } else if (res.status === 'conflict') {
      // Conflict recorded by server in task_conflicts table; remove from outbox
      ackedIds.push(original.mutation_id);
      console.warn('[SyncService] Mutation OCC conflict:', res);
    } else {
      recordMutationRetry(original.mutation_id, res.reason || 'Mutation rejected by server');
    }
  }

  removeAcknowledgedMutations(ackedIds);
  return { pushedCount: ackedIds.length, maxServerRev: maxRev };
}

/**
 * Pulls incoming change feed deltas from the hosted Supabase instance via get_sync_changes.
 */
async function pullRemoteChanges(
  client: any,
  userId: string,
  targetRev: number
): Promise<{ newRev: number; newSeq: number }> {
  const cursor = loadDeviceCursor(userId);
  let afterRev = cursor.lastSyncedRev;
  let afterSeq = cursor.lastChangeSeq;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client.rpc('get_sync_changes', {
      p_after_rev: afterRev,
      p_after_change_seq: afterSeq,
      p_target_rev: Math.max(targetRev, afterRev + 1000),
      p_limit: 100,
    });

    if (error) {
      throw new Error(error.message || 'get_sync_changes RPC error');
    }

    const page: SyncChangesPage = data as SyncChangesPage;
    if (!page || !Array.isArray(page.changes)) {
      break;
    }

    if (page.changes.length > 0) {
      applyIncomingDeltasLocally(page.changes);
    }

    afterRev = page.lastRev;
    afterSeq = page.lastSeq;
    hasMore = page.hasMore;
  }

  cursor.lastSyncedRev = afterRev;
  cursor.lastChangeSeq = afterSeq;
  cursor.lastActiveAt = Date.now();
  saveDeviceCursor(userId, cursor);

  // Update remote device cursor registration
  updateHostedDeviceCursor(userId, afterRev).catch(() => {});

  return { newRev: afterRev, newSeq: afterSeq };
}

export const SYNCED_RECOVERED_STORAGE_PREFIX = 'neurocalm_synced_recovered_ids_';

/**
 * Specifically synchronizes tasks recovered from corrupted backup to Supabase.
 * - Targets ONLY candidate tasks present in the corrupted backup.
 * - Queries Supabase public.tasks directly under the active authenticated session (using RLS).
 * - Avoids creating mutations if task already exists on the server or in task_conflicts.
 * - Strictly preserves original UUIDs.
 * - Idempotent across multiple reloads.
 */
export async function syncRecoveredBackupTasks(
  userId: string
): Promise<{ enqueuedCount: number; alreadyOnServerCount: number }> {
  if (!userId) {
    return { enqueuedCount: 0, alreadyOnServerCount: 0 };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { enqueuedCount: 0, alreadyOnServerCount: 0 };
  }

  const auth = getAuthState();
  if (!auth.isAuthenticated || !auth.user || auth.user.id !== userId) {
    return { enqueuedCount: 0, alreadyOnServerCount: 0 };
  }

  // 1. Identify valid candidate tasks strictly from the backup that exist in active storage
  const backupCandidates = getBackupCandidateTasks();
  if (backupCandidates.length === 0) {
    return { enqueuedCount: 0, alreadyOnServerCount: 0 };
  }

  const { tasks: activeTasks } = loadTasksFromStorage();
  const activeMap = new Map(activeTasks.map((t) => [t.id, t]));
  const candidateTasks = backupCandidates.filter((t) => activeMap.has(t.id));
  if (candidateTasks.length === 0) {
    return { enqueuedCount: 0, alreadyOnServerCount: 0 };
  }

  // 2. Load already synced/confirmed recovered IDs for this user
  const syncedStorageKey = `${SYNCED_RECOVERED_STORAGE_PREFIX}${userId}`;
  let syncedIds = new Set<string>();
  try {
    const raw = localStorage.getItem(syncedStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        syncedIds = new Set(parsed);
      }
    }
  } catch {}

  const unverifiedCandidates = candidateTasks.filter((t) => !syncedIds.has(t.id));
  if (unverifiedCandidates.length === 0) {
    return { enqueuedCount: 0, alreadyOnServerCount: candidateTasks.length };
  }

  const candidateIds = unverifiedCandidates.map((t) => t.id);

  // 3. Query Supabase public.tasks using the authenticated session and RLS
  let serverExistingIds = new Set<string>();
  try {
    const { data, error } = await client
      .from('tasks')
      .select('id')
      .in('id', candidateIds);

    if (!error && Array.isArray(data)) {
      serverExistingIds = new Set(data.map((r: any) => r.id));
    }
  } catch (err) {
    console.warn('[SyncService] Failed to query existing tasks on server:', err);
    return { enqueuedCount: 0, alreadyOnServerCount: 0 };
  }

  // Also check if any are in task_conflicts
  let conflictExistingIds = new Set<string>();
  try {
    const { data: conflictData, error: conflictErr } = await client
      .from('task_conflicts')
      .select('task_id')
      .in('task_id', candidateIds);

    if (!conflictErr && Array.isArray(conflictData)) {
      conflictExistingIds = new Set(conflictData.map((r: any) => r.task_id));
    }
  } catch {}

  // 4. Inspect current Outbox to avoid duplicate mutations in flight
  const pendingMutations = getPendingBatch(100, userId);
  const pendingEntityIds = new Set(
    pendingMutations.filter((m) => m.entity_type === 'tasks').map((m) => m.entity_id)
  );

  let enqueuedCount = 0;
  let alreadyOnServerCount = 0;

  for (const candidate of unverifiedCandidates) {
    // If already on server (tasks or conflicts): mark synced, do NOT create mutation
    if (serverExistingIds.has(candidate.id) || conflictExistingIds.has(candidate.id)) {
      syncedIds.add(candidate.id);
      alreadyOnServerCount++;
      continue;
    }

    // If already in Outbox: mark in registry to avoid double queuing
    if (pendingEntityIds.has(candidate.id)) {
      syncedIds.add(candidate.id);
      continue;
    }

    // Safe enqueue using original UUID
    const currentTask = activeMap.get(candidate.id) || candidate;
    enqueueMutation(
      'tasks',
      currentTask.id, // Strictly original UUID
      'INSERT',
      {
        title: currentTask.title,
        notes: currentTask.description || null,
        priority: currentTask.priority,
        status: mapLocalStatusToCloud(currentTask.status),
        due_date: currentTask.dueDate || null,
      },
      0, // baseServerRev 0 for insert
      userId
    );
    syncedIds.add(currentTask.id);
    enqueuedCount++;
  }

  // 5. Persist updated synced IDs set
  try {
    localStorage.setItem(syncedStorageKey, JSON.stringify(Array.from(syncedIds)));
  } catch {}

  return { enqueuedCount, alreadyOnServerCount };
}

/**
 * Triggers an end-to-end synchronization cycle:
 * 1. Scoped reconciliation of recovered backup tasks if authenticated.
 * 2. Pushes pending outbox mutations via sync_apply_batch.
 * 3. Pulls remote delta feed changes via get_sync_changes.
 */
export async function triggerSync(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  const auth = getAuthState();
  if (!auth.isAuthenticated || !auth.user) {
    syncState.isAuthenticated = false;
    syncState.userId = null;
    notifySyncListeners();
    return { success: false, error: 'User is not authenticated.' };
  }

  if (syncState.isSyncing) {
    return { success: true }; // Deduplicate overlapping sync calls
  }

  syncState.isSyncing = true;
  syncState.isAuthenticated = true;
  syncState.userId = auth.user.id;
  syncState.lastError = null;
  notifySyncListeners();

  try {
    // Step 0: Scoped synchronization of recovered backup tasks if authenticated
    try {
      await syncRecoveredBackupTasks(auth.user.id);
    } catch (err) {
      console.warn('[SyncService] Scoped backup tasks sync skipped on error:', err);
    }

    // Step 1: Push outbox mutations
    const { maxServerRev } = await pushOutboxBatch(client);

    // Step 2: Pull remote deltas
    const { newRev } = await pullRemoteChanges(client, auth.user.id, maxServerRev);

    syncState.lastSyncedAt = Date.now();
    syncState.lastSyncedRev = newRev;
    syncState.lastError = null;
    notifySyncListeners();

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown synchronization error';
    syncState.lastError = message;
    notifySyncListeners();
    return { success: false, error: message };
  } finally {
    syncState.isSyncing = false;
    notifySyncListeners();
  }
}

/**
 * Initializes automatic background synchronization listeners.
 */
export function initSyncEngine(): () => void {
  // Listen for online / offline events
  const handleOnline = () => {
    syncState.isOnline = true;
    notifySyncListeners();
    triggerSync().catch(() => {});
  };
  const handleOffline = () => {
    syncState.isOnline = false;
    notifySyncListeners();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // Listen for auth state changes
  const unsubscribeAuth = subscribeAuthState((auth) => {
    syncState.isAuthenticated = auth.isAuthenticated;
    syncState.userId = auth.user?.id ?? null;
    notifySyncListeners();

    if (auth.isAuthenticated) {
      triggerSync().catch(() => {});
    }
  });

  // Background debounce sync interval
  if (!autoSyncTimer) {
    autoSyncTimer = setInterval(() => {
      if (syncState.isAuthenticated && syncState.isOnline && getPendingCount() > 0) {
        triggerSync().catch(() => {});
      }
    }, 15000); // 15-second debounce pulse
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
    unsubscribeAuth();
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  };
}

/**
 * Subscribes to sync state changes.
 */
export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  listener({ ...syncState, pendingOutboxCount: getPendingCount() });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns current sync status state snapshot.
 */
export function getSyncState(): SyncStatusState {
  return { ...syncState, pendingOutboxCount: getPendingCount() };
}
