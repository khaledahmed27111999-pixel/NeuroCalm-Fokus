import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import {
  ActiveFocusSessionState,
  FocusCompletionResult,
  FocusContextType,
  FocusHistoryRecord,
  FocusMode,
} from '../types/focus';
import { PomodoroSequenceState } from '../types/pomodoro';
import {
  loadActiveFocusSession,
  saveActiveFocusSession,
  saveLatestCompletedResult,
  loadLatestCompletedResult,
} from '../storage/focusStorage';
import {
  archiveFocusResultInternal,
  loadFocusHistory,
  recoverLatestCompletedFromHistory,
} from '../storage/focusHistoryStorage';
import {
  formatTimeDisplay,
  createDefaultIdleSession,
  reconcileSessionOnResume,
} from '../utils/focusTimer';
import {
  requestFocusMutationLock,
  createFocusBroadcastChannel,
  SessionConflictError,
} from '../utils/focusConcurrency';
import {
  calculateNextInterval,
  createInitialPomodoroState,
} from '../utils/pomodoroSequence';
import { generateId } from '../utils/id';

interface MonotonicTimingAnchor {
  sessionId: string;
  version: number;
  perfBaseline: number;
  wallAnchor: number;
  accumulatedBaseline: number;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load and self-heal initial session from storage
  const [session, setSession] = useState<ActiveFocusSessionState>(() => {
    const loaded = loadActiveFocusSession();
    if (loaded) {
      const reconciled = reconcileSessionOnResume(loaded);

      // Startup self-healing: if reconciled completionResult is not yet archived, archive now
      if (reconciled.completionResult && !reconciled.completionResult.isArchived) {
        const isWork =
          reconciled.mode === 'standard' ||
          !reconciled.pomodoro ||
          reconciled.pomodoro.intervalType === 'work';

        if (isWork) {
          const record: FocusHistoryRecord = {
            sessionId: reconciled.completionResult.sessionId,
            mode: reconciled.mode,
            wasCompletedNaturally: reconciled.completionResult.wasCompletedNaturally,
            actualElapsedSeconds: reconciled.completionResult.actualElapsedSeconds,
            plannedDurationSeconds: reconciled.completionResult.plannedDurationSeconds,
            completedAt: reconciled.completionResult.completedAt,
            taskId: reconciled.completionResult.taskId,
            taskTitle: reconciled.completionResult.taskTitle,
            pomodoroIntervalIndex: reconciled.pomodoro?.cumulativeWorkIntervals,
          };
          archiveFocusResultInternal(record);
          reconciled.completionResult.isArchived = true;
        }
      }

      if (
        reconciled.status !== loaded.status ||
        reconciled.accumulatedElapsedSeconds !== loaded.accumulatedElapsedSeconds ||
        reconciled.completionResult?.isArchived !== loaded.completionResult?.isArchived
      ) {
        saveActiveFocusSession(reconciled);
        if (reconciled.completionResult) {
          saveLatestCompletedResult(reconciled.completionResult);
        }
      }
      return reconciled;
    }
    return createDefaultIdleSession(25, 'standard');
  });

