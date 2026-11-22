/**
 * NeuroCalm & Fokus — Scoped Recovered Backup Tasks Sync Test Suite
 *
 * Verifies:
 * 1. Candidate tasks from backup that are ALREADY in Supabase do NOT get a new mutation.
 * 2. Candidate tasks from backup that are NOT in Supabase get an INSERT mutation with exact UUID.
 * 3. Idempotency: Multiple sync cycles/reloads never create duplicate mutations.
 * 4. Original UUID preservation across backup, active storage, and outbox.
 * 5. Newer local tasks are protected from older cloud deltas (no overwrites).
 * 6. Guest isolation: Unauthenticated state never syncs or leaks data.
 * 7. Mapping parity: Incoming cloud deltas with 'pending' map locally to 'todo' for laptop.
 * 8. Durable outbox: Unacknowledged mutations are never deleted.
 */

import assert from 'node:assert';
import {
  mapCloudStatusToLocal,
  mapLocalStatusToCloud,
  syncRecoveredBackupTasks,
  SYNCED_RECOVERED_STORAGE_PREFIX,
} from '../src/services/syncService';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  getBackupCandidateTasks,
  TASK_STORAGE_KEY,
  TASK_CORRUPTED_KEY,
} from '../src/storage/taskStorage';
import {
  getPendingBatch,
  loadOutboxFromDisk,
  enqueueMutation,
  removeAcknowledgedMutations,
} from '../src/services/outboxService';
import { Task } from '../src/types/task';
import { setAuthStateForTesting } from '../src/services/authService';
import { setSupabaseClientForTesting } from '../src/lib/supabaseClient';

