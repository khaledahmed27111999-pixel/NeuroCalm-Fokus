/**
 * NeuroCalm & Fokus — Breathing Session Completion Modal
 * Phase 3A: Warm, guilt-free post-session acknowledgment.
 * Zero streaks, zero scores, zero performance tracking.
 */

import React from 'react';
import { Heart, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';

export interface BreathingCompletionModalProps {
  onDismiss: () => void;
}

export const BreathingCompletionModal: React.FC<BreathingCompletionModalProps> = ({
  onDismiss,
}) => {
  const { t, direction } = useLocale();
  const ArrowIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-calm-card border border-calm-border shadow-2xl p-7 text-center space-y-6">
        {/* Calm Heart Icon */}
        <div className="w-16 h-16 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 mx-auto flex items-center justify-center">
          <Heart className="w-8 h-8 fill-current" aria-hidden="true" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 id="completion-title" className="text-xl sm:text-2xl font-bold text-calm-text">
            {t('breathingCompleteTitle')}
          </h2>
          <p className="text-sm text-calm-muted leading-relaxed max-w-xs mx-auto">
            {t('breathingCompleteMessage')}
          </p>
        </div>

        {/* Action */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3 px-5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 bg-calm-primary text-slate-900 hover:bg-emerald-400 shadow-md transition-colors"
          >
            <span>{t('breathingCompleteReturn')}</span>
            <ArrowIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
