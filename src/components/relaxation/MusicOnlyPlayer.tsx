/**
 * NeuroCalm & Fokus — Music-Only Relaxation Player
 * Phase 3C: Minimalist listening canvas for passive acoustic relaxation without
 * breathing orbs, timer counters, or breath-tracking cues.
 */

import React from 'react';
import {
  Pause,
  Play,
  Square,
  Music,
  Clock,
  Volume2,
  VolumeX,
  Headphones,
} from 'lucide-react';
import { useRelaxationSession } from '../../context/RelaxationSessionContext';
import { useLocale } from '../../context/LocaleContext';
import { formatBreathingTime } from '../../utils/breathingTimer';
import { getSoundNameKey } from '../audio/SoundCard';

export const MusicOnlyPlayer: React.FC = () => {
  const { t } = useLocale();
  const {
    liveState,
    pauseSession,
    resumeSession,
    stopSession,
    setSessionTrackVolume,
    toggleSessionTrackMute,
  } = useRelaxationSession();

  if (!liveState.definition || liveState.status === 'idle') {
    return null;
  }

  const isPaused = liveState.status === 'paused';
  const isOpenEnded = liveState.durationMinutes === 'open_ended';

  return (
    <div className="relative w-full rounded-3xl bg-calm-card border border-calm-border/80 p-6 sm:p-8 shadow-xl text-center space-y-6 animate-fadeIn overflow-hidden">
      {/* Top Header / Progress Info */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-calm-border/50 text-start">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="p-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Music className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-calm-text leading-tight">
              {t(liveState.definition.nameKey as any)}
            </h2>
          </div>
          <p className="text-xs text-calm-muted line-clamp-1">
            {t(liveState.definition.subtitleKey as any)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-calm-surface text-purple-400 border border-purple-500/30">
            <span>{t('sessionModeMusicOnly')}</span>
          </span>

          {/* Time Display */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-calm-primary/15 text-calm-primary border border-calm-primary/25 font-mono">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {isOpenEnded
                ? `${t('sessionTimeElapsed')}: ${formatBreathingTime(liveState.elapsedSeconds)}`
                : formatBreathingTime(liveState.remainingSeconds || 0)}
            </span>
          </span>
        </div>
      </div>

      {/* Minimalist Ambient Listening Visual Stage */}
      <div className="py-12 sm:py-16 relative flex items-center justify-center">
        {/* Concentric Ambient Ripples */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-44 h-44 sm:w-56 sm:h-56 rounded-full border border-teal-500/20 bg-teal-500/5 transition-transform duration-1000 ${
              isPaused ? 'scale-95 opacity-50' : 'animate-pulse scale-100 opacity-80'
            }`}
          />
          <div
            className={`absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full border border-teal-500/30 bg-teal-500/10 transition-transform duration-700 ${
              isPaused ? 'scale-95' : 'scale-100'
            }`}
          />
          <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-calm-surface border border-calm-border flex items-center justify-center shadow-lg text-calm-primary">
            <Headphones className="w-8 h-8 opacity-90" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Accompaniment Audio Track Controls */}
      <div className="p-4 rounded-2xl bg-calm-surface/80 border border-calm-border/70 space-y-3 text-start max-w-lg mx-auto">
        <span className="text-xs font-semibold text-calm-text block">
          {t('sessionDrawerAudioTitle')}
        </span>

        <div className="space-y-2.5">
          {liveState.sessionOwnedTracks.map((soundId) => {
            const vol = liveState.trackVolumes[soundId] ?? 0.7;
            const isMuted = Boolean(liveState.trackMuted[soundId]);
            const percent = isMuted ? 0 : Math.round(vol * 100);

            return (
              <div key={soundId} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-calm-text w-32 truncate">
                  {t(getSoundNameKey(soundId) as any)}
                </span>

                <div className="flex items-center gap-2.5 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleSessionTrackMute(soundId)}
                    aria-label={t(getSoundNameKey(soundId) as any)}
                    className="p-1 rounded text-calm-muted hover:text-calm-text"
                  >
                    {isMuted || percent === 0 ? (
                      <VolumeX className="w-4 h-4 text-red-400" aria-hidden="true" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-calm-primary" aria-hidden="true" />
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

                  <span className="font-mono text-xs text-calm-muted w-9 text-end">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="pt-4 border-t border-calm-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Play / Pause Toggle */}
        <button
          type="button"
          onClick={isPaused ? resumeSession : pauseSession}
          className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
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

        {/* Stop Action */}
        <button
          type="button"
          onClick={() => void stopSession()}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-colors"
        >
          <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          <span>{t('mixerSoundStop')}</span>
        </button>
      </div>
    </div>
  );
};
