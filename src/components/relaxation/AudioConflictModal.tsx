/**
 * NeuroCalm & Fokus — Audio Conflict Modal
 * Phase 3C: Explicit 3-choice modal when a session conflicts with existing mixer tracks.
 * Guarantees zero silent stopping or modification of user tracks.
 */

import React from 'react';
import { AlertCircle, Square, Volume2, ShieldAlert } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useRelaxationSession } from '../../context/RelaxationSessionContext';
import { getSoundNameKey } from '../audio/SoundCard';

export const AudioConflictModal: React.FC = () => {
  const { t } = useLocale();
  const { conflictState, resolveConflictAndBegin } = useRelaxationSession();

  if (!conflictState) return null;

  const {
    activeMixerTrackIds,
    requestedTrackIds,
    canKeepPlayingAlongside,
    disableReasonKey,
    duplicateTrackIds,
  } = conflictState;

  const duplicateSoundName = duplicateTrackIds[0]
    ? t(getSoundNameKey(duplicateTrackIds[0]) as any)
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-md rounded-2xl bg-calm-card border border-calm-border/90 p-6 shadow-2xl space-y-5 text-start animate-scaleIn">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 id="conflict-dialog-title" className="text-base font-bold text-calm-text">
              {t('sessionConflictTitle')}
            </h3>
            <p className="text-xs text-calm-muted leading-relaxed">
              {t('sessionConflictMessage')}
            </p>
          </div>
        </div>

        {/* Active sounds vs requested sounds summary */}
        <div className="p-3.5 rounded-xl bg-calm-surface border border-calm-border/60 space-y-2 text-xs">
          <div className="flex items-center justify-between text-calm-muted">
            <span>{t('mixerActiveTracksTitle')}:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeMixerTrackIds.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded-md bg-calm-card border border-calm-border text-teal-400 text-[11px] font-medium"
                >
                  {t(getSoundNameKey(id) as any)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-calm-muted">
            <span>{t('sessionDrawerAudioTitle')}:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {requestedTrackIds.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded-md bg-calm-card border border-calm-border text-calm-primary text-[11px] font-medium"
                >
                  {t(getSoundNameKey(id) as any)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Disabled Warning Reason (if cannot keep alongside) */}
        {!canKeepPlayingAlongside && disableReasonKey && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              {disableReasonKey === 'sessionConflictDuplicateWarning'
                ? t('sessionConflictDuplicateWarning', { sound: duplicateSoundName })
                : t('sessionConflictCapacityWarning')}
            </p>
          </div>
        )}

        {/* 3 Explicit Choices */}
        <div className="space-y-2.5 pt-1">
          {/* Choice 1: Stop Existing Sounds and Begin Session */}
          <button
            type="button"
            id="conflict-choice-stop-existing"
            onClick={() => void resolveConflictAndBegin('stop_existing')}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 bg-calm-primary text-slate-900 hover:bg-emerald-400 transition-colors shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>{t('sessionConflictStop')}</span>
          </button>

          {/* Choice 2: Keep Existing Sounds Playing Alongside Session */}
          <button
            type="button"
            id="conflict-choice-keep-alongside"
            disabled={!canKeepPlayingAlongside}
            onClick={() => void resolveConflictAndBegin('keep_alongside')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 border transition-colors ${
              canKeepPlayingAlongside
                ? 'bg-calm-surface hover:bg-calm-surface/80 text-calm-text border-calm-border'
                : 'bg-calm-surface/40 text-calm-muted/50 border-calm-border/30 cursor-not-allowed'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('sessionConflictKeep')}</span>
          </button>

          {/* Choice 3: Cancel */}
          <button
            type="button"
            id="conflict-choice-cancel"
            onClick={() => void resolveConflictAndBegin('cancel')}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-calm-muted hover:text-calm-text hover:bg-calm-surface/50 transition-colors"
          >
            {t('sessionConflictCancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
