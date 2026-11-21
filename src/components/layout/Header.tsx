import React from 'react';
import { Compass, Volume2 } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useAudio } from '../../hooks/useAudio';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';

export const Header: React.FC = () => {
  const { t } = useLocale();
  const { state } = useAudio();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-calm-border bg-calm-card/90 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-calm-primary/10 text-calm-primary flex items-center justify-center border border-calm-primary/20">
            <Compass className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col text-start">
            <span className="font-semibold text-base sm:text-lg tracking-tight text-calm-text leading-tight">
              {t('appName')}
            </span>
            <span className="text-xs text-calm-muted hidden sm:inline leading-tight">
              {t('appTagline')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {state.activeCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-calm-primary/10 text-calm-primary text-xs font-medium border border-calm-primary/20"
              title={t('mixerNowPlaying')}
            >
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline font-mono">{state.activeCount}/4</span>
              <span className="w-1.5 h-1.5 rounded-full bg-calm-primary animate-pulse" />
            </div>
          )}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
