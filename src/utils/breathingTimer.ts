/**
 * NeuroCalm & Fokus — Breathing Timing Engine Utilities
 * Phase 3A: High-precision timing mathematics, phase resolution,
 * and hold-free pattern enforcement.
 */

import {
  BreathingTechnique,
  BreathingPhaseDefinition,
  RetentionMode,
} from '../types/breathing';

/**
 * Resolves the active phase sequence for a technique based on retention mode.
 * Strictly guarantees that 'hold_free' mode contains zero breath-holds.
 */
export function resolveActivePhases(
  technique: BreathingTechnique,
  retentionMode: RetentionMode,
  tempoMultiplier: number = 1.0
): BreathingPhaseDefinition[] {
  let basePhases: BreathingPhaseDefinition[];

  if (retentionMode === 'hold_free') {
    if (technique.holdFreePhases && technique.holdFreePhases.length > 0) {
      basePhases = technique.holdFreePhases;
    } else {
      // Fallback filter: dynamically remove any hold phase
      basePhases = technique.phases.filter(
        (p) => p.type !== 'hold_in' && p.type !== 'hold_out'
      );
    }
  } else if (retentionMode === 'triangle' && technique.trianglePhases) {
    basePhases = technique.trianglePhases;
  } else {
    basePhases = technique.phases;
  }

  // Double check: if retentionMode is hold_free, enforce zero holds
  if (retentionMode === 'hold_free') {
    basePhases = basePhases.filter(
      (p) => p.type !== 'hold_in' && p.type !== 'hold_out'
    );
  }

  // Safety clamp on tempoMultiplier
  const clampedMultiplier = Math.min(1.35, Math.max(0.75, tempoMultiplier));

  return basePhases.map((phase) => ({
    ...phase,
    durationSeconds: Math.round(phase.durationSeconds * clampedMultiplier * 10) / 10,
  }));
}

/**
 * Calculates the total duration in seconds of a single full breathing cycle.
 */
export function calculateCycleDurationSeconds(phases: BreathingPhaseDefinition[]): number {
  return phases.reduce((sum, phase) => sum + phase.durationSeconds, 0);
}

/**
 * Formats seconds into MM:SS display.
 */
export function formatBreathingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
