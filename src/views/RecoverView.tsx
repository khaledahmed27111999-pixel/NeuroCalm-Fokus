/**
 * NeuroCalm & Fokus — Recover View (Pillar 3)
 * Phase 3C: Three-tab Recover architecture with Integrated Relaxation Sessions
 * as the primary wellness pillar, alongside Breathing Exercises and Soundscape Mixer.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Wind, Headphones, Heart, Sparkles, Square } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useBreathing } from '../context/BreathingContext';
import { useRelaxationSession } from '../context/RelaxationSessionContext';
import { RelaxationLibrary } from '../components/relaxation/RelaxationLibrary';
import { IntegratedBreathingPlayer } from '../components/relaxation/IntegratedBreathingPlayer';
import { MusicOnlyPlayer } from '../components/relaxation/MusicOnlyPlayer';
import { BreathingLibrary } from '../components/breathing/BreathingLibrary';
import { BreathingPlayer } from '../components/breathing/BreathingPlayer';
import { BreathingSetupModal } from '../components/breathing/BreathingSetupModal';
import { BreathingCompletionModal } from '../components/breathing/BreathingCompletionModal';
import { SoundscapeMixer } from '../components/audio/SoundscapeMixer';
import { formatBreathingTime } from '../utils/breathingTimer';

export type RecoverSubTab = 'sessions' | 'breathing' | 'soundscapes';

export const RecoverView: React.FC = () => {
  const { t } = useLocale();
  const [activeSubTab, setActiveSubTab] = useState<RecoverSubTab>('sessions');

  const {
    activeTechnique: activeBreathingTechnique,
    setupTechnique,
    liveState: breathingLiveState,
    closeSetup: closeBreathingSetup,
    beginSession: beginBreathingSession,
    stopSession: stopBreathingSession,
    dismissCompletion: dismissBreathingCompletion,
  } = useBreathing();

  const {
    liveState: relaxationLiveState,
    handleRecoverViewUnmount,
  } = useRelaxationSession();

  // Keep refs up-to-date with the latest callback identities without stale closures
  const stopBreathingSessionRef = useRef(stopBreathingSession);
  const handleRecoverViewUnmountRef = useRef(handleRecoverViewUnmount);

  useEffect(() => {
    stopBreathingSessionRef.current = stopBreathingSession;
    handleRecoverViewUnmountRef.current = handleRecoverViewUnmount;
  });

  // Genuine unmount lifecycle defense: invoked ONLY when RecoverView genuinely unmounts
  useEffect(() => {
    return () => {
      stopBreathingSessionRef.current();
      handleRecoverViewUnmountRef.current();
    };
  }, []);

  const isBreathingActive =
    breathingLiveState.status === 'running' ||
    breathingLiveState.status === 'paused' ||
    breathingLiveState.status === 'settling';

  const isRelaxationActive =
    relaxationLiveState.status === 'running' ||
    relaxationLiveState.status === 'paused' ||
    relaxationLiveState.status === 'settling';

  return (
    <div
      role="tabpanel"
      id="panel-recover"
      aria-labelledby="tab-recover"
      className="space-y-6"
    >
      {/* Pillar Introduction Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm text-start">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
            <Heart className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('recoverTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('recoverDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Philosophy Callout */}
      <div className="p-4 sm:p-5 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3.5 text-start">
        <Heart className="w-5 h-5 text-teal-400 shrink-0" aria-hidden="true" />
        <p className="text-sm text-calm-text font-medium">
          {t('actionRecoverMessage')}
        </p>
      </div>

      {/* Recover Sub-Navigation Tabs */}
      <div
        role="tablist"
        aria-label={t('recoverTitle')}
        className="flex items-center gap-2 p-1.5 rounded-2xl bg-calm-card border border-calm-border text-start"
      >
        <button
          type="button"
          role="tab"
          id="subtab-sessions"
          aria-selected={activeSubTab === 'sessions'}
          aria-controls="subpanel-sessions"
          onClick={() => setActiveSubTab('sessions')}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
            activeSubTab === 'sessions'
              ? 'bg-calm-primary text-slate-900 shadow-sm'
              : 'text-calm-muted hover:text-calm-text hover:bg-calm-surface'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('recoverTabSessions')}</span>
        </button>

        <button
          type="button"
          role="tab"
          id="subtab-breathing"
          aria-selected={activeSubTab === 'breathing'}
          aria-controls="subpanel-breathing"
          onClick={() => setActiveSubTab('breathing')}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
            activeSubTab === 'breathing'
              ? 'bg-calm-primary text-slate-900 shadow-sm'
              : 'text-calm-muted hover:text-calm-text hover:bg-calm-surface'
          }`}
        >
          <Wind className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('breathingTabExercises')}</span>
          {isBreathingActive && (
            <span
              className="relative flex h-2 w-2 shrink-0 ms-0.5"
              title={t('recoverActiveBreathingBadge')}
              aria-label={t('recoverActiveBreathingBadge')}
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="subtab-soundscapes"
          aria-selected={activeSubTab === 'soundscapes'}
          aria-controls="subpanel-soundscapes"
          onClick={() => setActiveSubTab('soundscapes')}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
            activeSubTab === 'soundscapes'
              ? 'bg-calm-primary text-slate-900 shadow-sm'
              : 'text-calm-muted hover:text-calm-text hover:bg-calm-surface'
          }`}
        >
          <Headphones className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('breathingTabSoundscapes')}</span>
        </button>
      </div>

      {/* Persistent Active Breathing Session Indicator across Recover Subtabs */}
      {isBreathingActive && activeSubTab !== 'breathing' && (
        <div
          id="active-breathing-banner"
          className="p-3 sm:p-3.5 rounded-2xl bg-calm-card border border-teal-500/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start animate-fadeIn"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-calm-text truncate">
                {t('recoverActiveBreathingBanner', {
                  technique: activeBreathingTechnique ? t(activeBreathingTechnique.nameKey as any) : '',
                })}
              </p>
              <p className="text-[11px] text-calm-muted">
                {breathingLiveState.status === 'paused'
                  ? t('breathingPause')
                  : `${formatBreathingTime(breathingLiveState.remainingSeconds)} • ${
                      breathingLiveState.config.isUntimedAwareness
                        ? t('breathingUntimedNaturalLabel')
                        : t(breathingLiveState.currentPhase.labelKey as any)
                    }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Immediate Stop Breathing Action */}
            <button
              type="button"
              onClick={stopBreathingSession}
              className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{t('recoverStopBreathing')}</span>
            </button>

            {/* Return to Active Breathing Canvas */}
            <button
              type="button"
              onClick={() => setActiveSubTab('breathing')}
              className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold bg-calm-primary text-slate-900 hover:bg-emerald-400 transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              <span>{t('recoverReturnToBreathing')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sub-Panel 1: Curated Integrated Sessions (Default) */}
      {activeSubTab === 'sessions' && (
        <div id="subpanel-sessions" role="tabpanel" aria-labelledby="subtab-sessions">
          {isRelaxationActive ? (
            relaxationLiveState.definition?.familyId === 'music_only' ||
            !relaxationLiveState.definition?.isBreathingSession ||
            !relaxationLiveState.isBreathingEnabled ? (
              <MusicOnlyPlayer />
            ) : (
              <IntegratedBreathingPlayer />
            )
          ) : (
            <RelaxationLibrary />
          )}
        </div>
      )}

      {/* Sub-Panel 2: Breathing Exercises */}
      {activeSubTab === 'breathing' && (
        <div id="subpanel-breathing" role="tabpanel" aria-labelledby="subtab-breathing">
          {isBreathingActive ? (
            <BreathingPlayer />
          ) : (
            <BreathingLibrary
              onNavigateToSoundscapes={() => setActiveSubTab('soundscapes')}
            />
          )}

          {/* Setup Modal */}
          {setupTechnique && (
            <BreathingSetupModal
              technique={setupTechnique}
              onClose={closeBreathingSetup}
              onBegin={beginBreathingSession}
            />
          )}

          {/* Completion Modal */}
          {breathingLiveState.status === 'completed' && (
            <BreathingCompletionModal onDismiss={dismissBreathingCompletion} />
          )}
        </div>
      )}

      {/* Sub-Panel 3: Soundscape Mixer */}
      {activeSubTab === 'soundscapes' && (
        <div id="subpanel-soundscapes" role="tabpanel" aria-labelledby="subtab-soundscapes">
          <SoundscapeMixer />
        </div>
      )}
    </div>
  );
};
