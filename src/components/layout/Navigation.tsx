import React from 'react';
import { CalendarCheck2, Target, Wind, Moon } from 'lucide-react';
import { PillarTab } from '../../types/navigation';
import { useLocale } from '../../context/LocaleContext';
import { useFocus } from '../../hooks/useFocus';
import { useSleep } from '../../hooks/useSleep';
import { formatTimeDisplay } from '../../utils/focusTimer';

interface NavigationProps {
  activeTab: PillarTab;
  onTabChange: (tab: PillarTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { t } = useLocale();
  const { session, remainingSeconds } = useFocus();
  const { activeSession } = useSleep();

  const tabs: { id: PillarTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'plan',
      label: t('navPlan'),
      icon: CalendarCheck2,
    },
    {
      id: 'focus',
      label: t('navFocus'),
      icon: Target,
    },
    {
      id: 'recover',
      label: t('navRecover'),
      icon: Wind,
    },
    {
      id: 'sleep',
      label: t('navSleep'),
      icon: Moon,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Sub-Header Tab Bar */}
      <nav
        aria-label="Main Navigation"
        className="hidden md:flex justify-center border-b border-calm-border bg-calm-card/50 py-2.5 px-4"
      >
        <div role="tablist" className="flex items-center gap-1.5 p-1 rounded-xl bg-calm-surface border border-calm-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isFocusActive = tab.id === 'focus' && (session.status === 'running' || session.status === 'paused');
            const isBreak = session.mode === 'pomodoro' && session.pomodoro !== undefined && session.pomodoro.intervalType !== 'work';
            const isSleepActive = tab.id === 'sleep' && activeSession !== null;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                  isActive
                    ? 'bg-calm-primary text-white shadow-sm'
                    : 'text-calm-muted hover:text-calm-text hover:bg-calm-card/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-calm-muted'}`} />
                <span>{tab.label}</span>

                {/* Subtle indicator when a sleep session is active */}
                {isSleepActive && (
                  <span
                    className={`ms-1.5 px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${
                      isActive
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span>{t('sleepStatusTracking')}</span>
                  </span>
                )}

                {/* Subtle indicator when a focus session is active */}
                {isFocusActive && session.status === 'running' && (
                  <span
                    className={`ms-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${
                      isActive
                        ? 'bg-white/20 text-white border-white/30'
                        : isBreak
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-emerald-500/15 text-calm-primary border-emerald-500/30'
                    }`}
                  >
                    {formatTimeDisplay(remainingSeconds)}
                  </span>
                )}
                {isFocusActive && session.status === 'paused' && (
                  <span
                    className={`ms-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      isActive
                        ? 'bg-white/20 text-white border-white/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {t('pausedStatus')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Fixed Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-calm-border bg-calm-card/95 backdrop-blur-lg px-2 py-1.5"
      >
        <div role="tablist" className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isFocusActive = tab.id === 'focus' && (session.status === 'running' || session.status === 'paused');
            const isBreak = session.mode === 'pomodoro' && session.pomodoro !== undefined && session.pomodoro.intervalType !== 'work';
            const isSleepActive = tab.id === 'sleep' && activeSession !== null;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`mobile-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                  isActive
                    ? 'text-calm-primary font-semibold'
                    : 'text-calm-muted hover:text-calm-text'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-calm-primary stroke-[2.25]' : 'text-calm-muted'}`} />
                  {isSleepActive && (
                    <span className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                  {isFocusActive && session.status === 'running' && (
                    <span className={`absolute -top-1 -end-1 w-2 h-2 rounded-full animate-pulse ${
                      isBreak ? 'bg-cyan-400' : 'bg-emerald-400'
                    }`} />
                  )}
                  {isFocusActive && session.status === 'paused' && (
                    <span className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                <span className="flex items-center gap-1">
                  <span>{tab.label}</span>
                  {isFocusActive && (
                    <span className="font-mono text-[10px] opacity-90">
                      ({session.status === 'paused' ? t('pausedStatus') : formatTimeDisplay(remainingSeconds)})
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
