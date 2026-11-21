/**
 * NeuroCalm & Fokus — Active Breathing Player
 * Phase 3A: Minimalist, distraction-free breathing canvas with
 * real-time guidance, settling countdown, and immediate safety abort.
 */

import React from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Clock,
  Repeat,
} from 'lucide-react';
import { useBreathing } from '../../context/BreathingContext';
import { useLocale } from '../../context/LocaleContext';
import { BreathingOrb } from './BreathingOrb';
import { formatBreathingTime } from '../../utils/breathingTimer';

export const BreathingPlayer: React.FC = () => {
  const { t } = useLocale();
  const {
    activeTechnique,
    liveState,
    pauseSession,
    resumeSession,
    stopSession,
  } = useBreathing();

  // Screen Reader Phase Announcements:
  // Announce the active phase exactly once per phase transition.
  // Never announce on countdown updates, animation frames, or pause/resume.
  const [announcedPhaseText, setAnnouncedPhaseText] = React.useState<string>('');
  const lastAnnouncedPhaseKeyRef = React.useRef<string>('');

  React.useEffect(() => {
    if (liveState.status === 'idle') {
      lastAnnouncedPhaseKeyRef.current = '';
      setAnnouncedPhaseText('');
      return;
    }

    if (liveState.status !== 'running') {
      return;
    }

    const currentKey = liveState.config.isUntimedAwareness
      ? 'untimed-awareness'
      : `${liveState.cycleCount}-${liveState.currentPhaseIndex}-${liveState.currentPhase.type}`;

    if (currentKey !== lastAnnouncedPhaseKeyRef.current) {
      lastAnnouncedPhaseKeyRef.current = currentKey;
      const label = liveState.config.isUntimedAwareness
        ? t('breathingUntimedNaturalLabel')
        : t(liveState.currentPhase.labelKey as any);
      setAnnouncedPhaseText(label);
    }
  }, [
    liveState.status,
    liveState.cycleCount,
    liveState.currentPhaseIndex,
    liveState.currentPhase.type,
    liveState.currentPhase.labelKey,
    liveState.config.isUntimedAwareness,
    t,
  ]);

  if (!activeTechnique || liveState.status === 'idle') {
    return null;
  }

  const isPaused = liveState.status === 'paused';
  const isSettling = liveState.status === 'settling';

  return (
    <div className="relative w-full rounded-3xl bg-calm-card border border-calm-border/80 p-6 sm:p-8 shadow-xl text-center space-y-6 animate-fadeIn overflow-hidden">
      {/* Screen Reader Live Region for Phase Transitions */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcedPhaseText}
      </div>

      {/* Top Header / Progress Info */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-calm-border/50 text-start">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-calm-text leading-tight">
            {t(activeTechnique.nameKey as any)}
          </h2>
          <p className="text-xs text-calm-muted line-clamp-1">
            {t(activeTechnique.subtitleKey as any)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Cycle Counter or Natural Awareness Badge */}
          {!isSettling && (
            liveState.config.isUntimedAwareness ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-calm-surface text-teal-400 border border-teal-500/30">
                <span>{t('breathingUntimedNaturalLabel')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-calm-surface text-calm-muted border border-calm-border/60">
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('breathingCycleCounter', { current: liveState.cycleCount })}</span>
              </span>
            )
          )}

          {/* Remaining Time */}
          {!isSettling && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-calm-primary/15 text-calm-primary border border-calm-primary/25">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{formatBreathingTime(liveState.remainingSeconds)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Interactive Stage */}
      {isSettling ? (
        <div className="py-16 sm:py-24 space-y-5">
          <div className="w-24 h-24 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/25 mx-auto flex items-center justify-center animate-pulse">
            <span className="text-4xl font-extrabold font-mono">
              {liveState.settlingRemainingSeconds}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-medium text-calm-text">
              {t('breathingSettlePrompt')}
            </p>
            <p className="text-xs text-calm-muted">
              {t('breathingReturnToNatural')}
            </p>
          </div>
        </div>
      ) : (
        <BreathingOrb
          currentPhase={liveState.currentPhase}
          progressFraction={liveState.phaseProgressFraction}
          isPaused={isPaused}
          isUntimedAwareness={liveState.config.isUntimedAwareness}
        />
      )}

      {/* Bottom Controls Bar */}
      <div className="pt-4 border-t border-calm-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Pause / Resume Control */}
        {!isSettling ? (
          <button
            type="button"
            onClick={isPaused ? resumeSession : pauseSession}
            className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
              isPaused
                ? 'bg-calm-primary text-slate-900 hover:bg-emerald-400 shadow-sm'
                : 'bg-calm-surface text-calm-text hover:bg-calm-surface/80 border border-calm-border'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>{t('breathingResume')}</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>{t('breathingPause')}</span>
              </>
            )}
          </button>
        ) : (
          <div className="hidden sm:block" />
        )}

        {/* Immediate Safety Stop / Return to Natural Breath */}
        <button
          type="button"
          onClick={stopSession}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('breathingReturnToNatural')}</span>
        </button>
      </div>
    </div>
  );
};
