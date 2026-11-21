import React from 'react';
import { Play, Pause, Square, RotateCcw, FastForward, Plus } from 'lucide-react';
import { ActiveFocusSessionState } from '../../types/focus';
import { formatTimeDisplay } from '../../utils/focusTimer';
import { useLocale } from '../../context/LocaleContext';

interface FocusTimerDisplayProps {
  session: ActiveFocusSessionState;
  remainingSeconds: number;
  progressPercent: number;
  onPause: () => void;
  onResume: () => void;
  onEndEarly: () => void;
  onRestart: () => void;
  onExtendBreak?: (minutes: number) => void;
  onSkipBreak?: () => void;
  onStopSequence?: () => void;
}

export const FocusTimerDisplay: React.FC<FocusTimerDisplayProps> = ({
  session,
  remainingSeconds,
  progressPercent,
  onPause,
  onResume,
  onEndEarly,
  onRestart,
  onExtendBreak,
  onSkipBreak,
  onStopSequence,
}) => {
  const { t } = useLocale();
  const isPaused = session.status === 'paused';
  const isBreak =
    session.mode === 'pomodoro' &&
    session.pomodoro !== undefined &&
    session.pomodoro.intervalType !== 'work';

  // Circle progress calculation (radius = 120, circumference = 2 * PI * 120 ≈ 753.98)
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="p-6 sm:p-10 rounded-2xl bg-calm-card border border-calm-border shadow-sm flex flex-col items-center justify-center space-y-6">
      {/* Linked Task Context Header if present (only during work intervals or standard mode) */}
      {session.taskTitle && !isBreak && (
        <div className="px-3.5 py-1.5 rounded-full bg-calm-surface border border-calm-border text-xs font-medium text-calm-text max-w-sm truncate text-center">
          {session.taskTitle}
        </div>
      )}

      {/* Circular Progress & Countdown Timer */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox="0 0 280 280"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx="140"
            cy="140"
            r={radius}
            className="stroke-calm-surface"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Animated progress ring */}
          <circle
            cx="140"
            cy="140"
            r={radius}
            className={`transition-all duration-700 ease-linear motion-reduce:transition-none ${
              isBreak ? 'stroke-cyan-400' : 'stroke-calm-primary'
            }`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Inner Content Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <span
            aria-live="off"
            className="text-4xl sm:text-5xl font-mono font-semibold tracking-tight text-calm-text"
          >
            {formatTimeDisplay(remainingSeconds)}
          </span>

          <span
            className={`mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isPaused
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : isBreak
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                : 'bg-emerald-500/10 text-calm-primary border-emerald-500/20'
            }`}
          >
            {isPaused
              ? t('pausedStatus')
              : isBreak
              ? t('restingStatus')
              : t('runningStatus')}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {/* Pause / Resume Button */}
        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? t('resumeFocus') : t('pauseFocus')}
          title={isPaused ? t('resumeFocus') : t('pauseFocus')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 ${
            isBreak
              ? 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 focus-visible:ring-cyan-500'
              : 'bg-calm-primary hover:bg-emerald-600 active:bg-emerald-700 focus-visible:ring-calm-primary'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>{t('resumeFocus')}</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>{t('pauseFocus')}</span>
            </>
          )}
        </button>

        {/* Break Extension Button (+5 min) */}
        {isBreak && onExtendBreak && (
          <button
            type="button"
            onClick={() => onExtendBreak(5)}
            aria-label={t('extendBreak5m')}
            title={t('extendBreak5m')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-calm-surface text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30 transition-colors text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('extendBreak5m')}</span>
          </button>
        )}

        {/* Skip Break Button */}
        {isBreak && onSkipBreak && (
          <button
            type="button"
            onClick={onSkipBreak}
            aria-label={t('skipBreak')}
            title={t('skipBreak')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-calm-surface text-calm-text hover:bg-slate-700/60 border border-calm-border transition-colors text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
          >
            <FastForward className="w-3.5 h-3.5 text-calm-muted" aria-hidden="true" />
            <span>{t('skipBreak')}</span>
          </button>
        )}

        {/* Restart Button (restarts current segment) */}
        <button
          type="button"
          onClick={onRestart}
          aria-label={t('restartFocus')}
          title={t('restartFocus')}
          className="p-2.5 rounded-xl bg-calm-surface text-calm-muted hover:text-calm-text border border-calm-border hover:border-calm-border/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* End / Stop Button */}
        {isBreak && onStopSequence ? (
          <button
            type="button"
            onClick={onStopSequence}
            aria-label={t('endSequence')}
            title={t('endSequence')}
            className="p-2.5 rounded-xl bg-calm-surface text-calm-muted hover:text-rose-400 hover:bg-rose-500/10 border border-calm-border hover:border-rose-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <Square className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onEndEarly}
            aria-label={t('endFocusEarly')}
            title={t('endFocusEarly')}
            className="p-2.5 rounded-xl bg-calm-surface text-calm-muted hover:text-rose-400 hover:bg-rose-500/10 border border-calm-border hover:border-rose-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <Square className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
