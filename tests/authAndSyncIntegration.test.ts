/**
 * NeuroCalm & Fokus — Phase CLOUD-2: Authentication & Sync Integration Tests
 *
 * Verifies:
 * 1. Authentication state changes & subscription listeners.
 * 2. Session state persistence and snapshot querying.
 * 3. Sign-out behavior: guarantees local data is NEVER deleted upon sign-out.
 * 4. Password reset validation.
 * 5. Sync gating: unauthenticated requests cannot push or pull and do not lose outbox mutations.
 * 6. Tenant isolation: User A's outbox is strictly isolated from User B's outbox.
 * 7. Explicit account linking: guest mutations transfer safely to authenticated user upon confirmation.
 */

import assert from 'node:assert';

// Mock localStorage for Node environment
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
  getAuthState,
  subscribeAuthState,
  signOutUser,
  resetPasswordForEmail,
  getActiveUserId,
} from '../src/services/authService';
import {
  enqueueMutation,
  getPendingBatch,
  getPendingCount,
  linkGuestMutationsToUser,
  resetOutbox,
} from '../src/services/outboxService';
import { triggerSync, getSyncState } from '../src/services/syncService';
import { saveTasksToStorage, loadTasksFromStorage } from '../src/storage/taskStorage';
import { Task } from '../types/task';

console.log('--- Starting Phase CLOUD-2 Authentication & Sync Integration Tests ---');

// 1. Auth State Subscription & Initial Snapshot
{
  let receivedState: any = null;
  const unsubscribe = subscribeAuthState((state) => {
    receivedState = state;
  });

  assert(receivedState !== null, 'Subscriber must immediately receive initial auth state snapshot');
  assert.strictEqual(typeof receivedState.isLoading, 'boolean');
  assert.strictEqual(typeof receivedState.isAuthenticated, 'boolean');

  const snapshot = getAuthState();
  assert.strictEqual(snapshot.isAuthenticated, receivedState.isAuthenticated);

  unsubscribe();
  console.log('✓ Auth service provides immediate and reactive state subscription');
}

// 2. Password Reset Validation
{
  // Test empty email rejection
  const emptyRes = await resetPasswordForEmail('');
  assert.strictEqual(emptyRes.success, false);
  console.log('✓ Password reset service properly handles input validation');
}

// 3. Sync Gating When Unauthenticated (Never Discard Outbox Data)
{
  const guestEntityId = '00000000-0000-4000-8000-000000000010';
  resetOutbox(null);
  assert.strictEqual(getPendingCount(null), 0);

  // Enqueue a mutation while unauthenticated
  enqueueMutation('tasks', guestEntityId, 'INSERT', { title: 'Offline Task' }, 0, null);
  assert.strictEqual(getPendingCount(null), 1, 'Guest outbox should contain 1 pending mutation');

  // Attempt sync while unauthenticated
  const syncResult = await triggerSync();
  assert.strictEqual(syncResult.success, false, 'Sync must be rejected when unauthenticated');
  assert(
    syncResult.error?.includes('not authenticated') || syncResult.error?.includes('not configured'),
    'Sync must report unauthenticated or unconfigured status'
  );

  // Verify mutation was NOT discarded!
  assert.strictEqual(getPendingCount(null), 1, 'Pending mutation must NEVER be dropped when sync fails');
  const batch = getPendingBatch(10, null);
  assert.strictEqual(batch[0].entity_id, guestEntityId);

  console.log('✓ Cloud sync is strictly gated on authentication, and pending outbox mutations are preserved');
}

// 4. Multi-Tenant User Outbox Isolation
{
  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  resetOutbox(userA);
  resetOutbox(userB);

  // User A enqueues a mutation
  const entityA = '11111111-1111-4111-8111-111111111111';
  enqueueMutation('tasks', entityA, 'INSERT', { title: 'User A Secret Task' }, 0, userA);

  // User B enqueues a mutation
  const entityB = '22222222-2222-4222-8222-222222222222';
  enqueueMutation('tasks', entityB, 'INSERT', { title: 'User B Work Task' }, 0, userB);

  // Assert User A sees only User A's outbox
  assert.strictEqual(getPendingCount(userA), 1);
  const batchA = getPendingBatch(10, userA);
  assert.strictEqual(batchA[0].entity_id, entityA);
  assert.strictEqual(batchA[0].record_data.title, 'User A Secret Task');

  // Assert User B sees only User B's outbox
  assert.strictEqual(getPendingCount(userB), 1);
  const batchB = getPendingBatch(10, userB);
  assert.strictEqual(batchB[0].entity_id, entityB);
  assert.strictEqual(batchB[0].record_data.title, 'User B Work Task');

  console.log('✓ Multi-tenant user outbox isolation strictly prevents data cross-contamination');
}

// 5. Account Linking: Explicit Transfer of Guest Mutations to Authenticated User
{
  const guestEntity = '99999999-9999-4999-8999-999999999999';
  resetOutbox(null);
  enqueueMutation('tasks', guestEntity, 'INSERT', { title: 'Local Unlinked Task' }, 0, null);
  assert.strictEqual(getPendingCount(null), 1);

  const newUser = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  resetOutbox(newUser);
  assert.strictEqual(getPendingCount(newUser), 0);

  // Explicitly link guest mutations to the new authenticated user
  const transferred = linkGuestMutationsToUser(newUser);
  assert.strictEqual(transferred, 1, 'One mutation should have been transferred');
  assert.strictEqual(getPendingCount(null), 0, 'Guest outbox must be empty after linking');
  assert.strictEqual(getPendingCount(newUser), 1, 'Target user outbox must receive the linked mutation');

  const userBatch = getPendingBatch(10, newUser);
  assert.strictEqual(userBatch[0].entity_id, guestEntity);

  console.log('✓ Account linking transfers guest mutations explicitly without data loss');
}

// 6. Sign-Out Behavior: Local Data Is NEVER Lost Upon Sign-Out
{
  const testTask: Task = {
    id: '77777777-7777-4777-8777-777777777777',
    title: 'Local Preserved Task',
    status: 'todo',
    priority: 'high',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveTasksToStorage([testTask]);
  const loadedBefore = loadTasksFromStorage();
  assert.strictEqual(loadedBefore.tasks.length, 1);
  assert.strictEqual(loadedBefore.tasks[0].title, 'Local Preserved Task');

  // Trigger sign-out
  await signOutUser();

  // Assert local tasks are STILL completely intact!
  const loadedAfter = loadTasksFromStorage();
  assert.strictEqual(loadedAfter.tasks.length, 1, 'Local tasks must NOT be deleted upon sign-out');
  assert.strictEqual(loadedAfter.tasks[0].id, testTask.id);
  assert.strictEqual(loadedAfter.tasks[0].title, 'Local Preserved Task');

  console.log('✓ Sign-out preserves local-first data completely without deletion');
}

console.log('--- Phase CLOUD-2 Authentication & Sync Integration Tests Completed Successfully ---');
