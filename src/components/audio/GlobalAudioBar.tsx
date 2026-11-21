/**
 * NeuroCalm & Fokus — GlobalAudioBar Component
 * Persistent, non-intrusive bottom audio mini-player shown when soundscapes are active across tabs.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Square, Sliders, ChevronUp, Moon, Plus, X } from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useLocale } from '../../context/LocaleContext';
import { getSoundIcon } from './SoundCard';
import { SoundscapeId } from '../../types/audio';
import { PillarTab } from '../../types/navigation';
import { formatTimeDisplay } from '../../utils/focusTimer';

interface GlobalAudioBarProps {
  currentTab: PillarTab;
  onNavigateToRecover: () => void;
}

export const GlobalAudioBar: React.FC<GlobalAudioBarProps> = ({
  currentTab,
  onNavigateToRecover,
}) => {
  const { state, setMasterVolume, toggleMute, stopAll } = useAudio();
  const sleepTimer = useSleepTimer();
  const { t } = useLocale();

  const [isSleepPopoverOpen, setIsSleepPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Screen reader announcements for sleep timer transitions
  const [announcement, setAnnouncement] = useState('');
  const prevStatusRef = useRef(sleepTimer.state.status);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = sleepTimer.state.status;

    if (prevStatus === 'idle' && currentStatus === 'running') {
      setAnnouncement(
        t('sleepTimerAnnounceStarted', {
          timer: sleepTimer.state.durationMinutes,
          fade: Math.round(sleepTimer.state.fadeDurationSeconds / 60),
        })
      );
    } else if (prevStatus === 'running' && currentStatus === 'fading') {
      setAnnouncement(t('sleepTimerAnnounceFading'));
    } else if ((prevStatus === 'running' || prevStatus === 'fading') && currentStatus === 'idle') {
      setAnnouncement(t('sleepTimerAnnounceCancelled'));
    } else if (currentStatus === 'completed' && prevStatus !== 'completed') {
      setAnnouncement(t('sleepTimerAnnounceCompleted'));
    }

    prevStatusRef.current = currentStatus;
  }, [
    sleepTimer.state.status,
    sleepTimer.state.durationMinutes,
    sleepTimer.state.fadeDurationSeconds,
    t,
  ]);

  // Click outside and Escape key handler for popover
  useEffect(() => {
    if (!isSleepPopoverOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSleepPopoverOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSleepPopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSleepPopoverOpen]);

  // If no sounds are active, or user is already on the Recover tab (where full mixer is visible), do not render
  if (state.activeCount === 0 || currentTab === 'recover') {
    return null;
  }

  const activeSoundIds = Object.keys(state.activeTracks) as SoundscapeId[];
  const masterPercent = Math.round(state.masterVolume * 100);

  return (
    <aside
      aria-label={t('mixerNowPlaying')}
      className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-xl animate-fade-in"
    >
      {/* Screen Reader Live Region for Sleep Timer Transitions */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="flex items-center justify-between gap-3 p-3 sm:px-4 rounded-2xl bg-calm-card/95 backdrop-blur-md border border-calm-primary/40 shadow-xl text-calm-text">
        {/* Left: Active sound icons & count */}
        <button
          type="button"
          onClick={onNavigateToRecover}
          className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity text-start focus:outline-none"
          title={t('mixerOpenMixer')}
        >
          <div className="flex -space-x-1 rtl:space-x-reverse shrink-0">
            {activeSoundIds.slice(0, 3).map((id) => (
              <div
                key={id}
                className="w-7 h-7 rounded-full bg-calm-surface border border-calm-border flex items-center justify-center text-calm-primary text-xs shadow-sm"
              >
                {getSoundIcon(id)}
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-calm-primary animate-pulse shrink-0" />
              <span className="font-semibold text-xs text-calm-text truncate">
                {t('mixerNowPlaying')}
              </span>
            </div>
            <span className="text-[11px] text-calm-muted truncate block">
              {t('mixerActiveTracksCount', { count: state.activeCount, max: 4 })}
            </span>
          </div>
        </button>

        {/* Right: Sleep Timer indicator, Master Volume Slider, Mute, Stop All & Open Mixer Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Active Sleep Timer Indicator & Popover */}
          {sleepTimer.state.status !== 'idle' && (
            <div className="relative" ref={popoverRef}>
              <button
                id="global-bar-sleep-toggle"
                type="button"
                onClick={() => setIsSleepPopoverOpen((prev) => !prev)}
                aria-expanded={isSleepPopoverOpen}
                aria-haspopup="dialog"
                aria-label={`${t('sleepTimerConfigure')}: ${formatTimeDisplay(sleepTimer.state.remainingSeconds)}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] rounded-xl text-xs font-semibold border transition-all ${
                  sleepTimer.state.isFading
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-teal-500/10 text-teal-300 border-teal-500/30 hover:bg-teal-500/20'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-calm-primary shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs tabular-nums">
                  {formatTimeDisplay(
                    sleepTimer.state.isFading
                      ? sleepTimer.state.remainingSeconds
                      : sleepTimer.state.remainingSecondsBeforeFade
                  )}
                </span>
              </button>

              {/* Compact Sleep Timer Popover */}
              {isSleepPopoverOpen && (
                <div
                  role="dialog"
                  aria-label={t('sleepTimerTitle')}
                  className="absolute bottom-full mb-3 end-0 z-50 w-72 p-4 rounded-2xl bg-calm-card/95 backdrop-blur-md border border-calm-border/90 shadow-2xl space-y-3 text-start animate-fade-in"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-calm-border/50">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-calm-primary" aria-hidden="true" />
                      <span className="text-xs font-bold text-calm-text">
                        {t('sleepTimerTitle')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSleepPopoverOpen(false)}
                      className="p-1 rounded-lg text-calm-muted hover:text-calm-text transition-colors"
                      aria-label={t('cancel')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-calm-text">
                      {sleepTimer.state.isFading
                        ? t('sleepTimerFadingStatus')
                        : t('sleepTimerRunningStatus')}
                    </div>
                    <div className="text-[11px] font-mono text-calm-muted">
                      {sleepTimer.state.isFading
                        ? t('sleepTimerUntilSilence', {
                            time: formatTimeDisplay(sleepTimer.state.remainingSeconds),
                          })
                        : t('sleepTimerUntilFade', {
                            time: formatTimeDisplay(sleepTimer.state.remainingSecondsBeforeFade),
                          })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-calm-border/50">
                    <button
                      type="button"
                      onClick={() => {
                        sleepTimer.extendTimer(15);
                        setAnnouncement(t('sleepTimerAnnounceExtended'));
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[44px] rounded-xl bg-calm-surface hover:bg-calm-border/60 text-calm-text border border-calm-border text-xs font-semibold transition-colors"
                      aria-label={t('sleepTimerExtend15')}
                    >
                      <Plus className="w-3.5 h-3.5 text-calm-primary" />
                      <span>{t('sleepTimerExtend15')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sleepTimer.cancelTimer();
                        setAnnouncement(t('sleepTimerAnnounceCancelled'));
                        setIsSleepPopoverOpen(false);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 min-h-[44px] rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors"
                      aria-label={t('sleepTimerCancel')}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{t('sleepTimerCancel')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Master Volume Slider (on sm+ screens) */}
          <div className="hidden sm:flex items-center gap-2 w-28">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={state.isMuted ? t('mixerUnmuteAll') : t('mixerMuteAll')}
              className="p-1 rounded text-calm-muted hover:text-calm-text transition-colors"
            >
              {state.isMuted || masterPercent === 0 ? (
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
              value={state.isMuted ? 0 : masterPercent}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              aria-label={t('mixerMasterVolume')}
              className="w-full h-1 bg-calm-border rounded-lg appearance-none cursor-pointer accent-calm-primary"
            />
          </div>

          {/* Mute on mobile */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={state.isMuted ? t('mixerUnmuteAll') : t('mixerMuteAll')}
            className="sm:hidden p-1.5 min-h-[44px] min-w-[44px] rounded-lg bg-calm-surface text-calm-text hover:bg-calm-border transition-colors flex items-center justify-center"
          >
            {state.isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4 text-calm-primary" aria-hidden="true" />
            )}
          </button>

          {/* Stop All */}
          <button
            type="button"
            onClick={() => void stopAll()}
            aria-label={t('mixerStopAll')}
            className="p-1.5 sm:px-2.5 sm:py-1 min-h-[44px] rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors"
            title={t('mixerStopAll')}
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span className="hidden sm:inline">{t('mixerSoundStop')}</span>
          </button>

          {/* Navigate to Mixer */}
          <button
            type="button"
            onClick={onNavigateToRecover}
            aria-label={t('mixerOpenMixer')}
            className="p-1.5 sm:px-3 sm:py-1 min-h-[44px] rounded-lg bg-calm-primary text-slate-900 hover:bg-emerald-400 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('mixerOpenMixer')}</span>
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};
