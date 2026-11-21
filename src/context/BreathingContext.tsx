/**
 * NeuroCalm & Fokus — Breathing Context & Live Session Manager
 * Phase 3A: Monotonic RAF timing engine, visibility pause defense,
 * and audio accompaniment integration.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  BreathingTechnique,
  BreathingSessionConfig,
  BreathingSessionLiveState,
  BreathingPhaseDefinition,
  BreathingTechniqueId,
  BreathingPreferences,
  BreathingCuePreferences,
  DEFAULT_BREATHING_CUE_PREFERENCES,
} from '../types/breathing';
import {
  getBreathingTechnique,
  BREATHING_TECHNIQUES,
} from '../data/breathingTechniques';
import { resolveActivePhases } from '../utils/breathingTimer';
import {
  playPhaseCue,
  playCompletionCue,
  stopPreview,
} from '../utils/breathingAudioCue';
import {
  loadBreathingPreferences,
  saveBreathingPreferences,
} from '../storage/breathingStorage';
import { AudioContext } from './AudioProvider';

export interface BreathingContextType {
  activeTechnique: BreathingTechnique | null;
  setupTechnique: BreathingTechnique | null;
  liveState: BreathingSessionLiveState;
  preferences: BreathingPreferences;
  startSetup: (techniqueId: BreathingTechniqueId) => void;
  closeSetup: () => void;
  beginSession: (config: BreathingSessionConfig) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => void;
  dismissCompletion: () => void;
}

const defaultPhase: BreathingPhaseDefinition = {
  type: 'inhale',
  durationSeconds: 4.0,
  labelKey: 'phaseInhale',
  guidanceKey: 'guideDiaphragmaticInhale',
  targetScale: 1.4,
};

const defaultInitialLiveState: BreathingSessionLiveState = {
  status: 'idle',
  techniqueId: 'diaphragmatic',
  config: {
    techniqueId: 'diaphragmatic',
    durationMinutes: 3,
    tempoMultiplier: 1.0,
    retentionMode: 'standard',
    isUntimedAwareness: false,
    soundscapeId: 'silent',
    instrumentalId: 'none',
    audioCueEnabled: false,
  },
  currentPhaseIndex: 0,
  currentPhase: defaultPhase,
  phaseProgressFraction: 0,
  cycleCount: 1,
  totalElapsedSeconds: 0,
  remainingSeconds: 180,
  settlingRemainingSeconds: 3,
};

export const BreathingContext = createContext<BreathingContextType | undefined>(undefined);

export const BreathingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audio = useContext(AudioContext);
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  });

  const [preferences, setPreferences] = useState<BreathingPreferences>(() =>
    loadBreathingPreferences()
  );
  const [setupTechnique, setSetupTechnique] = useState<BreathingTechnique | null>(null);
  const [activeTechnique, setActiveTechnique] = useState<BreathingTechnique | null>(null);
  const [liveState, setLiveState] = useState<BreathingSessionLiveState>(defaultInitialLiveState);

  // Mutable refs for high-frequency RAF loop
  const rafIdRef = useRef<number | null>(null);
  const activePhasesRef = useRef<BreathingPhaseDefinition[]>([defaultPhase]);
  const phaseIndexRef = useRef<number>(0);
  const phaseStartTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(0);
  const plannedDurationSecondsRef = useRef<number>(180);
  const cycleCountRef = useRef<number>(1);
  const isPausedRef = useRef<boolean>(false);
  const pauseAnchorRef = useRef<number>(0);
  const accumulatedPauseTimeRef = useRef<number>(0);
  const startedSoundscapeIdRef = useRef<string | null>(null);
  const isUntimedRef = useRef<boolean>(false);

  // Settle timer ref
  const settleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanUpSettleInterval = () => {
    if (settleIntervalRef.current) {
      clearInterval(settleIntervalRef.current);
      settleIntervalRef.current = null;
    }
  };

  const cancelRaf = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const triggerAudioCue = useCallback(
    (phaseType: string, enabled: boolean, cuePrefs?: BreathingCuePreferences) => {
      if (!enabled) return;
      const prefs = cuePrefs || DEFAULT_BREATHING_CUE_PREFERENCES;
      const vol = prefs.volume;
      if (phaseType === 'inhale' || phaseType === 'inhale_second') {
        playPhaseCue('inhale', prefs.inhaleProfile, vol);
      } else if (phaseType === 'exhale') {
        playPhaseCue('exhale', prefs.exhaleProfile, vol);
      } else if (phaseType === 'hold_in' || phaseType === 'hold_out' || phaseType === 'rest') {
        playPhaseCue('hold', prefs.holdProfile, vol);
      }
    },
    []
  );

  const stopActiveSoundscape = useCallback(() => {
    if (startedSoundscapeIdRef.current && audioRef.current) {
      audioRef.current.stopTrack(startedSoundscapeIdRef.current as any).catch(() => {});
      startedSoundscapeIdRef.current = null;
    }
  }, []);

  // Main high-precision animation tick
  const runLoop = useCallback(() => {
    if (isPausedRef.current) return;

    const now = performance.now();
    const effectiveNow = now - accumulatedPauseTimeRef.current;
    const currentPhase = activePhasesRef.current[phaseIndexRef.current] || defaultPhase;
    const phaseDurationMs = currentPhase.durationSeconds * 1000;
    const phaseElapsedMs = effectiveNow - phaseStartTimeRef.current;

    const progress = Math.min(1.0, Math.max(0.0, phaseElapsedMs / phaseDurationMs));
    const totalElapsedSeconds = Math.floor((effectiveNow - sessionStartTimeRef.current) / 1000);
    const remainingSeconds = Math.max(0, plannedDurationSecondsRef.current - totalElapsedSeconds);

    // Check if session has naturally elapsed
    if (remainingSeconds <= 0) {
      cancelRaf();
      stopActiveSoundscape();
      if (liveState.config.audioCueEnabled) {
        const prefs = liveState.config.cuePreferences || DEFAULT_BREATHING_CUE_PREFERENCES;
        playCompletionCue(prefs.completionProfile, prefs.volume);
      }
      setLiveState((prev) => ({
        ...prev,
        status: 'completed',
        remainingSeconds: 0,
        phaseProgressFraction: 1.0,
      }));
      return;
    }

    // Check if current phase completed
    if (phaseElapsedMs >= phaseDurationMs) {
      // Advance to next phase
      let nextIndex = phaseIndexRef.current + 1;
      let nextCycle = cycleCountRef.current;

      if (nextIndex >= activePhasesRef.current.length) {
        nextIndex = 0;
        nextCycle += 1;
        cycleCountRef.current = nextCycle;
      }

      phaseIndexRef.current = nextIndex;
      phaseStartTimeRef.current = effectiveNow;
      const nextPhase = activePhasesRef.current[nextIndex];

      // Audio cue for new phase
      triggerAudioCue(
        nextPhase.type,
        liveState.config.audioCueEnabled,
        liveState.config.cuePreferences
      );

      setLiveState((prev) => ({
        ...prev,
        currentPhaseIndex: nextIndex,
        currentPhase: nextPhase,
        phaseProgressFraction: 0,
        cycleCount: nextCycle,
        totalElapsedSeconds,
        remainingSeconds,
      }));
    } else {
      setLiveState((prev) => ({
        ...prev,
        phaseProgressFraction: progress,
        totalElapsedSeconds,
        remainingSeconds,
      }));
    }

    rafIdRef.current = requestAnimationFrame(runLoop);
  }, [
    liveState.config.audioCueEnabled,
    liveState.config.cuePreferences,
    stopActiveSoundscape,
    triggerAudioCue,
  ]);

  // Setup modal handlers
  const startSetup = useCallback((techniqueId: BreathingTechniqueId) => {
    const tech = getBreathingTechnique(techniqueId) || BREATHING_TECHNIQUES[0];
    setSetupTechnique(tech);
  }, []);

  const closeSetup = useCallback(() => {
    setSetupTechnique(null);
  }, []);

  // Begin Session: enters 3s settling, then starts RAF loop
  const beginSession = useCallback(
    (config: BreathingSessionConfig) => {
      const tech = getBreathingTechnique(config.techniqueId) || BREATHING_TECHNIQUES[0];
      setActiveTechnique(tech);
      setSetupTechnique(null);

      stopPreview();

      // Save user preferences
      const updatedPrefs: BreathingPreferences = {
        lastTechniqueId: config.techniqueId,
        preferredDurationMinutes: config.durationMinutes,
        soundscapeId: config.soundscapeId,
        instrumentalId: config.instrumentalId,
        audioCueEnabled: config.audioCueEnabled,
        tempoMultiplier: config.tempoMultiplier,
        cuePreferences: config.cuePreferences || DEFAULT_BREATHING_CUE_PREFERENCES,
      };
      setPreferences(updatedPrefs);
      saveBreathingPreferences(updatedPrefs);

      // Resolve active phases
      const resolved = resolveActivePhases(tech, config.retentionMode, config.tempoMultiplier);
      activePhasesRef.current = resolved;
      phaseIndexRef.current = 0;
      cycleCountRef.current = 1;
      accumulatedPauseTimeRef.current = 0;
      isPausedRef.current = false;
      isUntimedRef.current = config.isUntimedAwareness;
      plannedDurationSecondsRef.current = config.durationMinutes * 60;

      // Start soundscape if requested
      if (config.soundscapeId !== 'silent' && audioRef.current) {
        audioRef.current.playTrack(config.soundscapeId).catch(() => {});
        startedSoundscapeIdRef.current = config.soundscapeId;
      }

      // Enter settling state (3 seconds)
      setLiveState({
        status: 'settling',
        techniqueId: config.techniqueId,
        config,
        currentPhaseIndex: 0,
        currentPhase: resolved[0],
        phaseProgressFraction: 0,
        cycleCount: 1,
        totalElapsedSeconds: 0,
        remainingSeconds: plannedDurationSecondsRef.current,
        settlingRemainingSeconds: 3,
      });

      cleanUpSettleInterval();
      let settleSec = 3;

      settleIntervalRef.current = setInterval(() => {
        settleSec -= 1;
        if (settleSec <= 0) {
          cleanUpSettleInterval();
          const startPerf = performance.now();
          sessionStartTimeRef.current = startPerf;
          phaseStartTimeRef.current = startPerf;

          setLiveState((prev) => ({
            ...prev,
            status: 'running',
            settlingRemainingSeconds: 0,
          }));

          // Trigger initial audio cue
          triggerAudioCue(resolved[0].type, config.audioCueEnabled, config.cuePreferences);

          cancelRaf();
          rafIdRef.current = requestAnimationFrame(runLoop);
        } else {
          setLiveState((prev) => ({
            ...prev,
            settlingRemainingSeconds: settleSec,
          }));
        }
      }, 1000);
    },
    [audio, runLoop, triggerAudioCue]
  );

  const pauseSession = useCallback(() => {
    if (liveState.status !== 'running') return;
    isPausedRef.current = true;
    pauseAnchorRef.current = performance.now();
    cancelRaf();
    setLiveState((prev) => ({ ...prev, status: 'paused' }));
  }, [liveState.status]);

  const resumeSession = useCallback(() => {
    if (liveState.status !== 'paused') return;
    const pauseDuration = performance.now() - pauseAnchorRef.current;
    accumulatedPauseTimeRef.current += pauseDuration;
    isPausedRef.current = false;
    setLiveState((prev) => ({ ...prev, status: 'running' }));
    cancelRaf();
    rafIdRef.current = requestAnimationFrame(runLoop);
  }, [liveState.status, runLoop]);

  const stopSession = useCallback(() => {
    stopPreview();
    cleanUpSettleInterval();
    cancelRaf();
    stopActiveSoundscape();
    isPausedRef.current = false;
    setActiveTechnique(null);
    setLiveState(defaultInitialLiveState);
  }, [stopActiveSoundscape]);

  const dismissCompletion = useCallback(() => {
    setActiveTechnique(null);
    setLiveState(defaultInitialLiveState);
  }, []);

  // Background tab defense: automatically pause when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && liveState.status === 'running') {
        pauseSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [liveState.status, pauseSession]);

  // Cleanup on genuine unmount ONLY
  useEffect(() => {
    return () => {
      cleanUpSettleInterval();
      cancelRaf();
      if (startedSoundscapeIdRef.current && audioRef.current) {
        audioRef.current.stopTrack(startedSoundscapeIdRef.current as any).catch(() => {});
        startedSoundscapeIdRef.current = null;
      }
    };
  }, []);

  const contextValue: BreathingContextType = {
    activeTechnique,
    setupTechnique,
    liveState,
    preferences,
    startSetup,
    closeSetup,
    beginSession,
    pauseSession,
    resumeSession,
    stopSession,
    dismissCompletion,
  };

  return (
    <BreathingContext.Provider value={contextValue}>
      {children}
    </BreathingContext.Provider>
  );
};

export function useBreathing(): BreathingContextType {
  const context = useContext(BreathingContext);
  if (!context) {
    throw new Error('useBreathing must be used within a BreathingProvider');
  }
  return context;
}
