import React, { useState } from 'react';
import { Compass, Volume2, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useAudio } from '../../hooks/useAudio';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';
import { ThemeToggle } from '../common/ThemeToggle';
import { LanguageToggle } from '../common/LanguageToggle';
import { AuthModal } from '../auth/AuthModal';

export const Header: React.FC = () => {
  const { t } = useLocale();
  const { state: audioState } = useAudio();
  const { isAuthenticated, user } = useAuth();
  const { isSyncing, pendingOutboxCount } = useSync();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
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
            {audioState.activeCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-calm-primary/10 text-calm-primary text-xs font-medium border border-calm-primary/20"
                title={t('mixerNowPlaying')}
              >
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline font-mono">{audioState.activeCount}/4</span>
                <span className="w-1.5 h-1.5 rounded-full bg-calm-primary animate-pulse" />
              </div>
            )}

            {/* Cloud Sync & Account Button */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                isAuthenticated
                  ? 'bg-calm-primary/10 text-calm-primary border-calm-primary/30 hover:bg-calm-primary/20'
                  : 'bg-calm-surface text-calm-muted border-calm-border hover:text-calm-text hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
              title={isAuthenticated ? user?.email || t('authAccountTitle') : t('syncStatusOffline')}
              aria-label={t('syncStatusButtonTitle')}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isAuthenticated ? (
                <Cloud className="w-3.5 h-3.5 text-calm-primary" />
              ) : (
                <CloudOff className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline max-w-[120px] truncate">
                {isAuthenticated ? user?.email?.split('@')[0] : t('authTabSignIn')}
              </span>

              {pendingOutboxCount > 0 && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -end-0.5 animate-pulse"
                  title={`${pendingOutboxCount} pending`}
                />
              )}
            </button>

            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};
