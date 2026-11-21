/**
 * NeuroCalm & Fokus — useAudio Hook
 * Exposes audio engine controls, active soundscapes, and concurrency state.
 */

import { useContext } from 'react';
import { AudioContext } from '../context/AudioProvider';
import { AudioContextType } from '../types/audio';

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
