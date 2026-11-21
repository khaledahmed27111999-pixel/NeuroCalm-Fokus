/**
 * NeuroCalm & Fokus — React Hook for Sync State
 * Phase CLOUD-1: UI integration for cloud synchronization indicators and actions.
 */

import { useState, useEffect } from 'react';
import { SyncStatusState } from '../types/sync';
import {
  getSyncState,
  subscribeSyncState,
  triggerSync,
  initSyncEngine,
} from '../services/syncService';

export function useSync() {
  const [state, setState] = useState<SyncStatusState>(getSyncState());

  useEffect(() => {
    // Start background sync listener lifecycle
    const cleanupEngine = initSyncEngine();
    const unsubscribe = subscribeSyncState(setState);

    return () => {
      unsubscribe();
      cleanupEngine();
    };
  }, []);

  return {
    ...state,
    syncNow: triggerSync,
  };
}
