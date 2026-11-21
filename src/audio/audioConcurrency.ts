/**
 * NeuroCalm & Fokus — Multi-Tab Audio Concurrency & Web Lock Arbitration
 * Lock name: 'neurocalm_audio_lock_v1'
 * BroadcastChannel: 'neurocalm_audio_channel_v1'
 */

export const AUDIO_LOCK_NAME = 'neurocalm_audio_lock_v1';
export const AUDIO_BROADCAST_CHANNEL = 'neurocalm_audio_channel_v1';
export const LOCK_REQUEST_TIMEOUT_MS = 500;

export interface AudioBroadcastMessage {
  type: 'CLAIM_PLAYBACK_REQUEST' | 'PLAYBACK_STARTED' | 'PLAYBACK_STOPPED' | 'YIELD_PLAYBACK';
  tabId: string;
  requestId?: string;
  timestamp: number;
}

/**
 * Creates and manages cross-tab broadcast communication.
 */
export function createAudioBroadcastChannel(
  onMessage: (message: AudioBroadcastMessage) => void
): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    const channel = new BroadcastChannel(AUDIO_BROADCAST_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data && typeof event.data.type === 'string') {
        onMessage(event.data as AudioBroadcastMessage);
      }
    };
    return channel;
  } catch {
    return null;
  }
}

export interface PlaybackLockAcquisitionResult {
  acquired: boolean;
  reason?: 'granted' | 'timed_out' | 'aborted' | 'unsupported_fallback_granted' | 'intent_cancelled';
}

/**
 * Request exclusive playback ownership across all tabs.
 *
 * Implements a strict 500ms timeout guard with AbortController cancellation
 * and in-callback cancellation race protection.
 *
 * Architecture:
 * - Separates acquisition notification from lock retention.
 * - Resolves the returned Promise immediately upon genuine lock acquisition and ownership grant.
 * - Retains the underlying browser Web Lock via `onOwnershipYieldRequired()` until playback stops or the tab terminates.
 */
export function requestExclusivePlaybackLock(
  _tabId: string,
  hasActiveIntent: () => boolean,
  onOwnershipGranted: () => Promise<void>,
  onOwnershipYieldRequired: () => Promise<void>
): Promise<PlaybackLockAcquisitionResult> {
  // If Web Locks API is unavailable, use best-effort fallback
  if (
    typeof navigator === 'undefined' ||
    !navigator.locks ||
    typeof navigator.locks.request !== 'function'
  ) {
    if (!hasActiveIntent()) {
      return Promise.resolve({ acquired: false, reason: 'intent_cancelled' });
    }
    // Documented limitation: Fallback does not provide kernel-level atomicity across tabs
    return onOwnershipGranted().then(() => ({
      acquired: true,
      reason: 'unsupported_fallback_granted' as const,
    }));
  }

  return new Promise<PlaybackLockAcquisitionResult>((resolveAcquisition) => {
    let acquisitionSettled = false;
    const settleAcquisition = (res: PlaybackLockAcquisitionResult) => {
      if (!acquisitionSettled) {
        acquisitionSettled = true;
        clearTimeout(timeoutId);
        resolveAcquisition(res);
      }
    };

    const abortController = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      abortController.abort();
      settleAcquisition({ acquired: false, reason: 'timed_out' });
    }, LOCK_REQUEST_TIMEOUT_MS);

    // Request the exclusive lock from the browser
    navigator.locks
      .request(
        AUDIO_LOCK_NAME,
        { mode: 'exclusive', signal: abortController.signal },
        async (lock) => {
          clearTimeout(timeoutId);

          // 1. Verify if abort signal fired nearly simultaneously with grant
          if (abortController.signal.aborted || timedOut) {
            settleAcquisition({ acquired: false, reason: 'timed_out' });
            return;
          }

          // 2. Verify that the user still has active playback intent in this tab
          if (!hasActiveIntent()) {
            settleAcquisition({ acquired: false, reason: 'intent_cancelled' });
            return;
          }

          // 3. Verify valid lock object
          if (!lock) {
            settleAcquisition({ acquired: false, reason: 'aborted' });
            return;
          }

          try {
            // Signal ownership granted to the engine state
            await onOwnershipGranted();

            // Promptly notify acquisition caller that lock is acquired so AudioEngine can proceed
            settleAcquisition({ acquired: true, reason: 'granted' });

            // Retain the Web Lock until the engine signals yield or tab terminates
            await onOwnershipYieldRequired();
          } catch {
            // Callback yield resolution or engine abort
          }
        }
      )
      .catch((err: unknown) => {
        clearTimeout(timeoutId);
        const error = err as Error;
        if (error && (error.name === 'AbortError' || timedOut)) {
          settleAcquisition({ acquired: false, reason: 'timed_out' });
        } else {
          settleAcquisition({ acquired: false, reason: 'aborted' });
        }
      });
  });
}
