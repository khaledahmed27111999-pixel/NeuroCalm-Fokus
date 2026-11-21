/**
 * NeuroCalm & Fokus — Relaxation Sessions Library
 * Phase 3C: Main browser for the curated relaxation session collection
 * with family filtering and pre-session setup modals.
 */

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useRelaxationSession } from '../../context/RelaxationSessionContext';
import { getSessionsByFamily } from '../../data/relaxationSessions';
import { RelaxationSessionCard } from './RelaxationSessionCard';
import { RelaxationSetupModal } from './RelaxationSetupModal';
import { AudioConflictModal } from './AudioConflictModal';
import { BreathingCompletionModal } from '../breathing/BreathingCompletionModal';

export const RelaxationLibrary: React.FC = () => {
  const { t } = useLocale();
  const {
    setupSession,
    startSetup,
    closeSetup,
    beginSession,
    conflictState,
    liveState,
    dismissCompletion,
  } = useRelaxationSession();

  const [selectedFamily, setSelectedFamily] = useState<string>('all');

  const filteredSessions = getSessionsByFamily(selectedFamily);

  const familyFilters: Array<{ id: string; labelKey: string }> = [
    { id: 'all', labelKey: 'sessionFamilyAll' },
    { id: 'combined_soundscape', labelKey: 'sessionFamilyCombined' },
    { id: 'chinese_instrumental', labelKey: 'sessionFamilyInstrumental' },
    { id: 'nature_based', labelKey: 'sessionFamilyNature' },
    { id: 'music_only', labelKey: 'sessionFamilyMusicOnly' },
  ];

  return (
    <div className="space-y-6 text-start">
      {/* Pillar Introduction Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('recoverSessionsTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('recoverSessionsSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Family Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {familyFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedFamily(f.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
              selectedFamily === f.id
                ? 'bg-calm-primary text-slate-900 border-calm-primary shadow-sm'
                : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
            }`}
          >
            {t(f.labelKey as any)}
          </button>
        ))}
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSessions.map((session) => (
          <RelaxationSessionCard
            key={session.id}
            session={session}
            onStart={startSetup}
          />
        ))}
      </div>

      {/* Setup Modal */}
      {setupSession && (
        <RelaxationSetupModal
          session={setupSession}
          onClose={closeSetup}
          onBegin={(session, duration, customVolumes, options) => {
            closeSetup();
            void beginSession(session, duration, customVolumes, options);
          }}
        />
      )}

      {/* Conflict Modal */}
      {conflictState && <AudioConflictModal />}

      {/* Completion Modal */}
      {liveState.status === 'completed' && (
        <BreathingCompletionModal onDismiss={dismissCompletion} />
      )}
    </div>
  );
};
