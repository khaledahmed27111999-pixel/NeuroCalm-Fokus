/**
 * NeuroCalm & Fokus — Task Status Bidirectional Mapping & Safe Backup Recovery Test Suite
 *
 * Verifies:
 * 1. Receiving 'pending' from Supabase converts to 'todo'.
 * 2. Sending 'todo' converts to 'pending' for Supabase.
 * 3. 'in_progress' and 'completed' remain identical in both directions.
 * 4. Rejecting unknown/invalid status values.
 * 5. Recovering valid tasks with 'pending' status from the corrupted backup key.
 * 6. Idempotence: page reloads do not duplicate tasks.
 * 7. Conflict resolution: newer existing records are not replaced by older backup records.
 * 8. Backup key preservation: original backup key remains completely intact in localStorage.
 * 9. Non-regression: healthy local tasks are completely unaffected.
 */

import assert from 'node:assert';
import {
  mapCloudStatusToLocal,
  mapLocalStatusToCloud,
} from '../src/services/syncService';
import {
  isValidTaskRecord,
  loadTasksFromStorage,
  saveTasksToStorage,
  recoverTasksFromBackup,
  TASK_STORAGE_KEY,
  TASK_CORRUPTED_KEY,
} from '../src/storage/taskStorage';
import { Task } from '../src/types/task';

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

console.log('--- Starting Task Status Mapping & Recovery Tests ---');

// ============================================================================
// 1. Status Mapping Directional Tests
// ============================================================================
// 1. Receiving 'pending' from cloud -> converts to 'todo'
assert.strictEqual(mapCloudStatusToLocal('pending'), 'todo', 'Cloud pending must map to local todo');

// 2. Sending 'todo' to cloud -> converts to 'pending'
assert.strictEqual(mapLocalStatusToCloud('todo'), 'pending', 'Local todo must map to cloud pending');

// 3. 'in_progress' and 'completed' remain identical in both directions
assert.strictEqual(mapCloudStatusToLocal('in_progress'), 'in_progress', 'Cloud in_progress must map to local in_progress');
assert.strictEqual(mapCloudStatusToLocal('completed'), 'completed', 'Cloud completed must map to local completed');
assert.strictEqual(mapLocalStatusToCloud('in_progress'), 'in_progress', 'Local in_progress must map to cloud in_progress');
assert.strictEqual(mapLocalStatusToCloud('completed'), 'completed', 'Local completed must map to cloud completed');

// 4. Rejecting unknown status values
assert.strictEqual(mapCloudStatusToLocal('unknown_status', 'todo'), 'todo', 'Unknown cloud status must fallback safely');
assert.strictEqual(mapLocalStatusToCloud(undefined as any), 'pending', 'Undefined local status must fallback to pending');

const seen = new Set<string>();
const invalidStatusTask = {
  id: 'task-1',
  title: 'Test Task',
  priority: 'medium',
  status: 'unknown_status',
  createdAt: 1000,
  updatedAt: 1000,
};
assert.strictEqual(
  isValidTaskRecord(invalidStatusTask, seen),
  false,
  'isValidTaskRecord must reject unknown status'
);

// Normalization: 'pending' in isValidTaskRecord converts to 'todo' and passes
const pendingTask = {
  id: 'task-2',
  title: 'Pending Task',
  priority: 'high',
  status: 'pending',
  createdAt: 1000,
  updatedAt: 1000,
};
assert.strictEqual(
  isValidTaskRecord(pendingTask, seen),
  true,
  'isValidTaskRecord must normalize pending to todo'
);
assert.strictEqual(pendingTask.status, 'todo', 'pendingTask status must be normalized to todo');

console.log('✓ 1-4: Status mapping and validation rules passed');

// ============================================================================
// 5. Safe Recovery from Backup
// ============================================================================
mockStorage.clear();

