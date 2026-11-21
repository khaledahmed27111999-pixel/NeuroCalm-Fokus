import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLocale } from '../../context/LocaleContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();

  return (
    <button
      id="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={t('themeToggleAria')}
      title={theme === 'dark' ? t('themeLight') : t('themeDark')}
      className="p-2 rounded-lg bg-calm-surface text-calm-muted hover:text-calm-text border border-calm-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-500" aria-hidden="true" />
      )}
    </button>
  );
};
