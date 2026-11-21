import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { useWisdom } from '../../hooks/useWisdom';
import { useLocale } from '../../context/LocaleContext';
import { WisdomCategory } from '../../types/wisdom';

export const WisdomToast: React.FC = () => {
  const { activeToast, dismissToast } = useWisdom();
  const { locale, t } = useLocale();

  const isVisible = !!activeToast;

  const categoryLabels: Record<WisdomCategory, string> = {
    perseverance: t('wisdomCategoryPerseverance'),
    starting: t('wisdomCategoryStarting'),
    recovery: t('wisdomCategoryRecovery'),
    rest: t('wisdomCategoryRest'),
    patience: t('wisdomCategoryPatience'),
    small_steps: t('wisdomCategorySmallSteps'),
  };

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed bottom-20 sm:bottom-6 inset-x-4 sm:inset-x-auto sm:end-6 z-50 pointer-events-none flex flex-col items-center sm:items-end"
    >
      <div
        className={`pointer-events-auto max-w-md w-full bg-calm-card/95 backdrop-blur-md border border-calm-border/90 text-calm-text shadow-xl rounded-2xl p-4 transition-all duration-300 transform motion-reduce:transition-none motion-reduce:transform-none ${
          isVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
        }`}
      >
        {activeToast && (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-calm-primary border border-emerald-500/20 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-calm-primary uppercase tracking-wider">
                  {categoryLabels[activeToast.category]}
                </span>
                <button
                  type="button"
                  onClick={dismissToast}
                  aria-label={t('wisdomToastDismiss')}
                  title={t('wisdomToastDismiss')}
                  className="p-1 rounded-md text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <p className="text-sm font-medium text-calm-text leading-relaxed">
                {activeToast.text[locale]}
              </p>

              {activeToast.author && (
                <span className="text-xs text-calm-muted block pt-0.5">
                  — {activeToast.author[locale]}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
