/**
 * NeuroCalm & Fokus — Client Synchronization Types & Interfaces
 * Phase CLOUD-1: Real-time & Batched RPC-Driven Synchronization Contracts
 */

export type SyncEntityType =
  | 'tasks'
  | 'sleep_schedules'
  | 'user_settings'
  | 'soundscape_presets'
  | 'focus_history'
  | 'sleep_prep_activities';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Durable client-side mutation record matching the server's sync_apply_batch schema.
 */
export interface SyncMutation {
  mutation_id: string; // RFC 4122 UUID v4
  entity_type: SyncEntityType;
  entity_id: string; // UUID v4
  operation: SyncOperation;
  base_server_rev: number;
  client_id: string; // Device ID (UUID v4)
  record_data: Record<string, unknown>;
  created_at: string; // ISO 8601 UTC timestamp
  retry_count: number;
  last_error?: string;
}

/**
 * Result returned by server for an individual mutation inside a batch.
 */
export interface MutationOutcome {
  status: 'applied' | 'conflict' | 'rejected' | 'noop_already_current';
  mutationId?: string;
  serverRev?: number;
  conflictType?: string;
  conflictId?: string;
  currentServerRev?: number;
  baseServerRev?: number;
  reason?: string;
}

/**
 * Individual delta record returned by get_sync_changes.
 */
export interface SyncChangeRecord {
  change_seq: number;
  server_rev: number;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;
  mutation_id: string;
  record_data: Record<string, unknown>;
}

/**
 * Page response returned by get_sync_changes stored procedure.
 */
export interface SyncChangesPage {
  changes: SyncChangeRecord[];
  hasMore: boolean;
  lastRev: number;
  lastSeq: number;
  targetRev: number;
}

/**
 * Observable synchronization lifecycle state.
 */
export interface SyncStatusState {
  isSyncing: boolean;
  isOnline: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  lastSyncedAt: number | null;
  lastSyncedRev: number;
  pendingOutboxCount: number;
  lastError: string | null;
}

/**
 * Persistent device registration cursor.
 */
export interface DeviceCursor {
  deviceId: string;
  deviceName: string;
  lastSyncedRev: number;
  lastChangeSeq: number;
  lastActiveAt: number;
}