  const [mode, setModeState] = useState<FocusMode>(session.mode || 'standard');
  const [history, setHistory] = useState<FocusHistoryRecord[]>(() => loadFocusHistory());

  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<number>(() => {
    return Math.round(session.plannedDurationSeconds / 60) || 25;
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(session.taskId);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Persistent latest completed result
  const [latestCompletedResult, setLatestCompletedResult] = useState(() => {
    return session.completionResult || loadLatestCompletedResult() || recoverLatestCompletedFromHistory();
  });

  // Validated in-memory timing anchor
  const timingAnchorRef = useRef<MonotonicTimingAnchor | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Calculate live remaining seconds
  const calculateLiveSeconds = useCallback(
    (currSession: ActiveFocusSessionState): number => {
      if (currSession.status === 'idle') {
        return currSession.plannedDurationSeconds;
      }
      if (currSession.status === 'completed') {
        return 0;
      }
      if (currSession.status === 'ended_early' || currSession.status === 'paused') {
        return Math.max(
          0,
          currSession.plannedDurationSeconds - currSession.accumulatedElapsedSeconds
        );
      }

      // Running state: calculate from monotonic baseline if anchor matches, else wall clock
      let liveElapsedSeconds = currSession.accumulatedElapsedSeconds;
      const anchor = timingAnchorRef.current;
      const isAnchorOwned =
        anchor !== null &&
        anchor.sessionId === currSession.sessionId &&
        anchor.version === currSession.version;

      if (isAnchorOwned && typeof performance !== 'undefined') {
        const liveSegmentMs = Math.max(0, performance.now() - anchor.perfBaseline);
        liveElapsedSeconds += Math.floor(liveSegmentMs / 1000);
      } else {
        const wallDeltaMs = Math.max(0, Date.now() - currSession.lastSavedWallTime);
        liveElapsedSeconds += Math.floor(wallDeltaMs / 1000);
      }

      return Math.max(0, currSession.plannedDurationSeconds - liveElapsedSeconds);
    },
    []
  );

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    calculateLiveSeconds(session)
  );

  // Broadcast helper
  const broadcastState = useCallback((updated: ActiveFocusSessionState) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'FOCUS_STATE_SYNC',
          session: updated,
        });
      } catch {}
    }
  }, []);

  // Update document title quietly upon state changes
  useEffect(() => {
    const isBreak =
      session.mode === 'pomodoro' &&
      (session.pomodoro?.intervalType === 'short_break' ||
        session.pomodoro?.intervalType === 'long_break');

    if (session.status === 'running') {
      const timeStr = formatTimeDisplay(remainingSeconds);
      document.title = isBreak
        ? `(${timeStr}) Break — NeuroCalm & Fokus`
        : `(${timeStr}) Focus — NeuroCalm & Fokus`;
    } else if (session.status === 'paused') {
      document.title = isBreak
        ? `(Paused) Break — NeuroCalm & Fokus`
        : `(Paused) Focus — NeuroCalm & Fokus`;
    } else if (session.status === 'completed') {
      document.title = isBreak
        ? `(Rest Complete) — NeuroCalm & Fokus`
        : `(Completed) Focus — NeuroCalm & Fokus`;
    } else {
      document.title = `NeuroCalm & Fokus`;
    }
  }, [session.status, session.mode, session.pomodoro?.intervalType, remainingSeconds]);

  // Synchronize state from storage (storage event, visibility, broadcast)
  const syncFromStorage = useCallback(() => {
    const loaded = loadActiveFocusSession();
    if (!loaded) {
      timingAnchorRef.current = null;
      const idleState = createDefaultIdleSession(selectedDurationMinutes, mode);
      setSession(idleState);
      setRemainingSeconds(idleState.plannedDurationSeconds);
      return;
    }

    const reconciled = reconcileSessionOnResume(loaded);

    // Startup / sync self-healing archival
    if (reconciled.completionResult && !reconciled.completionResult.isArchived) {
      const isWork =
        reconciled.mode === 'standard' ||
        !reconciled.pomodoro ||
        reconciled.pomodoro.intervalType === 'work';

      if (isWork) {
        const record: FocusHistoryRecord = {
          sessionId: reconciled.completionResult.sessionId,
          mode: reconciled.mode,
          wasCompletedNaturally: reconciled.completionResult.wasCompletedNaturally,
          actualElapsedSeconds: reconciled.completionResult.actualElapsedSeconds,
          plannedDurationSeconds: reconciled.completionResult.plannedDurationSeconds,
          completedAt: reconciled.completionResult.completedAt,
          taskId: reconciled.completionResult.taskId,
          taskTitle: reconciled.completionResult.taskTitle,
          pomodoroIntervalIndex: reconciled.pomodoro?.cumulativeWorkIntervals,
        };
        archiveFocusResultInternal(record);
        reconciled.completionResult.isArchived = true;
        setHistory(loadFocusHistory());
      }
    }

    if (
      reconciled.status !== loaded.status ||
      reconciled.accumulatedElapsedSeconds !== loaded.accumulatedElapsedSeconds ||
      reconciled.completionResult?.isArchived !== loaded.completionResult?.isArchived
    ) {
      saveActiveFocusSession(reconciled);
      if (reconciled.completionResult) {
        saveLatestCompletedResult(reconciled.completionResult);
        setLatestCompletedResult(reconciled.completionResult);
      }
    }

    // Refresh timing anchor
    if (reconciled.status === 'running') {
      timingAnchorRef.current = {
        sessionId: reconciled.sessionId,
        version: reconciled.version,
        perfBaseline: typeof performance !== 'undefined' ? performance.now() : 0,
        wallAnchor: Date.now(),
        accumulatedBaseline: reconciled.accumulatedElapsedSeconds,
      };
    } else {
      timingAnchorRef.current = null;
    }

    setSession(reconciled);
    setModeState(reconciled.mode);
    setRemainingSeconds(calculateLiveSeconds(reconciled));
  }, [selectedDurationMinutes, mode, calculateLiveSeconds]);

  // Setup BroadcastChannel and storage listeners for cross-tab sync
  useEffect(() => {
    broadcastChannelRef.current = createFocusBroadcastChannel();

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data && event.data.type === 'FOCUS_STATE_SYNC') {
          syncFromStorage();
        }
      };
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'neurocalm_focus_active_v1') {
        syncFromStorage();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      window.removeEventListener('storage', handleStorageEvent);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [syncFromStorage]);

  // Main 1-second countdown loop
  useEffect(() => {
    if (session.status !== 'running') {
      timingAnchorRef.current = null;
      return;
    }

    if (
      timingAnchorRef.current === null ||
      timingAnchorRef.current.sessionId !== session.sessionId ||
      timingAnchorRef.current.version !== session.version
    ) {
      timingAnchorRef.current = {
        sessionId: session.sessionId,
        version: session.version,
        perfBaseline: typeof performance !== 'undefined' ? performance.now() : 0,
        wallAnchor: Date.now(),
        accumulatedBaseline: session.accumulatedElapsedSeconds,
      };
    }

    const intervalId = window.setInterval(() => {
      const anchor = timingAnchorRef.current;
      let segmentSeconds = 0;

      if (anchor && typeof performance !== 'undefined') {
        const segmentDeltaMs = performance.now() - anchor.perfBaseline;
        segmentSeconds = Math.max(0, Math.floor(segmentDeltaMs / 1000));
      } else {
        const wallDeltaMs = Date.now() - session.lastSavedWallTime;
        segmentSeconds = Math.max(0, Math.floor(wallDeltaMs / 1000));
      }

      const totalElapsed = session.accumulatedElapsedSeconds + segmentSeconds;
      const rem = Math.max(0, session.plannedDurationSeconds - totalElapsed);

      setRemainingSeconds(rem);

      // Check for natural session / interval completion
      if (rem <= 0) {
        window.clearInterval(intervalId);
        timingAnchorRef.current = null;

        const isWork =
          session.mode === 'standard' ||
          !session.pomodoro ||
          session.pomodoro.intervalType === 'work';

        if (isWork) {
          // Work interval completed naturally!
          let updatedPomodoro = session.pomodoro;
          if (updatedPomodoro) {
            const next = calculateNextInterval(updatedPomodoro);
            updatedPomodoro = {
              ...updatedPomodoro,
              sequenceStatus: 'transition_pending',
              isTransitionPending: true,
              cumulativeWorkIntervals: updatedPomodoro.cumulativeWorkIntervals + 1,
              nextIntervalType: next.nextIntervalType,
              nextPlannedDurationSeconds: next.nextDurationMinutes * 60,
            };
          }

          const completionResult = {
            sessionId: session.sessionId,
            wasCompletedNaturally: true,
            actualElapsedSeconds: session.plannedDurationSeconds,
            plannedDurationSeconds: session.plannedDurationSeconds,
            taskId: session.taskId,
            taskTitle: session.taskTitle,
            completedAt: Date.now(),
            isArchived: false,
          };

          // 1. Archive to history store (idempotent)
          const historyRecord: FocusHistoryRecord = {
            sessionId: session.sessionId,
            mode: session.mode,
            wasCompletedNaturally: true,
            actualElapsedSeconds: session.plannedDurationSeconds,
            plannedDurationSeconds: session.plannedDurationSeconds,
            completedAt: completionResult.completedAt,
            taskId: session.taskId,
            taskTitle: session.taskTitle,
            pomodoroIntervalIndex: updatedPomodoro?.cumulativeWorkIntervals,
          };
          const archived = archiveFocusResultInternal(historyRecord);
          completionResult.isArchived = archived;
          setHistory(loadFocusHistory());

          const completedState: ActiveFocusSessionState = {
            ...session,
            status: 'completed',
            accumulatedElapsedSeconds: session.plannedDurationSeconds,
            lastSavedWallTime: Date.now(),
            version: (session.version || 0) + 1,
            pomodoro: updatedPomodoro,
            completionResult,
          };

          saveActiveFocusSession(completedState);
          saveLatestCompletedResult(completionResult);
          setLatestCompletedResult(completionResult);
          setSession(completedState);
          broadcastState(completedState);
        } else {
          // Break interval completed naturally!
          // Strictly NO FocusCompletionResult, NO history write, NO focus count increment
          let updatedPomodoro = session.pomodoro!;
          const next = calculateNextInterval(updatedPomodoro);
          updatedPomodoro = {
            ...updatedPomodoro,
            sequenceStatus: 'transition_pending',
            isTransitionPending: true,
            cycleIntervalNumber: next.nextCycleIntervalNumber,
            nextIntervalType: 'work',
            nextPlannedDurationSeconds: next.nextDurationMinutes * 60,
          };

          const completedBreakState: ActiveFocusSessionState = {
            ...session,
            status: 'completed',
            accumulatedElapsedSeconds: session.plannedDurationSeconds,
            lastSavedWallTime: Date.now(),
            version: (session.version || 0) + 1,
            pomodoro: updatedPomodoro,
            completionResult: undefined,
          };

          saveActiveFocusSession(completedBreakState);
          setSession(completedBreakState);
          broadcastState(completedBreakState);
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [session, broadcastState]);

  // Actions
  const startSession = useCallback(
    async (
      durationMinutes?: number,
      taskId?: string,
      taskTitle?: string,
      sessionMode: FocusMode = mode,
      pomodoroMeta?: Partial<PomodoroSequenceState>
    ): Promise<boolean> => {
      setConflictError(null);

      return requestFocusMutationLock(async () => {
        const current = loadActiveFocusSession();

        // 1. Concurrency check: Reject if active session running or paused
        if (current && (current.status === 'running' || current.status === 'paused')) {
          throw new SessionConflictError(
            'A focus session is already active in another browser tab.'
          );
        }

        // 2. Lifecycle check: Prevent standard session from overwriting active/pending Pomodoro sequence
        if (
          sessionMode === 'standard' &&
          current?.mode === 'pomodoro' &&
          current?.pomodoro &&
          (current.pomodoro.sequenceStatus === 'active' ||
            current.pomodoro.sequenceStatus === 'transition_pending')
        ) {
          throw new SessionConflictError(
            'A Pomodoro sequence is currently in progress. Please conclude it before starting a Standard Focus session.'
          );
        }

        // 3. Pre-session archival guard: confirm history archival of existing unarchived work
        if (current?.completionResult && !current.completionResult.isArchived) {
          const isWork =
            current.mode === 'standard' ||
            !current.pomodoro ||
            current.pomodoro.intervalType === 'work';

          if (isWork) {
            const record: FocusHistoryRecord = {
              sessionId: current.completionResult.sessionId,
              mode: current.mode,
              wasCompletedNaturally: current.completionResult.wasCompletedNaturally,
              actualElapsedSeconds: current.completionResult.actualElapsedSeconds,
              plannedDurationSeconds: current.completionResult.plannedDurationSeconds,
              completedAt: current.completionResult.completedAt,
              taskId: current.completionResult.taskId,
              taskTitle: current.completionResult.taskTitle,
              pomodoroIntervalIndex: current.pomodoro?.cumulativeWorkIntervals,
            };
            const archived = archiveFocusResultInternal(record);
            if (!archived) {
              // Failed archival: prevent overwrite
              throw new Error('Unable to confirm history archival of previous completed session.');
            }
          }
        }

        const chosenDuration = durationMinutes || selectedDurationMinutes;
        const validMinutes = Math.min(180, Math.max(1, Math.round(chosenDuration)));
        const plannedSeconds = validMinutes * 60;
        const nowWall = Date.now();
        const nextVersion = (current?.version || 0) + 1;
        const newSessionId = generateId();

        let initialPomodoro: PomodoroSequenceState | undefined = undefined;
        if (sessionMode === 'pomodoro') {
          const basePomo = createInitialPomodoroState(
            pomodoroMeta?.patternId || 'classic',
            pomodoroMeta?.customConfig
          );
          initialPomodoro = {
            ...basePomo,
            ...pomodoroMeta,
            sequenceStatus: 'active',
            isTransitionPending: false,
          };
        }

        const newSession: ActiveFocusSessionState = {
          sessionId: newSessionId,
          mode: sessionMode,
          status: 'running',
          plannedDurationSeconds: plannedSeconds,
          accumulatedElapsedSeconds: 0,
          lastSavedWallTime: nowWall,
          version: nextVersion,
          taskId: taskId !== undefined ? taskId : selectedTaskId,
          taskTitle: taskTitle !== undefined ? taskTitle : undefined,
          pomodoro: initialPomodoro,
        };

        // Persist to storage FIRST
        saveActiveFocusSession(newSession);

        // Mutate in-memory anchor only after successful storage commit
        timingAnchorRef.current = {
          sessionId: newSessionId,
          version: nextVersion,
          perfBaseline: typeof performance !== 'undefined' ? performance.now() : 0,
          wallAnchor: nowWall,
          accumulatedBaseline: 0,
        };

        setSession(newSession);
        setModeState(sessionMode);
        setRemainingSeconds(plannedSeconds);
        broadcastState(newSession);
        return true;
      }).catch((err) => {
        if (err instanceof SessionConflictError) {
          setConflictError(err.message);
        } else {
          setConflictError('Unable to start session due to a window conflict.');
        }
        return false;
      });
    },
    [mode, selectedDurationMinutes, selectedTaskId, broadcastState]
  );

  const pauseSession = useCallback(async () => {
    return requestFocusMutationLock(async () => {
      const current = loadActiveFocusSession();
      if (!current || current.status !== 'running') return;

      const nowWall = Date.now();
      let additionalElapsed = 0;
      const anchor = timingAnchorRef.current;
      const isAnchorOwned =
        anchor !== null &&
        anchor.sessionId === current.sessionId &&
        anchor.version === current.version;

      if (isAnchorOwned && typeof performance !== 'undefined') {
        const monoDeltaMs = Math.max(0, performance.now() - anchor.perfBaseline);
        additionalElapsed = Math.floor(monoDeltaMs / 1000);
      } else {
        const wallDeltaMs = Math.max(0, nowWall - current.lastSavedWallTime);
        additionalElapsed = Math.floor(wallDeltaMs / 1000);
      }

      const newAccumulated = Math.min(
        current.plannedDurationSeconds,
        current.accumulatedElapsedSeconds + additionalElapsed
      );

      const nextVersion = (current.version || 0) + 1;
      const pausedState: ActiveFocusSessionState = {
        ...current,
        status: 'paused',
        accumulatedElapsedSeconds: newAccumulated,
        lastSavedWallTime: nowWall,
        version: nextVersion,
      };

      saveActiveFocusSession(pausedState);
      timingAnchorRef.current = null;

      setSession(pausedState);
      setRemainingSeconds(Math.max(0, current.plannedDurationSeconds - newAccumulated));
      broadcastState(pausedState);
    });
  }, [broadcastState]);

  const resumeSession = useCallback(async () => {
    return requestFocusMutationLock(async () => {
      const current = loadActiveFocusSession();
      if (!current || current.status !== 'paused') return;

      const nowWall = Date.now();
      const nextVersion = (current.version || 0) + 1;

      const resumedState: ActiveFocusSessionState = {
        ...current,
        status: 'running',
        lastSavedWallTime: nowWall,
        version: nextVersion,
      };

      saveActiveFocusSession(resumedState);

      timingAnchorRef.current = {
        sessionId: current.sessionId,
        version: nextVersion,
        perfBaseline: typeof performance !== 'undefined' ? performance.now() : 0,
        wallAnchor: nowWall,
        accumulatedBaseline: current.accumulatedElapsedSeconds,
      };

      setSession(resumedState);
      broadcastState(resumedState);
    });
  }, [broadcastState]);

  const extendSessionDuration = useCallback(
    async (additionalSeconds: number): Promise<boolean> => {
      if (!Number.isInteger(additionalSeconds) || additionalSeconds <= 0) return false;

      return requestFocusMutationLock(async () => {
        const current = loadActiveFocusSession();
        if (!current || (current.status !== 'running' && current.status !== 'paused')) {
          return false;
        }

        // Strictly reject extensions outside active Pomodoro breaks
        const isBreak =
          current.mode === 'pomodoro' &&
          (current.pomodoro?.intervalType === 'short_break' ||
            current.pomodoro?.intervalType === 'long_break');
        if (!isBreak) {
          return false;
        }

        const MAX_ALLOWED_SECONDS = 180 * 60;
        const newPlannedDuration = current.plannedDurationSeconds + additionalSeconds;
        if (newPlannedDuration > MAX_ALLOWED_SECONDS) {
          return false;
        }

        let updatedAccumulated = current.accumulatedElapsedSeconds;
        let nextBaselinePerf: number | null = null;
        const nowWall = Date.now();
        const anchor = timingAnchorRef.current;

        const isAnchorOwned =
          anchor !== null &&
          anchor.sessionId === current.sessionId &&
          anchor.version === current.version;

        if (current.status === 'running') {
          let liveElapsedMs = 0;
          if (isAnchorOwned) {
            const monoDeltaMs = Math.max(0, performance.now() - anchor.perfBaseline);
            const wallDeltaMs = Math.max(0, nowWall - anchor.wallAnchor);

            // Reconcile against wall clock if OS sleep/throttling caused divergence > 2s
            if (wallDeltaMs - monoDeltaMs > 2000) {
              liveElapsedMs = wallDeltaMs;
            } else {
              liveElapsedMs = monoDeltaMs;
            }
          } else {
            liveElapsedMs = Math.max(0, nowWall - current.lastSavedWallTime);
          }

          const elapsedWholeSeconds = Math.floor(liveElapsedMs / 1000);
          const remainderMs = liveElapsedMs % 1000;

          updatedAccumulated += elapsedWholeSeconds;
          if (typeof performance !== 'undefined') {
            nextBaselinePerf = performance.now() - remainderMs;
          }
        }

        const nextVersion = (current.version || 0) + 1;
        const updatedState: ActiveFocusSessionState = {
          ...current,
          plannedDurationSeconds: newPlannedDuration,
          accumulatedElapsedSeconds: updatedAccumulated,
          lastSavedWallTime: nowWall,
          version: nextVersion,
        };

        saveActiveFocusSession(updatedState);

        if (nextBaselinePerf !== null) {
          timingAnchorRef.current = {
            sessionId: current.sessionId,
            version: nextVersion,
            perfBaseline: nextBaselinePerf,
            wallAnchor: nowWall,
            accumulatedBaseline: updatedAccumulated,
          };
        }

        const newRemaining = Math.max(0, newPlannedDuration - updatedAccumulated);
        setSession(updatedState);
        setRemainingSeconds(newRemaining);
        broadcastState(updatedState);
        return true;
      });
    },
    [broadcastState]
  );

  const endSessionEarly = useCallback(async () => {
    return requestFocusMutationLock(async () => {
      const current = loadActiveFocusSession();
      if (!current || (current.status !== 'running' && current.status !== 'paused')) return;

      const nowWall = Date.now();
      let additionalElapsed = 0;
      const anchor = timingAnchorRef.current;
      const isAnchorOwned =
        anchor !== null &&
        anchor.sessionId === current.sessionId &&
        anchor.version === current.version;

      if (current.status === 'running') {
        if (isAnchorOwned && typeof performance !== 'undefined') {
          const monoDeltaMs = Math.max(0, performance.now() - anchor.perfBaseline);
          additionalElapsed = Math.floor(monoDeltaMs / 1000);
        } else {
          const wallDeltaMs = Math.max(0, nowWall - current.lastSavedWallTime);
          additionalElapsed = Math.floor(wallDeltaMs / 1000);
        }
      }

      const actualElapsed = Math.min(
        current.plannedDurationSeconds,
        current.accumulatedElapsedSeconds + additionalElapsed
      );

      const isWork =
        current.mode === 'standard' ||
        !current.pomodoro ||
        current.pomodoro.intervalType === 'work';

      let completionResult: FocusCompletionResult | undefined = undefined;

      if (isWork) {
        // Ending a work interval early: record partial focus time (wasCompletedNaturally = false)
        completionResult = {
          sessionId: current.sessionId,
          wasCompletedNaturally: false,
          actualElapsedSeconds: actualElapsed,
          plannedDurationSeconds: current.plannedDurationSeconds,
          taskId: current.taskId,
          taskTitle: current.taskTitle,
          completedAt: nowWall,
          isArchived: false,
        };

        const record: FocusHistoryRecord = {
          sessionId: current.sessionId,
          mode: current.mode,
          wasCompletedNaturally: false,
          actualElapsedSeconds: actualElapsed,
          plannedDurationSeconds: current.plannedDurationSeconds,
          completedAt: nowWall,
          taskId: current.taskId,
          taskTitle: current.taskTitle,
          pomodoroIntervalIndex: current.pomodoro?.cumulativeWorkIntervals,
        };
        const archived = archiveFocusResultInternal(record);
        completionResult.isArchived = archived;
        setHistory(loadFocusHistory());
        saveLatestCompletedResult(completionResult);
        setLatestCompletedResult(completionResult);
      }

      // If in Pomodoro mode, stop the sequence
      let updatedPomodoro = current.pomodoro;
      if (updatedPomodoro) {
        updatedPomodoro = {
          ...updatedPomodoro,
          sequenceStatus: 'stopped',
          isTransitionPending: false,
        };
      }

      const nextVersion = (current.version || 0) + 1;
      const endedState: ActiveFocusSessionState = {
        ...current,
        status: 'ended_early',
        accumulatedElapsedSeconds: actualElapsed,
        lastSavedWallTime: nowWall,
        version: nextVersion,
        pomodoro: updatedPomodoro,
        completionResult,
      };

      saveActiveFocusSession(endedState);
      timingAnchorRef.current = null;

      setSession(endedState);
      broadcastState(endedState);
    });
  }, [broadcastState]);

  const advancePomodoroInterval = useCallback(
    async (skip: boolean = false): Promise<boolean> => {
      return requestFocusMutationLock(async () => {
        const current = loadActiveFocusSession();
        if (!current || !current.pomodoro) return false;

        const pomo = current.pomodoro;
        const nowWall = Date.now();
        const nextVersion = (current.version || 0) + 1;
        const newSessionId = generateId();

        let targetType = pomo.nextIntervalType || 'work';
        let targetDurationMinutes = Math.round((pomo.nextPlannedDurationSeconds || 1500) / 60);

        // If skipping break, advance directly to work
        if (skip) {
          const next = calculateNextInterval({ ...pomo, intervalType: 'short_break' });
          targetType = 'work';
          targetDurationMinutes = next.nextDurationMinutes;
        }

        const updatedPomo: PomodoroSequenceState = {
          ...pomo,
          sequenceStatus: 'active',
          intervalType: targetType,
          isTransitionPending: false,
        };

        const targetPlannedSeconds = targetDurationMinutes * 60;
        const isTargetWork = targetType === 'work';

        const updatedState: ActiveFocusSessionState = {
          ...current,
          sessionId: newSessionId,
          status: 'running',
          plannedDurationSeconds: targetPlannedSeconds,
          accumulatedElapsedSeconds: 0,
          lastSavedWallTime: nowWall,
          version: nextVersion,
          pomodoro: updatedPomo,
          // Work intervals inherit task; breaks omit task
          taskId: isTargetWork ? current.taskId : undefined,
          taskTitle: isTargetWork ? current.taskTitle : undefined,
          completionResult: undefined,
        };

        saveActiveFocusSession(updatedState);

        timingAnchorRef.current = {
          sessionId: newSessionId,
          version: nextVersion,
          perfBaseline: typeof performance !== 'undefined' ? performance.now() : 0,
          wallAnchor: nowWall,
          accumulatedBaseline: 0,
        };

        setSession(updatedState);
        setRemainingSeconds(targetPlannedSeconds);
        broadcastState(updatedState);
        return true;
      });
    },
    [broadcastState]
  );

  const stopPomodoroSequence = useCallback(async (): Promise<boolean> => {
    return requestFocusMutationLock(async () => {
      const current = loadActiveFocusSession();
      if (!current) return false;

      // Archive any unarchived work result before stopping
      if (current.completionResult && !current.completionResult.isArchived) {
        const isWork =
          current.mode === 'standard' ||
          !current.pomodoro ||
          current.pomodoro.intervalType === 'work';

        if (isWork) {
          const record: FocusHistoryRecord = {
            sessionId: current.completionResult.sessionId,
            mode: current.mode,
            wasCompletedNaturally: current.completionResult.wasCompletedNaturally,
            actualElapsedSeconds: current.completionResult.actualElapsedSeconds,
            plannedDurationSeconds: current.completionResult.plannedDurationSeconds,
            completedAt: current.completionResult.completedAt,
            taskId: current.completionResult.taskId,
            taskTitle: current.completionResult.taskTitle,
            pomodoroIntervalIndex: current.pomodoro?.cumulativeWorkIntervals,
          };
          archiveFocusResultInternal(record);
          setHistory(loadFocusHistory());
        }
      }

      const idle = createDefaultIdleSession(25, 'pomodoro');
      const stoppedState: ActiveFocusSessionState = {
        ...idle,
        version: (current.version || 0) + 1,
        pomodoro: current.pomodoro ? { ...current.pomodoro, sequenceStatus: 'stopped', isTransitionPending: false } : undefined,
        completionResult: current.completionResult,
      };

      saveActiveFocusSession(stoppedState);
      timingAnchorRef.current = null;

      setSession(stoppedState);
      setRemainingSeconds(stoppedState.plannedDurationSeconds);
      broadcastState(stoppedState);
      return true;
    });
  }, [broadcastState]);

  // Auto-advance Pomodoro sequence if autoStartBreaks or autoStartWork is enabled
  useEffect(() => {
    if (
      session.status === 'completed' &&
      session.mode === 'pomodoro' &&
      session.pomodoro?.isTransitionPending
    ) {
      const isWork = session.pomodoro.intervalType === 'work';
      const shouldAutoAdvance =
        (isWork && session.pomodoro.autoStartBreaks) ||
        (!isWork && session.pomodoro.autoStartWork);

      if (shouldAutoAdvance) {
        const timeoutId = window.setTimeout(() => {
          advancePomodoroInterval();
        }, 300);
        return () => window.clearTimeout(timeoutId);
      }
    }
  }, [session, advancePomodoroInterval]);

  const restartSession = useCallback(async (): Promise<boolean> => {
    return requestFocusMutationLock(async () => {
      const current = loadActiveFocusSession();
      if (!current) return false;

      const previousDurationMinutes = Math.round(current.plannedDurationSeconds / 60) || 25;
      const newSessionId = generateId();
      const nowWall = Date.now();
      const nextVersion = (current.version || 0) + 1;

      const restarted: ActiveFocusSessionState = {
        ...current,
        sessionId: newSessionId,
        status: 'running',
        plannedDurationSeconds: previousDurationMinutes * 60,
        accumulatedElapsedSeconds: 0,
        lastSavedWallTime: nowWall,
        version: nextVersion,
        completionResult: undefined,
      };

      saveActiveFocusSession(restarted);

      timingAnchorRef.current = {
        sessionId: newSessionId,
        version: nextVersion,
        perfBaseline: typeof performance !== 'undefined' ? performance.now() : 0,
        wallAnchor: nowWall,
        accumulatedBaseline: 0,
      };

      setSession(restarted);
      setRemainingSeconds(previousDurationMinutes * 60);
      broadcastState(restarted);
      return true;
    });
  }, [broadcastState]);

  const resetToIdle = useCallback(async () => {
    return requestFocusMutationLock(async () => {
      const current = loadActiveFocusSession();

      // Ensure any unarchived work completion is archived before returning to idle
      if (current?.completionResult && !current.completionResult.isArchived) {
        const isWork =
          current.mode === 'standard' ||
          !current.pomodoro ||
          current.pomodoro.intervalType === 'work';

        if (isWork) {
          const record: FocusHistoryRecord = {
            sessionId: current.completionResult.sessionId,
            mode: current.mode,
            wasCompletedNaturally: current.completionResult.wasCompletedNaturally,
            actualElapsedSeconds: current.completionResult.actualElapsedSeconds,
            plannedDurationSeconds: current.completionResult.plannedDurationSeconds,
            completedAt: current.completionResult.completedAt,
            taskId: current.completionResult.taskId,
            taskTitle: current.completionResult.taskTitle,
            pomodoroIntervalIndex: current.pomodoro?.cumulativeWorkIntervals,
          };
          archiveFocusResultInternal(record);
          setHistory(loadFocusHistory());
        }
      }

      const idleState: ActiveFocusSessionState = {
        ...createDefaultIdleSession(selectedDurationMinutes, mode),
        version: (current?.version || 0) + 1,
        completionResult: current?.completionResult || latestCompletedResult || undefined,
      };

      saveActiveFocusSession(idleState);
      timingAnchorRef.current = null;

      setSession(idleState);
      setRemainingSeconds(idleState.plannedDurationSeconds);
      broadcastState(idleState);
    });
  }, [selectedDurationMinutes, mode, latestCompletedResult, broadcastState]);

  const setMode = useCallback(
    (newMode: FocusMode) => {
      // Prevent mode toggle during active sessions or pending transitions
      if (
        session.status === 'running' ||
        session.status === 'paused' ||
        session.pomodoro?.isTransitionPending
      ) {
        return;
      }
      setModeState(newMode);
    },
    [session.status, session.pomodoro?.isTransitionPending]
  );

  // Derived progress percentage (0 to 100)
  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      ((session.plannedDurationSeconds - remainingSeconds) /
        session.plannedDurationSeconds) *
        100
    )
  );

  return (
    <FocusContext.Provider
      value={{
        session,
        mode,
        setMode,
        remainingSeconds,
        progressPercent,
        selectedDurationMinutes,
        setSelectedDurationMinutes,
        selectedTaskId,
        setSelectedTaskId,
        startSession,
        pauseSession,
        resumeSession,
        endSessionEarly,
        restartSession,
        resetToIdle,
        extendSessionDuration,
        advancePomodoroInterval,
        stopPomodoroSequence,
        latestCompletedResult,
        history,
        conflictError,
        clearConflictError: () => setConflictError(null),
      }}
    >
      {children}
    </FocusContext.Provider>
  );
};

export function useFocus(): FocusContextType {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}
