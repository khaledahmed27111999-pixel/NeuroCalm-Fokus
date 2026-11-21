/**
 * NeuroCalm & Fokus — Relaxation Session Context & Orchestrator
 * Phase 3C: Dedicated orchestration layer coordinating breathing techniques,
 * multi-track accompaniment audio, explicit ownership, and conflict resolution.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  RelaxationSessionDefinition,
  RelaxationSessionContextType,
  ActiveSessionLiveState,
  RelaxationPreferences,
  SessionConflictState,
  SessionDurationMinutes,
} from '../types/relaxationSession';
import { SoundscapeId } from '../types/audio';
import {
  loadRelaxationPreferences,
  saveRelaxationPreferences,
} from '../storage/relaxationStorage';
import { useAudio } from '../hooks/useAudio';
import { useBreathing } from './BreathingContext';

const defaultIdleLiveState: ActiveSessionLiveState = {
  status: 'idle',
  definition: null,
  durationMinutes: 5,
  elapsedSeconds: 0,
  remainingSeconds: 300,
  settlingRemainingSeconds: 3,
  sessionOwnedTracks: [],
  preExistingMixerTracks: [],
  trackVolumes: {},
  trackMuted: {},
  keepAudioOnPause: false,
  isUntimedAwareness: true,
  tempoMultiplier: 1.0,
  isBreathingEnabled: true,
};

export const RelaxationSessionContext = createContext<
  RelaxationSessionContextType | undefined
>(undefined);

export const RelaxationSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audio = useAudio();
  const breathing = useBreathing();

  const [preferences, setPreferences] = useState<RelaxationPreferences>(() =>
    loadRelaxationPreferences()
  );
  const [liveState, setLiveState] = useState<ActiveSessionLiveState>(defaultIdleLiveState);
  const [setupSession, setSetupSession] = useState<RelaxationSessionDefinition | null>(null);
  const [conflictState, setConflictState] = useState<SessionConflictState | null>(null);

  // Mutable refs for timers and high-frequency tracking
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionOwnedTracksRef = useRef<SoundscapeId[]>([]);
  const isPausedRef = useRef<boolean>(false);
  const keepAudioOnPauseRef = useRef<boolean>(false);
  const isBreathingActiveRef = useRef<boolean>(false);
  const cachedVolumesBeforePauseRef = useRef<Partial<Record<SoundscapeId, number>>>({});
  const cachedOptionsRef = useRef<{
    isUntimedAwareness?: boolean;
    tempoMultiplier?: number;
    isBreathingEnabled?: boolean;
    keepAudioOnPause?: boolean;
    enabledTrackIds?: SoundscapeId[];
  }>({});

  const clearTimers = useCallback(() => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (settleIntervalRef.current) {
      clearInterval(settleIntervalRef.current);
      settleIntervalRef.current = null;
    }
  }, []);

  // Teardown ONLY session-owned tracks
  const teardownSessionOwnedTracks = useCallback(async () => {
    const tracksToStop = [...sessionOwnedTracksRef.current];
    sessionOwnedTracksRef.current = [];
    for (const trackId of tracksToStop) {
      try {
        await audio.stopTrack(trackId);
      } catch {
        // Safe against stopped or failed nodes
      }
    }
  }, [audio]);

  // Reactive AudioEngine watcher: guarantees session state resets if all session-owned tracks stop
  useEffect(() => {
    if (liveState.status === 'running' || liveState.status === 'paused') {
      const owned = sessionOwnedTracksRef.current;
      if (owned.length > 0) {
        const anyOwnedStillPlaying = owned.some((id) => audio.state.activeTracks[id]?.isPlaying);
        if (!anyOwnedStillPlaying) {
          // All session-owned tracks stopped externally (e.g. GlobalAudioBar stopAll, Web Lock yield, error)
          clearTimers();
          if (isBreathingActiveRef.current) {
            breathing.stopSession();
            isBreathingActiveRef.current = false;
          }
          sessionOwnedTracksRef.current = [];
          setLiveState(defaultIdleLiveState);
        }
      }
    }
  }, [audio.state.activeTracks, liveState.status, clearTimers, breathing]);

  // Setup modal handlers
  const startSetup = useCallback((session: RelaxationSessionDefinition) => {
    setSetupSession(session);
  }, []);

  const closeSetup = useCallback(() => {
    setSetupSession(null);
  }, []);

  // Internal launch executor after conflict verification
  const executeSessionLaunch = useCallback(
    async (
      session: RelaxationSessionDefinition,
      duration: SessionDurationMinutes,
      customVolumes: Partial<Record<SoundscapeId, number>> = {},
      options: {
        isUntimedAwareness?: boolean;
        tempoMultiplier?: number;
        isBreathingEnabled?: boolean;
        keepAudioOnPause?: boolean;
        enabledTrackIds?: SoundscapeId[];
      } = {}
    ): Promise<boolean> => {
      clearTimers();
      setSetupSession(null);
      setConflictState(null);

      const enabledTrackIds = options.enabledTrackIds ?? session.audioTracks.map((t) => t.soundId);
      const requestedTrackIds = session.audioTracks
        .filter((t) => enabledTrackIds.includes(t.soundId))
        .map((t) => t.soundId);
      const isBreathingEnabled =
        session.isBreathingSession || Boolean(options.isBreathingEnabled);

      const isUntimed = options.isUntimedAwareness ?? session.breathingConfig?.defaultUntimed ?? true;
      const tempoMultiplier = options.tempoMultiplier ?? session.breathingConfig?.tempoMultiplier ?? 1.0;
      const keepAudioOnPause = options.keepAudioOnPause ?? preferences.keepAudioOnPause;

      // 1. Establish track ownership
      sessionOwnedTracksRef.current = requestedTrackIds;
      isPausedRef.current = false;
      keepAudioOnPauseRef.current = keepAudioOnPause;
      isBreathingActiveRef.current = isBreathingEnabled;

      const durationSec = duration === 'open_ended' ? null : duration * 60;

      // Calculate initial volume map
      const initialVolumes: Partial<Record<SoundscapeId, number>> = {};
      for (const track of session.audioTracks) {
        initialVolumes[track.soundId] =
          customVolumes[track.soundId] ??
          preferences.customTrackVolumes[track.soundId] ??
          track.defaultVolume;
      }

      // 2. Start session-owned audio tracks with rollback safety (only enabled tracks)
      const startedTracks: SoundscapeId[] = [];
      const tracksToStart = session.audioTracks.filter((t) => requestedTrackIds.includes(t.soundId));
      try {
        for (const track of tracksToStart) {
          const success = await audio.playTrack(track.soundId);
          if (success) {
            startedTracks.push(track.soundId);
            const vol = initialVolumes[track.soundId] ?? track.defaultVolume;
            audio.setTrackVolume(track.soundId, vol);
          }
        }
      } catch {
        // Rollback on partial failure: stop only tracks started by this session
        for (const id of startedTracks) {
          void audio.stopTrack(id).catch(() => {});
        }
        sessionOwnedTracksRef.current = [];
        return false;
      }

      // Persist preferences
      const updatedPrefs: RelaxationPreferences = {
        lastSessionId: session.id,
        preferredDuration: duration,
        customTrackVolumes: {
          ...preferences.customTrackVolumes,
          ...initialVolumes,
        },
        keepAudioOnPause,
      };
      setPreferences(updatedPrefs);
      saveRelaxationPreferences(updatedPrefs);

      // 3. Configure breathing if active
      if (isBreathingEnabled && session.breathingConfig) {
        breathing.beginSession({
          techniqueId: session.breathingConfig.techniqueId,
          durationMinutes: typeof duration === 'number' ? (duration as 2 | 3 | 5 | 10) : 5,
          tempoMultiplier,
          retentionMode: session.breathingConfig.defaultRetentionMode,
          isUntimedAwareness: isUntimed,
          soundscapeId: 'silent', // Delegated entirely to RelaxationSessionContext
          instrumentalId: 'none',
          audioCueEnabled: false,
        });

        // 3-second Settling Countdown for Breathing Sessions
        setLiveState({
          status: 'settling',
          definition: session,
          durationMinutes: duration,
          elapsedSeconds: 0,
          remainingSeconds: durationSec,
          settlingRemainingSeconds: 3,
          sessionOwnedTracks: requestedTrackIds,
          preExistingMixerTracks: [],
          trackVolumes: initialVolumes,
          trackMuted: {},
          keepAudioOnPause,
          isUntimedAwareness: isUntimed,
          tempoMultiplier,
          isBreathingEnabled: true,
        });

        let settleSec = 3;
        settleIntervalRef.current = setInterval(() => {
          settleSec -= 1;
          if (settleSec <= 0) {
            if (settleIntervalRef.current) {
              clearInterval(settleIntervalRef.current);
              settleIntervalRef.current = null;
            }
            setLiveState((prev) => ({
              ...prev,
              status: 'running',
              settlingRemainingSeconds: 0,
            }));
            startSessionTimer(durationSec);
          } else {
            setLiveState((prev) => ({
              ...prev,
              settlingRemainingSeconds: settleSec,
            }));
          }
        }, 1000);
      } else {
        // Music-only session starts running immediately
        setLiveState({
          status: 'running',
          definition: session,
          durationMinutes: duration,
          elapsedSeconds: 0,
          remainingSeconds: durationSec,
          settlingRemainingSeconds: 0,
          sessionOwnedTracks: requestedTrackIds,
          preExistingMixerTracks: [],
          trackVolumes: initialVolumes,
          trackMuted: {},
          keepAudioOnPause,
          isUntimedAwareness: false,
          tempoMultiplier: 1.0,
          isBreathingEnabled: false,
        });
        startSessionTimer(durationSec);
      }

      return true;
    },
    [audio, breathing, clearTimers, preferences]
  );

  // Running interval timer for session duration
  const startSessionTimer = useCallback(
    (initialRemaining: number | null) => {
      let remaining = initialRemaining;
      let elapsed = 0;

      sessionTimerRef.current = setInterval(() => {
        if (isPausedRef.current) return;

        elapsed += 1;
        if (remaining !== null) {
          remaining -= 1;
          if (remaining <= 0) {
            clearTimers();
            // 1.5s gentle audio fade before completion
            void teardownSessionOwnedTracks();
            if (isBreathingActiveRef.current) {
              breathing.stopSession();
              isBreathingActiveRef.current = false;
            }
            setLiveState((prev) => ({
              ...prev,
              status: 'completed',
              remainingSeconds: 0,
              elapsedSeconds: elapsed,
            }));
            return;
          }
        }

        setLiveState((prev) => ({
          ...prev,
          elapsedSeconds: elapsed,
          remainingSeconds: remaining,
        }));
      }, 1000);
    },
    [breathing, clearTimers, teardownSessionOwnedTracks]
  );

  // Begin Session with Conflict Detection
  const beginSession = useCallback(
    async (
      session: RelaxationSessionDefinition,
      duration: SessionDurationMinutes,
      customVolumes: Partial<Record<SoundscapeId, number>> = {},
      options: {
        isUntimedAwareness?: boolean;
        tempoMultiplier?: number;
        isBreathingEnabled?: boolean;
        keepAudioOnPause?: boolean;
        enabledTrackIds?: SoundscapeId[];
      } = {}
    ): Promise<boolean> => {
      const activeMixerTrackIds = (Object.keys(audio.state.activeTracks) as SoundscapeId[]).filter(
        (id) => audio.state.activeTracks[id]?.isPlaying
      );
      const enabledTrackIds = options.enabledTrackIds ?? session.audioTracks.map((t) => t.soundId);
      const requestedTrackIds = session.audioTracks
        .filter((t) => enabledTrackIds.includes(t.soundId))
        .map((t) => t.soundId);

      // Check conflict conditions
      if (activeMixerTrackIds.length > 0) {
        setSetupSession(null);
        const duplicateTrackIds = requestedTrackIds.filter((id) =>
          activeMixerTrackIds.includes(id)
        );
        const totalCount = activeMixerTrackIds.length + requestedTrackIds.length;
        const isCapacityExceeded = totalCount > 4;
        const canKeepPlayingAlongside = duplicateTrackIds.length === 0 && !isCapacityExceeded;

        let disableReasonKey: string | undefined;
        if (duplicateTrackIds.length > 0) {
          disableReasonKey = 'sessionConflictDuplicateWarning';
        } else if (isCapacityExceeded) {
          disableReasonKey = 'sessionConflictCapacityWarning';
        }

        setConflictState({
          conflictingSession: session,
          requestedDuration: duration,
          activeMixerTrackIds,
          requestedTrackIds,
          duplicateTrackIds,
          isCapacityExceeded,
          canKeepPlayingAlongside,
          disableReasonKey,
        });

        // Store options and volumes for resolution
        cachedVolumesBeforePauseRef.current = customVolumes;
        cachedOptionsRef.current = options;
        return false;
      }

      // No active mixer tracks: begin immediately
      return executeSessionLaunch(session, duration, customVolumes, options);
    },
    [audio.state.activeTracks, executeSessionLaunch]
  );

  // Conflict Resolution Choices
  const resolveConflictAndBegin = useCallback(
    async (choice: 'stop_existing' | 'keep_alongside' | 'cancel') => {
      if (!conflictState) return;

      if (choice === 'cancel') {
        setConflictState(null);
        return;
      }

      const { conflictingSession, requestedDuration } = conflictState;
      const customVols = cachedVolumesBeforePauseRef.current;
      const cachedOpts = cachedOptionsRef.current;

      if (choice === 'stop_existing') {
        // Explicit user consent: stop existing sounds, wait for fade, then start
        await audio.stopAll();
        await new Promise((r) => setTimeout(r, 200));
        await executeSessionLaunch(conflictingSession, requestedDuration, customVols, cachedOpts);
      } else if (choice === 'keep_alongside') {
        if (!conflictState.canKeepPlayingAlongside) return;
        await executeSessionLaunch(conflictingSession, requestedDuration, customVols, cachedOpts);
      }
    },
    [audio, conflictState, executeSessionLaunch]
  );

  // Synchronized Pause
  const pauseSession = useCallback(() => {
    if (liveState.status !== 'running') return;
    isPausedRef.current = true;

    if (isBreathingActiveRef.current) {
      breathing.pauseSession();
    }

    if (!keepAudioOnPauseRef.current) {
      // Softly ramp session-owned audio to zero
      const cached: Partial<Record<SoundscapeId, number>> = {};
      for (const id of sessionOwnedTracksRef.current) {
        cached[id] = liveState.trackVolumes[id] ?? 0.7;
        audio.setTrackVolume(id, 0.0);
      }
      cachedVolumesBeforePauseRef.current = cached;
    }

    setLiveState((prev) => ({ ...prev, status: 'paused' }));
  }, [audio, breathing, liveState.status, liveState.trackVolumes]);

  // Synchronized Resume
  const resumeSession = useCallback(() => {
    if (liveState.status !== 'paused') return;
    isPausedRef.current = false;

    if (isBreathingActiveRef.current) {
      breathing.resumeSession();
    }

    if (!keepAudioOnPauseRef.current) {
      // Restore session-owned audio levels
      for (const id of sessionOwnedTracksRef.current) {
        const restoredVol =
          cachedVolumesBeforePauseRef.current[id] ??
          liveState.trackVolumes[id] ??
          0.7;
        audio.setTrackVolume(id, restoredVol);
      }
    }

    setLiveState((prev) => ({ ...prev, status: 'running' }));
  }, [audio, breathing, liveState.status, liveState.trackVolumes]);

  // Immediate Clean Teardown
  const breathingStopSession = breathing.stopSession;
  const stopSession = useCallback(async () => {
    clearTimers();
    if (isBreathingActiveRef.current) {
      breathingStopSession();
      isBreathingActiveRef.current = false;
    }
    await teardownSessionOwnedTracks();
    isPausedRef.current = false;
    setLiveState(defaultIdleLiveState);
    setConflictState(null);
  }, [breathingStopSession, clearTimers, teardownSessionOwnedTracks]);

  // Completion Dismissal
  const dismissCompletion = useCallback(() => {
    setLiveState(defaultIdleLiveState);
  }, []);

  // In-Player Volume Adjustment
  const setSessionTrackVolume = useCallback(
    (soundId: SoundscapeId, volume: number) => {
      const clamped = Math.max(0.0, Math.min(1.0, volume));
      audio.setTrackVolume(soundId, clamped);

      setLiveState((prev) => ({
        ...prev,
        trackVolumes: {
          ...prev.trackVolumes,
          [soundId]: clamped,
        },
      }));

      // Update preferences
      setPreferences((prev) => {
        const updated = {
          ...prev,
          customTrackVolumes: {
            ...prev.customTrackVolumes,
            [soundId]: clamped,
          },
        };
        saveRelaxationPreferences(updated);
        return updated;
      });
    },
    [audio]
  );

  // In-Player Mute Toggle
  const toggleSessionTrackMute = useCallback(
    (soundId: SoundscapeId) => {
      const isMuted = Boolean(liveState.trackMuted[soundId]);
      if (isMuted) {
        const originalVol = liveState.trackVolumes[soundId] ?? 0.7;
        audio.setTrackVolume(soundId, originalVol);
        setLiveState((prev) => ({
          ...prev,
          trackMuted: { ...prev.trackMuted, [soundId]: false },
        }));
      } else {
        audio.setTrackVolume(soundId, 0.0);
        setLiveState((prev) => ({
          ...prev,
          trackMuted: { ...prev.trackMuted, [soundId]: true },
        }));
      }
    },
    [audio, liveState.trackMuted, liveState.trackVolumes]
  );

  // Keep Audio on Pause Toggle
  const toggleKeepAudioOnPause = useCallback(() => {
    setLiveState((prev) => {
      const next = !prev.keepAudioOnPause;
      keepAudioOnPauseRef.current = next;
      setPreferences((p) => {
        const updated = { ...p, keepAudioOnPause: next };
        saveRelaxationPreferences(updated);
        return updated;
      });
      return { ...prev, keepAudioOnPause: next };
    });
  }, []);

  // View Unmount Lifecycle Handler (called when RecoverView unmounts)
  const handleRecoverViewUnmount = useCallback(() => {
    if (liveState.status === 'running' || liveState.status === 'paused' || liveState.status === 'settling') {
      if (isBreathingActiveRef.current) {
        // Guided breathing cannot run invisibly in background: clean teardown
        void stopSession();
      } else {
        // Music-only session continues in background via GlobalAudioBar!
      }
    }
  }, [liveState.status, stopSession]);

  const contextValue: RelaxationSessionContextType = useMemo(
    () => ({
      liveState,
      preferences,
      conflictState,
      setupSession,
      startSetup,
      closeSetup,
      beginSession,
      resolveConflictAndBegin,
      pauseSession,
      resumeSession,
      stopSession,
      dismissCompletion,
      setSessionTrackVolume,
      toggleSessionTrackMute,
      toggleKeepAudioOnPause,
      handleRecoverViewUnmount,
    }),
    [
      liveState,
      preferences,
      conflictState,
      setupSession,
      startSetup,
      closeSetup,
      beginSession,
      resolveConflictAndBegin,
      pauseSession,
      resumeSession,
      stopSession,
      dismissCompletion,
      setSessionTrackVolume,
      toggleSessionTrackMute,
      toggleKeepAudioOnPause,
      handleRecoverViewUnmount,
    ]
  );

  return (
    <RelaxationSessionContext.Provider value={contextValue}>
      {children}
    </RelaxationSessionContext.Provider>
  );
};

export function useRelaxationSession(): RelaxationSessionContextType {
  const context = useContext(RelaxationSessionContext);
  if (!context) {
    throw new Error('useRelaxationSession must be used within a RelaxationSessionProvider');
  }
  return context;
}
