/**
 * NeuroCalm & Fokus — useSleepTimer Hook
 * Exposes sleep timer state, countdown, presets, extension, and cancellation controls.
 */

import { useContext } from 'react';
import { SleepTimerContext } from '../context/SleepTimerContext';
import { SleepTimerContextType } from '../types/sleepTimer';

export const useSleepTimer = (): SleepTimerContextType => {
  const context = useContext(SleepTimerContext);
  if (!context) {
    throw new Error('useSleepTimer must be used within a SleepTimerProvider');
  }
  return context;
};
