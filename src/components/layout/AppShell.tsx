import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { PillarTab } from '../../types/navigation';
import { useLocale } from '../../context/LocaleContext';

interface AppShellProps {
  activeTab: PillarTab;
  onTabChange: (tab: PillarTab) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex flex-col bg-calm-bg text-calm-text">
      {/* Top Header */}
      <Header />

      {/* Navigation (Desktop Sub-Header + Mobile Bottom Bar) */}
      <Navigation activeTab={activeTab} onTabChange={onTabChange} />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-10">
        {children}
      </main>

      {/* Gentle Offline-First Privacy Footer */}
      <footer className="w-full border-t border-calm-border bg-calm-card/40 py-4 px-4 text-center text-xs text-calm-muted hidden md:block">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-calm-primary" aria-hidden="true" />
          <span>{t('localPrivacyNotice')}</span>
        </div>
      </footer>
    </div>
  );
};
