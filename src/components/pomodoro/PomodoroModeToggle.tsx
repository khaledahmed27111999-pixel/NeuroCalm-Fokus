import React from 'react';
import { Clock, Repeat } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { FocusMode } from '../../types/focus';

interface PomodoroModeToggleProps {
  mode: FocusMode;
  onModeChange: (mode: FocusMode) => void;
  disabled?: boolean;
}

export const PomodoroModeToggle: React.FC<PomodoroModeToggleProps> = ({
  mode,
  onModeChange,
  disabled = false,
}) => {
  const { t } = useLocale();

  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-label="Timer Mode Selection"
        className="grid grid-cols-2 p-1 rounded-xl bg-slate-800/60 border border-calm-border"
      >
        {/* Standard Timer */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('standard')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            mode === 'standard'
              ? 'bg-calm-card text-calm-text shadow-sm border border-calm-border'
              : 'text-calm-muted hover:text-calm-text hover:bg-slate-800/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={mode === 'standard'}
          title={disabled ? t('switchModeActiveWarning') : undefined}
        >
          <Clock className="w-4 h-4 shrink-0 text-calm-primary" aria-hidden="true" />
          <span>{t('modeTimer')}</span>
        </button>

        {/* Pomodoro */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('pomodoro')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
            mode === 'pomodoro'
              ? 'bg-calm-card text-calm-text shadow-sm border border-calm-border'
              : 'text-calm-muted hover:text-calm-text hover:bg-slate-800/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={mode === 'pomodoro'}
          title={disabled ? t('switchModeActiveWarning') : undefined}
        >
          <Repeat className="w-4 h-4 shrink-0 text-cyan-400" aria-hidden="true" />
          <span>{t('modePomodoro')}</span>
        </button>
      </div>

      {disabled && (
        <p className="text-[11px] text-calm-muted/80 text-center">
          {t('switchModeActiveWarning')}
        </p>
      )}
    </div>
  );
};
