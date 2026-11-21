/**
 * NeuroCalm & Fokus — AudioProvider React Context
 * Subscribes to the AudioEngine singleton and surfaces state to UI.
 */

import React, { createContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AudioContextType,
  AudioEngineState,
  SoundscapeId,
} from '../types/audio';
import { AudioEngine } from '../audio/AudioEngine';

export const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Subscribe to AudioEngine singleton
  const engine = useMemo(() => AudioEngine.getInstance(), []);
  const [engineState, setEngineState] = useState<AudioEngineState>(() => engine.getState());

  useEffect(() => {
    // Sync state on mount and listen to changes
    setEngineState(engine.getState());
    const unsubscribe = engine.subscribe((newState) => {
      setEngineState(newState);
    });

    return () => {
      // In React StrictMode, unmount simply removes listener; it NEVER closes the AudioContext!
      unsubscribe();
    };
  }, [engine]);

  const playTrack = useCallback(
    async (id: SoundscapeId): Promise<boolean> => {
      // Call engine.prepareContext synchronously in this user click stack if needed
      engine.prepareContext();
      return engine.playTrack(id);
    },
    [engine]
  );

  const stopTrack = useCallback(
    async (id: SoundscapeId): Promise<void> => {
      return engine.stopTrack(id);
    },
    [engine]
  );

  const setTrackVolume = useCallback(
    (id: SoundscapeId, volume: number): void => {
      engine.setTrackVolume(id, volume);
    },
    [engine]
  );

  const setMasterVolume = useCallback(
    (volume: number): void => {
      engine.setMasterVolume(volume);
    },
    [engine]
  );

  const toggleMute = useCallback((): void => {
    engine.toggleMute();
  }, [engine]);

  const stopAll = useCallback(async (): Promise<void> => {
    return engine.stopAll();
  }, [engine]);

  const clearConflictError = useCallback((): void => {
    engine.clearConflictError();
  }, [engine]);

  const scheduleSleepFade = useCallback(
    (fadeDurationSec: number): void => {
      engine.scheduleSleepFade(fadeDurationSec);
    },
    [engine]
  );

  const cancelSleepFade = useCallback((): void => {
    engine.cancelSleepFade();
  }, [engine]);

  const resetSleepFade = useCallback((): void => {
    engine.resetSleepFade();
  }, [engine]);

  const getSleepFadeGain = useCallback((): number => {
    return engine.getSleepFadeGain();
  }, [engine]);

  const contextValue: AudioContextType = useMemo(
    () => ({
      state: engineState,
      playTrack,
      stopTrack,
      setTrackVolume,
      setMasterVolume,
      toggleMute,
      stopAll,
      clearConflictError,
      scheduleSleepFade,
      cancelSleepFade,
      resetSleepFade,
      getSleepFadeGain,
    }),
    [
      engineState,
      playTrack,
      stopTrack,
      setTrackVolume,
      setMasterVolume,
      toggleMute,
      stopAll,
      clearConflictError,
      scheduleSleepFade,
      cancelSleepFade,
      resetSleepFade,
      getSleepFadeGain,
    ]
  );

  return <AudioContext.Provider value={contextValue}>{children}</AudioContext.Provider>;
};
