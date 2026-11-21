import React from 'react';
import { Coffee, Flame, FastForward, CheckCircle2, X } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { PomodoroSequenceState } from '../../types/pomodoro';
import { calculateNextInterval } from '../../utils/pomodoroSequence';

interface PomodoroTransitionCardProps {
  pomodoroState: PomodoroSequenceState;
  onAdvance: () => void;
  onSkipBreak?: () => void;
  onStopSequence: () => void;
}

export const PomodoroTransitionCard: React.FC<PomodoroTransitionCardProps> = ({
  pomodoroState,
  onAdvance,
  onSkipBreak,
  onStopSequence,
}) => {
  const { t } = useLocale();
  const { intervalType } = pomodoroState;

  // Calculate what the next interval will be
  const nextSpec = calculateNextInterval(pomodoroState);

  const isWorkCompleted = intervalType === 'work';

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-lg space-y-6 animate-in fade-in-50 duration-200">
      {/* Header & Icon */}
      <div className="flex items-center gap-4">
        <div
          className={`p-3 rounded-xl border ${
            isWorkCompleted
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              : 'bg-emerald-500/10 text-calm-primary border-emerald-500/20'
          }`}
        >
          {isWorkCompleted ? (
            <Coffee className="w-6 h-6" aria-hidden="true" />
          ) : (
            <Flame className="w-6 h-6" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-calm-text">
            {isWorkCompleted
              ? t('workCompletedCardTitle')
              : t('breakCompletedCardTitle')}
          </h2>
          <p className="text-xs text-calm-muted">
            {isWorkCompleted
              ? t('workCompletedCardMessage')
              : t('breakCompletedCardMessage')}
          </p>
        </div>
      </div>

      {/* Next Up Banner */}
      <div className="p-4 rounded-xl bg-slate-800/40 border border-calm-border/60 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-calm-muted font-semibold">
            Next Interval
          </span>
          <p className="text-sm font-semibold text-calm-text">
            {nextSpec.nextIntervalType === 'work'
              ? t('intervalWork')
              : nextSpec.nextIntervalType === 'long_break'
              ? t('intervalLongBreak')
              : t('intervalShortBreak')}
          </p>
        </div>

        <span className="text-base font-bold text-calm-text px-3 py-1 rounded-lg bg-slate-800 border border-calm-border">
          {nextSpec.nextDurationMinutes} {t('minutesUnit')}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={onAdvance}
          className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-white text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            isWorkCompleted
              ? 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 focus-visible:ring-cyan-500'
              : 'bg-calm-primary hover:bg-emerald-600 active:bg-emerald-700 focus-visible:ring-calm-primary'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>{isWorkCompleted ? t('startBreak') : t('startWork')}</span>
        </button>

        {isWorkCompleted && onSkipBreak && (
          <button
            type="button"
            onClick={onSkipBreak}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-calm-text text-xs font-medium border border-calm-border transition-colors"
          >
            <FastForward className="w-3.5 h-3.5 text-calm-muted" aria-hidden="true" />
            <span>{t('skipBreak')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onStopSequence}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-calm-muted hover:text-red-400 text-xs font-medium transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('endSequence')}</span>
        </button>
      </div>
    </div>
  );
};