const validBackupPayload = [
  {
    id: 'recovered-task-1',
    title: 'Important Brain Dump Task',
    description: 'Recovered from backup',
    priority: 'high',
    status: 'pending', // Was pending!
    createdAt: 1700000000000,
    updatedAt: 1700000005000,
  },
  {
    id: 'corrupted-record-broken',
    title: '', // Invalid empty title
    priority: 'low',
    status: 'pending',
    createdAt: 1700000000000,
    updatedAt: 1700000005000,
  },
];

mockStorage.setItem(TASK_CORRUPTED_KEY, JSON.stringify(validBackupPayload));
mockStorage.setItem(TASK_STORAGE_KEY, JSON.stringify([]));

const { tasks: recoveredList, status: status1 } = loadTasksFromStorage();

// 5. Recovering pending from backup
assert.strictEqual(recoveredList.length, 1, 'Exactly 1 valid task should be recovered');
assert.strictEqual(recoveredList[0].id, 'recovered-task-1');
assert.strictEqual(recoveredList[0].title, 'Important Brain Dump Task');
assert.strictEqual(recoveredList[0].status, 'todo', 'Recovered task status must be todo');
assert.strictEqual(status1.hasCorruptedDataWarning, false, 'No warning should remain once valid task is recovered');

// 8. Backup key must remain completely intact in localStorage
assert.strictEqual(
  mockStorage.getItem(TASK_CORRUPTED_KEY),
  JSON.stringify(validBackupPayload),
  'Backup key must remain completely intact and untouched in localStorage'
);

console.log('✓ 5 & 8: Valid tasks safely recovered from backup and backup preserved');

// ============================================================================
// 6. Idempotence: Reloading Does Not Duplicate Tasks
// ============================================================================
const { tasks: reloadList, status: status2 } = loadTasksFromStorage();
assert.strictEqual(reloadList.length, 1, 'Reloading storage must be idempotent; task count must not double');
assert.strictEqual(reloadList[0].id, 'recovered-task-1');
assert.strictEqual(status2.hasCorruptedDataWarning, false);

console.log('✓ 6: Idempotence verified; page reloads do not duplicate tasks');

// ============================================================================
// 7. Conflict Resolution: Never Overwrite Newer with Older
// ============================================================================
// Update the task locally to be newer
const newerTask: Task = {
  ...reloadList[0],
  title: 'Updated Locally Newer Title',
  updatedAt: 1700000010000, // Newer than backup's 1700000005000
};
saveTasksToStorage([newerTask]);

// Trigger load (which inspects backup)
const { tasks: postConflictList } = loadTasksFromStorage();
assert.strictEqual(postConflictList.length, 1);
assert.strictEqual(
  postConflictList[0].title,
  'Updated Locally Newer Title',
  'Newer local task must NOT be replaced by older backup task'
);
assert.strictEqual(postConflictList[0].updatedAt, 1700000010000);

console.log('✓ 7: Newer records are strictly protected from older backup records');

// ============================================================================
// 9. Existing Healthy Tasks Remain Unaffected
// ============================================================================
const healthyTask: Task = {
  id: 'healthy-task-2',
  title: 'Healthy Active Task',
  priority: 'low',
  status: 'in_progress',
  createdAt: 1700000020000,
  updatedAt: 1700000020000,
};
saveTasksToStorage([newerTask, healthyTask]);

const { tasks: finalTasks, status: finalStatus } = loadTasksFromStorage();
assert.strictEqual(finalTasks.length, 2, 'Both tasks must exist');
const foundHealthy = finalTasks.find((t) => t.id === 'healthy-task-2');
assert(foundHealthy, 'Healthy task must be present');
assert.strictEqual(foundHealthy.status, 'in_progress', 'Healthy task in_progress status must be untouched');
assert.strictEqual(finalStatus.hasCorruptedDataWarning, false);

console.log('✓ 9: Existing healthy tasks remain completely intact');

console.log('--- All Task Status Mapping & Recovery Tests Passed Successfully ---');