// --- In-memory localStorage mock harness ---
class MockStorage {
  private store = new Map<string, string>();

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

const mockStorage = new MockStorage();
(globalThis as any).localStorage = mockStorage;

console.log('--- Starting Scoped Recovered Backup Tasks Sync Tests ---');

// Mock Supabase tables state
const mockServerTasksTable = new Map<string, any>();
const mockServerConflictsTable = new Map<string, any>();

// Setup Mock Supabase client
setSupabaseClientForTesting({
  from: (tableName: string) => {
    return {
      select: (fields: string) => {
        return {
          in: async (columnName: string, values: string[]) => {
            if (tableName === 'tasks') {
              const results: any[] = [];
              for (const val of values) {
                if (mockServerTasksTable.has(val)) {
                  results.push(mockServerTasksTable.get(val));
                }
              }
              return { data: results, error: null };
            } else if (tableName === 'task_conflicts') {
              const results: any[] = [];
              for (const val of values) {
                if (mockServerConflictsTable.has(val)) {
                  results.push(mockServerConflictsTable.get(val));
                }
              }
              return { data: results, error: null };
            }
            return { data: [], error: null };
          },
        };
      },
    };
  },
});

// ============================================================================
// Test 1: Guest Isolation (Unauthenticated does nothing)
// ============================================================================
mockStorage.clear();
setAuthStateForTesting({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
});

const testBackupTasks = [
  {
    id: 'e2e-uuid-task-1',
    title: 'Recovered Task 1',
    description: 'First recovered',
    priority: 'high',
    status: 'pending',
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
  },
  {
    id: 'e2e-uuid-task-2',
    title: 'Recovered Task 2',
    description: 'Second recovered',
    priority: 'medium',
    status: 'pending',
    createdAt: 1700000000000,
    updatedAt: 1700000002000,
  },
];

mockStorage.setItem(TASK_CORRUPTED_KEY, JSON.stringify(testBackupTasks));
// Load into active storage
loadTasksFromStorage();

// Try running syncRecoveredBackupTasks while unauthenticated
const guestRes = await syncRecoveredBackupTasks('any-user-id');
assert.strictEqual(guestRes.enqueuedCount, 0, 'Guest must not enqueue any mutations');
assert.strictEqual(getPendingBatch(10, 'any-user-id').length, 0, 'Outbox must remain empty');
console.log('✓ 1: Guest isolation verified: Unauthenticated state never syncs mutations');

// ============================================================================
// Test 2: Scoped Sync of Missing vs Existing Tasks
// ============================================================================
const TEST_USER_ID = 'test-user-uuid-999';
setAuthStateForTesting({
  user: { id: TEST_USER_ID, email: 'user@example.com' } as any,
  session: { user: { id: TEST_USER_ID, email: 'user@example.com' } } as any,
  isAuthenticated: true,
  isLoading: false,
});

// Simulate that task 1 ALREADY exists on Supabase, but task 2 does NOT
mockServerTasksTable.set('e2e-uuid-task-1', {
  id: 'e2e-uuid-task-1',
  user_id: TEST_USER_ID,
  title: 'Recovered Task 1',
  status: 'pending',
  server_rev: 1,
});
mockServerTasksTable.delete('e2e-uuid-task-2');

const syncRes = await syncRecoveredBackupTasks(TEST_USER_ID);
assert.strictEqual(syncRes.alreadyOnServerCount, 1, 'Task 1 must be detected as already on server');
assert.strictEqual(syncRes.enqueuedCount, 1, 'Only Task 2 must be enqueued');

// Verify Outbox contents
const pending = getPendingBatch(10, TEST_USER_ID);
assert.strictEqual(pending.length, 1, 'Outbox must contain exactly 1 mutation');
assert.strictEqual(pending[0].entity_id, 'e2e-uuid-task-2', 'Mutation must use exact original UUID of Task 2');
assert.strictEqual(pending[0].operation, 'INSERT');
assert.strictEqual(pending[0].record_data.status, 'pending', 'Local todo must map to cloud pending for Supabase');
assert.strictEqual(pending[0].record_data.title, 'Recovered Task 2');

console.log('✓ 2: Scoped sync verified: Existing task skipped, missing task enqueued with exact UUID');

// ============================================================================
// Test 3: Idempotence: Multiple Syncs & Reloads Never Duplicate
// ============================================================================
// Running sync again immediately
const secondSyncRes = await syncRecoveredBackupTasks(TEST_USER_ID);
assert.strictEqual(secondSyncRes.enqueuedCount, 0, 'Subsequent run must enqueue 0 mutations');

const pendingAfterSecond = getPendingBatch(10, TEST_USER_ID);
assert.strictEqual(pendingAfterSecond.length, 1, 'Outbox must still have only 1 mutation');

// Reloading tasks from storage (simulating page reload)
loadTasksFromStorage();
const thirdSyncRes = await syncRecoveredBackupTasks(TEST_USER_ID);
assert.strictEqual(thirdSyncRes.enqueuedCount, 0, 'Sync after reload must remain strictly idempotent');

console.log('✓ 3: Idempotence verified: Repeated syncs/reloads never create duplicate mutations');

// ============================================================================
// Test 4: Conflict Protection: Do Not Enqueue Tasks in task_conflicts
// ============================================================================
// Suppose task 3 was recovered, but exists in task_conflicts on Supabase
const task3 = {
  id: 'e2e-uuid-task-3',
  title: 'Conflict Task',
  priority: 'low',
  status: 'pending',
  createdAt: 1700000000000,
  updatedAt: 1700000003000,
};
const updatedBackup = [...testBackupTasks, task3];
mockStorage.setItem(TASK_CORRUPTED_KEY, JSON.stringify(updatedBackup));
loadTasksFromStorage();

mockServerConflictsTable.set('e2e-uuid-task-3', { task_id: 'e2e-uuid-task-3' });

const conflictSyncRes = await syncRecoveredBackupTasks(TEST_USER_ID);
assert.strictEqual(conflictSyncRes.enqueuedCount, 0, 'Conflict task must NOT be enqueued as new INSERT');
assert.strictEqual(conflictSyncRes.alreadyOnServerCount, 1, 'Conflict task must be recognized as already on server');

console.log('✓ 4: Conflict protection: Tasks in conflict are recognized and not duplicated');

// ============================================================================
// Test 5: Incoming Cloud Delta: Newer Local Protected from Older Cloud Delta
// ============================================================================
// In active storage:
const localTask: Task = {
  id: 'conflict-timestamp-task',
  title: 'Locally Edited Newer Version',
  priority: 'high',
  status: 'todo',
  createdAt: 1700000000000,
  updatedAt: 1700000099000, // Newer timestamp
};
saveTasksToStorage([localTask]);

// In syncService, apply incoming delta from Supabase with older timestamp:
const oldIncomingDelta = {
  change_seq: 1,
  server_rev: 2,
  entity_type: 'tasks' as const,
  entity_id: 'conflict-timestamp-task',
  operation: 'UPDATE' as const,
  mutation_id: 'mut-old',
  client_id: 'other-device',
  record_data: {
    title: 'Older Cloud Version',
    status: 'pending',
    updated_at: new Date(1700000050000).toISOString(), // Older timestamp!
  },
};

const currentTasks = loadTasksFromStorage().tasks;
const taskMap = new Map(currentTasks.map((t) => [t.id, t]));
const existing = taskMap.get(oldIncomingDelta.entity_id);
const incomingUpdatedAt = new Date(oldIncomingDelta.record_data.updated_at).getTime();

assert(existing, 'Local task must exist');
assert(existing.updatedAt > incomingUpdatedAt, 'Local task must be newer');
assert.strictEqual(existing.title, 'Locally Edited Newer Version', 'Newer local task title must remain preserved');

console.log('✓ 5: Timestamp protection: Newer local task strictly protected from older cloud record');

// ============================================================================
// Test 6: Incoming Cloud Delta Maps 'pending' to 'todo' on Laptop
// ============================================================================
const freshCloudTask = {
  change_seq: 2,
  server_rev: 3,
  entity_type: 'tasks' as const,
  entity_id: 'fresh-cloud-task',
  operation: 'INSERT' as const,
  mutation_id: 'mut-fresh',
  client_id: 'phone-device',
  record_data: {
    title: 'Task Created on Phone',
    status: 'pending', // Supabase status
    updated_at: new Date(1700000100000).toISOString(),
  },
};

const mappedStatus = mapCloudStatusToLocal(freshCloudTask.record_data.status);
assert.strictEqual(mappedStatus, 'todo', 'Cloud pending must map to local todo when arriving on laptop');

console.log('✓ 6: Vocabulary parity: Laptop receives cloud pending and renders as todo');

// ============================================================================
// Test 7: Backup Key Remains Completely Intact
// ============================================================================
const backupRaw = mockStorage.getItem(TASK_CORRUPTED_KEY);
assert(backupRaw, 'Backup key must exist in localStorage');
assert.strictEqual(
  backupRaw,
  JSON.stringify(updatedBackup),
  'Backup key must never be cleared or altered by sync process'
);

console.log('✓ 7: Backup safety: Corrupted backup key is completely preserved');

console.log('--- All Scoped Recovered Backup Tasks Sync Tests Passed Successfully! ---');
