import React from 'react';
import { Coffee, Flame, Moon } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { PomodoroSequenceState } from '../../types/pomodoro';

interface PomodoroCycleIndicatorProps {
  pomodoroState: PomodoroSequenceState;
}

export const PomodoroCycleIndicator: React.FC<PomodoroCycleIndicatorProps> = ({
  pomodoroState,
}) => {
  const { t } = useLocale();
  const {
    intervalType,
    cycleIntervalNumber,
    intervalsBeforeLongBreak,
    cumulativeWorkIntervals,
  } = pomodoroState;

  const totalDots = Math.max(1, intervalsBeforeLongBreak);
  const currentInterval = Math.min(totalDots, Math.max(1, cycleIntervalNumber));

  // Determine interval badge style
  const getBadgeContent = () => {
    switch (intervalType) {
      case 'work':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />,
          label: t('intervalWork'),
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'short_break':
        return {
          icon: <Coffee className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />,
          label: t('intervalShortBreak'),
          className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
        };
      case 'long_break':
        return {
          icon: <Moon className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />,
          label: t('intervalLongBreak'),
          className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
        };
    }
  };

  const badge = getBadgeContent();

  return (
    <div className="flex flex-col items-center gap-2.5 py-1">
      {/* Interval Badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.className} tracking-wide`}
      >
        {badge.icon}
        <span>{badge.label}</span>
      </div>

      {/* Cycle Progress Indicators */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: totalDots }).map((_, idx) => {
            const dotNumber = idx + 1;
            const isCompletedInCycle =
              intervalType === 'work'
                ? dotNumber < currentInterval
                : dotNumber <= currentInterval;
            const isCurrent = dotNumber === currentInterval;

            return (
              <span
                key={dotNumber}
                className={`transition-all rounded-full ${
                  isCurrent
                    ? intervalType === 'work'
                      ? 'w-2.5 h-2.5 bg-calm-primary ring-2 ring-calm-primary/30'
                      : 'w-2.5 h-2.5 bg-cyan-400 ring-2 ring-cyan-400/30'
                    : isCompletedInCycle
                    ? 'w-2 h-2 bg-slate-500'
                    : 'w-2 h-2 bg-slate-700/80 border border-slate-600'
                }`}
              />
            );
          })}
        </div>

        <span className="text-xs text-calm-muted font-medium">
          {t('cycleIndicator', {
            current: currentInterval,
            total: totalDots,
          })}
        </span>
      </div>

      {/* Cumulative Work Intervals Note */}
      {cumulativeWorkIntervals > 0 && (
        <span className="text-[11px] text-calm-muted/70">
          {t('cumulativeWorkCount', { count: cumulativeWorkIntervals })}
        </span>
      )}
    </div>
  );
};
