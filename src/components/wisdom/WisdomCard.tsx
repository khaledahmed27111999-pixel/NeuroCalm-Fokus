import React from 'react';
import { Sparkles, Quote } from 'lucide-react';
import { useWisdom } from '../../hooks/useWisdom';
import { useLocale } from '../../context/LocaleContext';
import { WisdomCategory } from '../../types/wisdom';

export const WisdomCard: React.FC = () => {
  const { currentWisdom } = useWisdom();
  const { locale, t } = useLocale();

  const categoryLabels: Record<WisdomCategory, string> = {
    perseverance: t('wisdomCategoryPerseverance'),
    starting: t('wisdomCategoryStarting'),
    recovery: t('wisdomCategoryRecovery'),
    rest: t('wisdomCategoryRest'),
    patience: t('wisdomCategoryPatience'),
    small_steps: t('wisdomCategorySmallSteps'),
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-calm-text flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-calm-primary" aria-hidden="true" />
          {t('wisdomCardTitle')}
        </h3>
        <span className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-500/10 text-calm-primary border border-emerald-500/20 font-medium">
          {categoryLabels[currentWisdom.category]}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-calm-surface border border-calm-border/60 relative">
        <Quote className="w-4 h-4 text-calm-muted/40 mb-1.5" aria-hidden="true" />
        <p className="text-sm sm:text-base font-medium text-calm-text leading-relaxed">
          {currentWisdom.text[locale]}
        </p>
        {currentWisdom.author && (
          <p className="text-xs text-calm-muted mt-2 font-normal">
            — {currentWisdom.author[locale]}
          </p>
        )}
      </div>
    </div>
  );
};
