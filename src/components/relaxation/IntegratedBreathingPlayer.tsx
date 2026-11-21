/**
 * NeuroCalm & Fokus — Integrated Breathing Player
 * Phase 3C: Unified breathing canvas combining the breathing orb,
 * settling countdown, sensory guidance, and in-player audio volume drawer.
 */

import React, { useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Clock,
  Repeat,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRelaxationSession } from '../../context/RelaxationSessionContext';
import { useBreathing } from '../../context/BreathingContext';
import { useLocale } from '../../context/LocaleContext';
import { BreathingOrb } from '../breathing/BreathingOrb';
import { formatBreathingTime } from '../../utils/breathingTimer';
import { getSoundNameKey } from '../audio/SoundCard';

export const IntegratedBreathingPlayer: React.FC = () => {
  const { t } = useLocale();
  const {
    liveState,
    pauseSession,
    resumeSession,
    stopSession,
    setSessionTrackVolume,
    toggleSessionTrackMute,
    toggleKeepAudioOnPause,
  } = useRelaxationSession();

  const breathing = useBreathing();
  const [isAudioDrawerOpen, setIsAudioDrawerOpen] = useState(false);

  // Screen Reader Phase Announcements for Integrated Breathing
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

    const currentKey = liveState.isUntimedAwareness
      ? 'untimed-awareness'
      : `${breathing.liveState.cycleCount}-${breathing.liveState.currentPhaseIndex}-${breathing.liveState.currentPhase.type}`;

    if (currentKey !== lastAnnouncedPhaseKeyRef.current) {
      lastAnnouncedPhaseKeyRef.current = currentKey;
      const label = liveState.isUntimedAwareness
        ? t('breathingUntimedNaturalLabel')
        : t(breathing.liveState.currentPhase.labelKey as any);
      setAnnouncedPhaseText(label);
    }
  }, [
    liveState.status,
    liveState.isUntimedAwareness,
    breathing.liveState.cycleCount,
    breathing.liveState.currentPhaseIndex,
    breathing.liveState.currentPhase.type,
    breathing.liveState.currentPhase.labelKey,
    t,
  ]);

  if (!liveState.definition || liveState.status === 'idle') {
    return null;
  }

  const isPaused = liveState.status === 'paused';
  const isSettling = liveState.status === 'settling';

  return (
    <div className="relative w-full rounded-3xl bg-calm-card border border-calm-border/80 p-6 sm:p-8 shadow-xl text-center space-y-6 animate-fadeIn overflow-hidden">
      {/* Screen Reader Live Region for Phase Transitions */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcedPhaseText}
      </div>

      {/* Top Header / Progress Info */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-calm-border/50 text-start">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-calm-text leading-tight">
            {t(liveState.definition.nameKey as any)}
          </h2>
          <p className="text-xs text-calm-muted line-clamp-1">
            {t(liveState.definition.subtitleKey as any)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Cycle Counter or Natural Awareness Badge */}
          {!isSettling && (
            liveState.isUntimedAwareness ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-calm-surface text-teal-400 border border-teal-500/30">
                <span>{t('breathingUntimedNaturalLabel')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-calm-surface text-calm-muted border border-calm-border/60">
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('breathingCycleCounter', { current: breathing.liveState.cycleCount })}</span>
              </span>
            )
          )}

          {/* Remaining Time */}
          {!isSettling && liveState.remainingSeconds !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-calm-primary/15 text-calm-primary border border-calm-primary/25 font-mono">
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
          currentPhase={breathing.liveState.currentPhase}
          progressFraction={breathing.liveState.phaseProgressFraction}
          isPaused={isPaused}
          isUntimedAwareness={liveState.isUntimedAwareness}
        />
      )}

      {/* Floating In-Player Audio Drawer */}
      {!isSettling && liveState.sessionOwnedTracks.length > 0 && (
        <div className="rounded-2xl bg-calm-surface/80 border border-calm-border/70 overflow-hidden text-start transition-all">
          <button
            type="button"
            onClick={() => setIsAudioDrawerOpen(!isAudioDrawerOpen)}
            className="w-full p-3 px-4 flex items-center justify-between text-xs font-medium text-calm-text hover:bg-calm-surface transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
              <span>{t('sessionDrawerAudioTitle')}</span>
              <span className="text-[11px] text-calm-muted">
                ({liveState.sessionOwnedTracks.map((id) => t(getSoundNameKey(id) as any)).join(' • ')})
              </span>
            </div>
            {isAudioDrawerOpen ? (
              <ChevronUp className="w-4 h-4 text-calm-muted" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-calm-muted" aria-hidden="true" />
            )}
          </button>

          {isAudioDrawerOpen && (
            <div className="p-4 pt-2 border-t border-calm-border/50 space-y-3 animate-fadeIn">
              {liveState.sessionOwnedTracks.map((soundId) => {
                const vol = liveState.trackVolumes[soundId] ?? 0.7;
                const isMuted = Boolean(liveState.trackMuted[soundId]);
                const percent = isMuted ? 0 : Math.round(vol * 100);

                return (
                  <div key={soundId} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-calm-text w-28 truncate">
                      {t(getSoundNameKey(soundId) as any)}
                    </span>

                    <div className="flex items-center gap-2.5 flex-1 max-w-xs">
                      <button
                        type="button"
                        onClick={() => toggleSessionTrackMute(soundId)}
                        aria-label={t(getSoundNameKey(soundId) as any)}
                        className="p-1 rounded text-calm-muted hover:text-calm-text"
                      >
                        {isMuted || percent === 0 ? (
                          <VolumeX className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
                        )}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={percent}
                        onChange={(e) => setSessionTrackVolume(soundId, Number(e.target.value) / 100)}
                        aria-label={t(getSoundNameKey(soundId) as any)}
                        className="w-full h-1 bg-calm-border rounded-lg appearance-none cursor-pointer accent-calm-primary"
                      />

                      <span className="font-mono text-[11px] text-calm-muted w-8 text-end">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Keep audio on pause toggle */}
              <div className="pt-2 border-t border-calm-border/40 flex items-center justify-between text-[11px] text-calm-muted">
                <span>{t('sessionKeepAudioOnPause')}</span>
                <input
                  type="checkbox"
                  checked={liveState.keepAudioOnPause}
                  onChange={toggleKeepAudioOnPause}
                  className="w-3.5 h-3.5 rounded border-calm-border text-calm-primary focus:ring-calm-primary"
                />
              </div>
            </div>
          )}
        </div>
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
          onClick={() => void stopSession()}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('sessionReturnToNatural')}</span>
        </button>
      </div>
    </div>
  );
};
