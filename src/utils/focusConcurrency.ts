export class SessionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionConflictError';
  }
}

/**
 * Primary exclusive mutation lock for all read-modify-write operations on active focus state.
 * Serializes mutations across tabs using Web Locks API ('neurocalm_focus_mutation_lock').
 * Queueing lock without ifAvailable: true guarantees every tab gets its turn to authoritatively
 * re-read storage, validate version, and safely execute without deadlocks.
 */
export async function requestFocusMutationLock<T>(callback: () => Promise<T>): Promise<T> {
  if (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof navigator.locks?.request === 'function'
  ) {
    return new Promise<T>((resolve, reject) => {
      navigator.locks
        .request('neurocalm_focus_mutation_lock', async (lock) => {
          if (!lock) {
            reject(new SessionConflictError('Unable to acquire focus mutation lock.'));
            return;
          }
          try {
            const result = await callback();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .catch(reject);
    });
  }

  // Fallback for browsers without Web Locks API:
  // Re-reading authoritative storage immediately before writing provides best-effort protection.
  return callback();
}

/**
 * Backward-compatible alias routing all start operations through the unified mutation lock.
 */
export async function requestSessionStartLock<T>(callback: () => Promise<T>): Promise<T> {
  return requestFocusMutationLock(callback);
}

/**
 * Instantiate a BroadcastChannel for instant inter-tab session synchronization.
 * Returns null if the browser environment does not support BroadcastChannel.
 */
export function createFocusBroadcastChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
    try {
      return new BroadcastChannel('neurocalm_focus_channel');
    } catch {
      return null;
    }
  }
  return null;
}
