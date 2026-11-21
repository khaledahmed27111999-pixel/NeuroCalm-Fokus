/**
 * NeuroCalm & Fokus — Sleep Timer Context & Manager
 * Phase 4B: Foundational state machine, wall-clock deadline reconciliation,
 * background/system sleep recovery, and audio engine fade coordination.
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
  SleepTimerContextType,
  SleepTimerState,
  SleepTimerPreferences,
  SleepTimerStatus,
} from '../types/sleepTimer';
import {
  loadSleepTimerPreferences,
  saveSleepTimerPreferences,
} from '../storage/sleepTimerStorage';
import { useAudio } from '../hooks/useAudio';
import { BreathingContext } from './BreathingContext';
import { RelaxationSessionContext } from './RelaxationSessionContext';

const defaultIdleState: SleepTimerState = {
  status: 'idle',
  durationMinutes: 30,
  fadeDurationSeconds: 60,
  fadeStartWallTime: null,
  deadlineWallTime: null,
  remainingSeconds: 0,
  remainingSecondsBeforeFade: 0,
  isFading: false,
};

export const SleepTimerContext = createContext<SleepTimerContextType | undefined>(undefined);

export const SleepTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audio = useAudio();
  const breathing = useContext(BreathingContext);
  const relaxationSession = useContext(RelaxationSessionContext);

  const [preferences, setPreferences] = useState<SleepTimerPreferences>(() =>
    loadSleepTimerPreferences()
  );
  const [state, setState] = useState<SleepTimerState>(defaultIdleState);

  // Authoritative mutable refs to prevent stale closure intervals
  const statusRef = useRef<SleepTimerStatus>('idle');
  const durationMinutesRef = useRef<number>(30);
  const fadeDurationSecondsRef = useRef<number>(60);
  const fadeStartWallTimeRef = useRef<number | null>(null);
  const deadlineWallTimeRef = useRef<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasScheduledEngineFadeRef = useRef<boolean>(false);

  // Keep references to context methods up to date
  const audioRef = useRef(audio);
  const breathingRef = useRef(breathing);
  const relaxationSessionRef = useRef(relaxationSession);
  useEffect(() => {
    audioRef.current = audio;
    breathingRef.current = breathing;
    relaxationSessionRef.current = relaxationSession;
  });

  const clearTimerInterval = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  /**
   * Deterministic wall-clock reconciliation function.
   * Compares Date.now() against authoritative deadlineWallTimeRef and fadeStartWallTimeRef.
   */
  const reconcile = useCallback(
    (now: number = Date.now()) => {
      if (statusRef.current === 'idle') return;

      const deadline = deadlineWallTimeRef.current;
      const fadeStart = fadeStartWallTimeRef.current;

      if (!deadline || !fadeStart) {
        // Inconsistent timestamps: reset safely
        clearTimerInterval();
        statusRef.current = 'idle';
        audioRef.current.resetSleepFade();
        setState(defaultIdleState);
        return;
      }

      // Case 1: Deadline Expired
      if (now >= deadline) {
        clearTimerInterval();
        statusRef.current = 'completed';

        // 1. Terminate audio resources
        void audioRef.current.stopAll();

        // 2. Terminate active relaxation session if running
        if (relaxationSessionRef.current && relaxationSessionRef.current.liveState.status !== 'idle') {
          void relaxationSessionRef.current.stopSession();
        }

        // 3. Terminate active breathing session silently (without completion chimes)
        if (breathingRef.current && breathingRef.current.liveState.status !== 'idle') {
          breathingRef.current.stopSession();
        }

        // 4. Reset engine sleep fade node to unity
        audioRef.current.resetSleepFade();

        // 5. Reset to idle
        statusRef.current = 'idle';
        fadeStartWallTimeRef.current = null;
        deadlineWallTimeRef.current = null;
        hasScheduledEngineFadeRef.current = false;

        setState({
          ...defaultIdleState,
          durationMinutes: durationMinutesRef.current,
          fadeDurationSeconds: fadeDurationSecondsRef.current,
        });
        return;
      }

      // Case 2: In Active Gradual Fade Phase
      if (now >= fadeStart) {
        statusRef.current = 'fading';

        if (!hasScheduledEngineFadeRef.current) {
          // Schedule native Web Audio hardware exponential fade
          const remainingFadeSec = Math.max(0.1, (deadline - now) / 1000);
          audioRef.current.scheduleSleepFade(remainingFadeSec);
          hasScheduledEngineFadeRef.current = true;
        }

        const remainingSec = Math.max(0, Math.ceil((deadline - now) / 1000));
        setState({
          status: 'fading',
          durationMinutes: durationMinutesRef.current,
          fadeDurationSeconds: fadeDurationSecondsRef.current,
          fadeStartWallTime: fadeStart,
          deadlineWallTime: deadline,
          remainingSeconds: remainingSec,
          remainingSecondsBeforeFade: 0,
          isFading: true,
        });
        return;
      }

      // Case 3: In Active Pre-Fade Countdown
      statusRef.current = 'running';
      const remainingSec = Math.max(0, Math.ceil((deadline - now) / 1000));
      const remainingBeforeFadeSec = Math.max(0, Math.ceil((fadeStart - now) / 1000));

      setState({
        status: 'running',
        durationMinutes: durationMinutesRef.current,
        fadeDurationSeconds: fadeDurationSecondsRef.current,
        fadeStartWallTime: fadeStart,
        deadlineWallTime: deadline,
        remainingSeconds: remainingSec,
        remainingSecondsBeforeFade: remainingBeforeFadeSec,
        isFading: false,
      });
    },
    [clearTimerInterval]
  );

  /**
   * Starts or restarts the sleep timer with explicit duration and optional fade duration.
   * Semantic: durationMinutes is the period BEFORE fading begins.
   */
  const startTimer = useCallback(
    (durationMinutes: number, fadeDurationSeconds?: number) => {
      clearTimerInterval();

      const safeMinutes = Math.max(0, Math.min(180, durationMinutes));
      const safeFadeSeconds = Math.max(
        10,
        Math.min(600, fadeDurationSeconds ?? preferences.preferredFadeDurationSeconds)
      );

      durationMinutesRef.current = safeMinutes;
      fadeDurationSecondsRef.current = safeFadeSeconds;

      const now = Date.now();
      const fadeStart = now + safeMinutes * 60 * 1000;
      const deadline = fadeStart + safeFadeSeconds * 1000;

      fadeStartWallTimeRef.current = fadeStart;
      deadlineWallTimeRef.current = deadline;
      hasScheduledEngineFadeRef.current = false;

      // Reset any prior sleep fade to ensure clean start
      audioRef.current.resetSleepFade();

      if (safeMinutes === 0) {
        // Immediate fade requested
        statusRef.current = 'fading';
        audioRef.current.scheduleSleepFade(safeFadeSeconds);
        hasScheduledEngineFadeRef.current = true;
      } else {
        statusRef.current = 'running';
      }

      reconcile(now);

      // Start 1-second interval loop for UI countdown
      intervalIdRef.current = setInterval(() => {
        reconcile(Date.now());
      }, 1000);
    },
    [clearTimerInterval, preferences.preferredFadeDurationSeconds, reconcile]
  );

  /**
   * Cancels the active timer.
   * If currently fading, triggers AudioEngine 500ms smooth recovery ramp back to unity.
   */
  const cancelTimer = useCallback(() => {
    clearTimerInterval();

    if (statusRef.current === 'fading' || hasScheduledEngineFadeRef.current) {
      audioRef.current.cancelSleepFade();
    } else {
      audioRef.current.resetSleepFade();
    }

    statusRef.current = 'idle';
    fadeStartWallTimeRef.current = null;
    deadlineWallTimeRef.current = null;
    hasScheduledEngineFadeRef.current = false;

    setState({
      ...defaultIdleState,
      durationMinutes: durationMinutesRef.current,
      fadeDurationSeconds: fadeDurationSecondsRef.current,
    });
  }, [clearTimerInterval]);

  /**
   * Extends the active deadline and fade start by additionalMinutes.
   */
  const extendTimer = useCallback(
    (additionalMinutes: number) => {
      if (statusRef.current === 'idle') {
        startTimer(additionalMinutes);
        return;
      }

      const additionalMs = Math.max(1, additionalMinutes) * 60 * 1000;
      if (fadeStartWallTimeRef.current && deadlineWallTimeRef.current) {
        fadeStartWallTimeRef.current += additionalMs;
        deadlineWallTimeRef.current += additionalMs;

        const now = Date.now();
        // If we were fading but the extension pushed fadeStart into the future:
        if (now < fadeStartWallTimeRef.current) {
          if (hasScheduledEngineFadeRef.current) {
            audioRef.current.cancelSleepFade();
            hasScheduledEngineFadeRef.current = false;
          }
          statusRef.current = 'running';
        }

        reconcile(now);
      }
    },
    [reconcile, startTimer]
  );

  /**
   * Shortens the active duration, adjusting the fade window and deadline.
   */
  const shortenTimer = useCallback(
    (newDurationMinutes: number) => {
      if (statusRef.current === 'idle') return;

      const safeMinutes = Math.max(0, Math.min(180, newDurationMinutes));
      durationMinutesRef.current = safeMinutes;

      const now = Date.now();
      const fadeStart = now + safeMinutes * 60 * 1000;
      const deadline = fadeStart + fadeDurationSecondsRef.current * 1000;

      fadeStartWallTimeRef.current = fadeStart;
      deadlineWallTimeRef.current = deadline;

      if (hasScheduledEngineFadeRef.current) {
        audioRef.current.cancelSleepFade();
        hasScheduledEngineFadeRef.current = false;
      }

      reconcile(now);
    },
    [reconcile]
  );

  /**
   * Restarts the timer with preferred user settings.
   */
  const restartTimer = useCallback(() => {
    startTimer(preferences.preferredDurationMinutes, preferences.preferredFadeDurationSeconds);
  }, [preferences.preferredDurationMinutes, preferences.preferredFadeDurationSeconds, startTimer]);

  /**
   * Updates persisted user preferences for default timer and fade durations.
   */
  const updatePreferences = useCallback((newPrefs: Partial<SleepTimerPreferences>) => {
    setPreferences((prev) => {
      const updated: SleepTimerPreferences = {
        preferredDurationMinutes: newPrefs.preferredDurationMinutes ?? prev.preferredDurationMinutes,
        preferredFadeDurationSeconds: newPrefs.preferredFadeDurationSeconds ?? prev.preferredFadeDurationSeconds,
      };
      saveSleepTimerPreferences(updated);
      return updated;
    });
  }, []);

  // Watcher: If all audio stops externally (e.g. Stop All pressed, takeover, unmount), reset active timer
  useEffect(() => {
    if (audio.state.activeCount === 0 && statusRef.current !== 'idle') {
      clearTimerInterval();
      audioRef.current.resetSleepFade();
      statusRef.current = 'idle';
      fadeStartWallTimeRef.current = null;
      deadlineWallTimeRef.current = null;
      hasScheduledEngineFadeRef.current = false;
      setState((prev) => ({
        ...prev,
        status: 'idle',
        remainingSeconds: 0,
        remainingSecondsBeforeFade: 0,
        isFading: false,
      }));
    }
  }, [audio.state.activeCount, clearTimerInterval]);

  // Page Visibility & Window Focus Listeners: Monotonic background reconciliation
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (statusRef.current !== 'idle') {
        reconcile(Date.now());
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
      }
      clearTimerInterval();
    };
  }, [clearTimerInterval, reconcile]);

  const contextValue: SleepTimerContextType = useMemo(
    () => ({
      state,
      preferences,
      startTimer,
      cancelTimer,
      extendTimer,
      shortenTimer,
      restartTimer,
      updatePreferences,
    }),
    [
      state,
      preferences,
      startTimer,
      cancelTimer,
      extendTimer,
      shortenTimer,
      restartTimer,
      updatePreferences,
    ]
  );

  return (
    <SleepTimerContext.Provider value={contextValue}>
      {children}
    </SleepTimerContext.Provider>
  );
};
