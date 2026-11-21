import React from 'react';
import { CheckCircle2, RotateCcw, ArrowLeft, Clock } from 'lucide-react';
import { FocusCompletionResult } from '../../types/focus';
import { formatElapsedFocusDuration } from '../../utils/focusTimer';
import { useLocale } from '../../context/LocaleContext';

interface FocusCompletionViewProps {
  result: FocusCompletionResult;
  onStartAnother: () => void;
  onReset: () => void;
}

export const FocusCompletionView: React.FC<FocusCompletionViewProps> = ({
  result,
  onStartAnother,
  onReset,
}) => {
  const { t, locale } = useLocale();
  const wasNatural = result.wasCompletedNaturally;

  return (
    <div className="p-8 sm:p-12 rounded-2xl bg-calm-card border border-calm-border text-center space-y-6 shadow-sm">
      {/* Icon Badge */}
      <div
        className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center border ${
          wasNatural
            ? 'bg-emerald-500/10 text-calm-primary border-emerald-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}
      >
        <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
      </div>

      {/* Title & Supportive Message */}
      <div className="max-w-md mx-auto space-y-2">
        <h3 className="text-xl sm:text-2xl font-semibold text-calm-text">
          {wasNatural ? t('sessionCompletedTitle') : t('sessionEndedEarlyTitle')}
        </h3>
        <p className="text-sm text-calm-muted leading-relaxed">
          {wasNatural ? t('sessionCompletedMessage') : t('sessionEndedEarlyMessage')}
        </p>
      </div>

      {/* Focus Summary Tile */}
      <div className="max-w-xs mx-auto p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center justify-center gap-3">
        <Clock className="w-5 h-5 text-calm-primary shrink-0" aria-hidden="true" />
        <div className="text-start">
          <span className="block text-xs text-calm-muted">{t('actualFocusTime')}</span>
          <span className="block text-base font-semibold text-calm-text">
            {formatElapsedFocusDuration(result.actualElapsedSeconds, locale)}
          </span>
        </div>
      </div>

      {/* Linked Task Note if present */}
      {result.taskTitle && (
        <div className="max-w-md mx-auto text-xs text-calm-muted border-t border-calm-border/60 pt-4">
          <span>{t('linkedTaskUntouchedNote', { title: result.taskTitle })}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onStartAnother}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-calm-primary text-white text-sm font-medium hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>{t('startNewSession')}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-calm-surface text-calm-muted hover:text-calm-text border border-calm-border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          <span>{t('returnToSetup')}</span>
        </button>
      </div>
    </div>
  );
};
