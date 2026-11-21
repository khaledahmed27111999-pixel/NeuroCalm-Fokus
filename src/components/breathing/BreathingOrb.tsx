/**
 * NeuroCalm & Fokus — Breathing Orb Component
 * Phase 3A: Fluid concentric visual breathing guide with reduced-motion fallback.
 */

import React, { useEffect, useState } from 'react';
import { BreathingPhaseDefinition } from '../../types/breathing';
import { useLocale } from '../../context/LocaleContext';

export interface BreathingOrbProps {
  currentPhase: BreathingPhaseDefinition;
  progressFraction: number; // 0.0 to 1.0
  isPaused?: boolean;
  isUntimedAwareness?: boolean;
}

export const BreathingOrb: React.FC<BreathingOrbProps> = ({
  currentPhase,
  progressFraction,
  isPaused = false,
  isUntimedAwareness = false,
}) => {
  const { t } = useLocale();

  // Detect reduced-motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute smooth visual scale
  // In untimed natural awareness mode, the orb remains at a stable, calm baseline size (scale 1.0)
  // to avoid dictating an unwanted visual breathing pace.
  // In timed mode:
  // On inhale: scales from 1.0 up to targetScale
  // On hold_in: holds targetScale steady
  // On exhale: scales from targetScale down to 1.0
  // On hold_out/rest: holds base size 1.0
  let scale = 1.0;
  if (!prefersReducedMotion && !isUntimedAwareness) {
    const target = currentPhase.targetScale || 1.4;
    if (currentPhase.type === 'inhale' || currentPhase.type === 'inhale_second') {
      scale = 1.0 + (target - 1.0) * progressFraction;
    } else if (currentPhase.type === 'hold_in') {
      scale = target;
    } else if (currentPhase.type === 'exhale') {
      scale = target - (target - 1.0) * progressFraction;
    } else {
      scale = 1.0;
    }
  }

  // Calculate remaining whole seconds in the current phase
  // Derived directly from currentPhase.durationSeconds and progressFraction
  // Guaranteed zero drift with BreathingContext engine
  const remainingPhaseSeconds = Math.max(
    1,
    Math.ceil(currentPhase.durationSeconds * (1.0 - progressFraction))
  );

  // Visual color tint based on phase
  let phaseColor = 'text-teal-400';
  let orbBg = 'from-teal-500/20 to-emerald-500/10 border-teal-500/30';
  let glowColor = 'rgba(20, 184, 166, 0.25)';

  if (currentPhase.type === 'hold_in' || currentPhase.type === 'hold_out') {
    phaseColor = 'text-sky-400';
    orbBg = 'from-sky-500/20 to-blue-500/10 border-sky-500/30';
    glowColor = 'rgba(56, 189, 248, 0.25)';
  } else if (currentPhase.type === 'exhale') {
    phaseColor = 'text-emerald-400';
    orbBg = 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30';
    glowColor = 'rgba(16, 185, 129, 0.25)';
  }

  // Reduced motion mode: renders a discrete, calm linear stepper
  if (prefersReducedMotion) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
        {/* Discrete progress line (hidden in untimed awareness) */}
        {!isUntimedAwareness && (
          <div className="w-64 h-3 bg-calm-surface rounded-full overflow-hidden border border-calm-border">
            <div
              className="h-full bg-calm-primary transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${Math.round(progressFraction * 100)}%` }}
            />
          </div>
        )}

        {/* Phase Action Typography */}
        <div className="space-y-2">
          <h3 className={`text-2xl sm:text-3xl font-bold tracking-tight ${phaseColor}`}>
            {isUntimedAwareness ? (
              t('breathingUntimedNaturalLabel')
            ) : (
              <span className="inline-flex items-center gap-2.5 justify-center">
                <span>{t(currentPhase.labelKey as any)}</span>
                <span
                  className="text-base sm:text-lg font-mono font-semibold text-calm-muted"
                  aria-hidden="true"
                >
                  {t('phaseCountdownSeconds', { seconds: remainingPhaseSeconds })}
                </span>
              </span>
            )}
          </h3>
          <p className="text-sm text-calm-muted max-w-xs leading-relaxed mx-auto">
            {isUntimedAwareness ? t('breathingUntimedNaturalGuidance') : t(currentPhase.guidanceKey as any)}
          </p>
        </div>
      </div>
    );
  }

  // Fluid animated visual orb (Default mode)
  return (
    <div className="relative flex flex-col items-center justify-center py-6 my-2 select-none">
      {/* Concentric visual orb stage with shared absolute center */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* Outer ambient glow halo */}
        <div
          className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full transition-transform duration-100 ease-out pointer-events-none"
          style={{
            transform: `scale(${scale * 1.15})`,
            background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
          }}
          aria-hidden="true"
        />

        {/* Middle concentric ring */}
        <div
          className="absolute w-60 h-60 sm:w-68 sm:h-68 rounded-full border border-calm-border/40 transition-transform duration-100 ease-out pointer-events-none"
          style={{ transform: `scale(${scale * 1.05})` }}
          aria-hidden="true"
        />

        {/* Main interactive expanding/contracting orb */}
        <div
          className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full border bg-gradient-to-b ${orbBg} shadow-xl flex flex-col items-center justify-center p-6 text-center transition-transform duration-100 ease-out`}
          style={{
            transform: `scale(${scale})`,
            boxShadow: `0 0 40px ${glowColor}`,
          }}
        >
          <span
            className={`text-xl sm:text-2xl font-bold tracking-wide transition-colors ${phaseColor}`}
          >
            {isUntimedAwareness ? t('breathingUntimedNaturalLabel') : t(currentPhase.labelKey as any)}
          </span>

          {!isUntimedAwareness && !isPaused && (
            <span
              className="text-xs sm:text-sm font-semibold font-mono text-calm-text/80 mt-1 tracking-wider"
              aria-hidden="true"
            >
              {t('phaseCountdownSeconds', { seconds: remainingPhaseSeconds })}
            </span>
          )}

          {isPaused && (
            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 mt-1">
              {t('breathingPause')}
            </span>
          )}
        </div>
      </div>

      {/* Sensory Guidance Prompts Below Orb */}
      <div className="mt-6 text-center max-w-sm px-4">
        <p className="text-xs sm:text-sm text-calm-muted leading-relaxed">
          {isUntimedAwareness ? t('breathingUntimedNaturalGuidance') : t(currentPhase.guidanceKey as any)}
        </p>
      </div>
    </div>
  );
};
