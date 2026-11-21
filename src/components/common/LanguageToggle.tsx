import React from 'react';
import { Languages } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';

export const LanguageToggle: React.FC = () => {
  const { locale, toggleLocale, t } = useLocale();

  return (
    <button
      id="language-toggle"
      type="button"
      onClick={toggleLocale}
      aria-label={t('langSwitchAria')}
      title={t('langSwitchAria')}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-calm-surface text-calm-muted hover:text-calm-text border border-calm-border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
    >
      <Languages className="w-4 h-4 text-calm-secondary" aria-hidden="true" />
      <span className="font-semibold">{locale === 'en' ? 'العربية' : 'English'}</span>
    </button>
  );
};
