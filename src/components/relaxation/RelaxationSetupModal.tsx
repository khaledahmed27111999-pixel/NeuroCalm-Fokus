/**
 * NeuroCalm & Fokus — Relaxation Session Setup Modal
 * Phase 3C: Pre-session customization modal for duration, accompaniment audio,
 * and comfortable breathing pacing.
 */

import React, { useState } from 'react';
import {
  X,
  Play,
  Volume2,
  VolumeX,
  Wind,
  Music,
  Sliders,
} from 'lucide-react';
import {
  RelaxationSessionDefinition,
  SessionDurationMinutes,
} from '../../types/relaxationSession';
import { SoundscapeId } from '../../types/audio';
import { useLocale } from '../../context/LocaleContext';
import { getSoundNameKey } from '../audio/SoundCard';
import { useRelaxationSession } from '../../context/RelaxationSessionContext';

export interface RelaxationSetupModalProps {
  session: RelaxationSessionDefinition;
  onClose: () => void;
  onBegin: (
    session: RelaxationSessionDefinition,
    duration: SessionDurationMinutes,
    customVolumes: Partial<Record<SoundscapeId, number>>,
    options: {
      isUntimedAwareness?: boolean;
      tempoMultiplier?: number;
      isBreathingEnabled?: boolean;
      enabledTrackIds?: SoundscapeId[];
    }
  ) => void;
}

export const RelaxationSetupModal: React.FC<RelaxationSetupModalProps> = ({
  session,
  onClose,
  onBegin,
}) => {
  const { t } = useLocale();
  const { preferences } = useRelaxationSession();

  const [duration, setDuration] = useState<SessionDurationMinutes>(
    session.availableDurations.includes(preferences.preferredDuration)
      ? preferences.preferredDuration
      : session.defaultDuration
  );

  const [isUntimedAwareness, setIsUntimedAwareness] = useState<boolean>(
    session.breathingConfig?.defaultUntimed ?? true
  );

  const [tempoMultiplier, setTempoMultiplier] = useState<number>(
    session.breathingConfig?.tempoMultiplier ?? 1.0
  );

  const [isBreathingEnabled, setIsBreathingEnabled] = useState<boolean>(
    session.isBreathingSession
  );

  // Volume state for each track
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>(() => {
    const vols: Record<string, number> = {};
    for (const track of session.audioTracks) {
      vols[track.soundId] =
        preferences.customTrackVolumes[track.soundId] ?? track.defaultVolume;
    }
    return vols;
  });

  // Track enabled toggles (for optional tracks)
  const [enabledTracks, setEnabledTracks] = useState<Record<string, boolean>>(() => {
    const enabled: Record<string, boolean> = {};
    for (const track of session.audioTracks) {
      enabled[track.soundId] = true;
    }
    return enabled;
  });

  const handleVolumeChange = (soundId: SoundscapeId, val: number) => {
    setTrackVolumes((prev) => ({ ...prev, [soundId]: val }));
  };

  const handleToggleTrack = (soundId: SoundscapeId) => {
    setEnabledTracks((prev) => ({ ...prev, [soundId]: !prev[soundId] }));
  };

  const handleStart = () => {
    const enabledTrackIds = session.audioTracks
      .filter((track) => !track.isOptional || enabledTracks[track.soundId] !== false)
      .map((track) => track.soundId);

    const activeVolumes: Partial<Record<SoundscapeId, number>> = {};
    for (const track of session.audioTracks) {
      activeVolumes[track.soundId] = trackVolumes[track.soundId] ?? track.defaultVolume;
    }

    onBegin(session, duration, activeVolumes, {
      isUntimedAwareness,
      tempoMultiplier,
      isBreathingEnabled,
      enabledTrackIds,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-lg rounded-3xl bg-calm-card border border-calm-border/90 p-6 sm:p-7 shadow-2xl space-y-6 text-start max-h-[90vh] overflow-y-auto animate-scaleIn">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-calm-border/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {session.isBreathingSession ? (
                  <Wind className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Music className="w-4 h-4" aria-hidden="true" />
                )}
              </span>
              <h2 id="setup-modal-title" className="text-lg sm:text-xl font-bold text-calm-text">
                {t(session.nameKey as any)}
              </h2>
            </div>
            <p className="text-xs text-calm-muted">
              {t(session.subtitleKey as any)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="p-1.5 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* 1. Duration Presets (Strictly from availableDurations) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-calm-text block">
            {t('sessionDurationLabel')}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {session.availableDurations.map((d) => (
              <button
                key={String(d)}
                type="button"
                onClick={() => setDuration(d)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                  duration === d
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold shadow-sm'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                {d === 'open_ended'
                  ? t('sessionOpenEnded')
                  : t('breathingDurationMinutes', { count: d })}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Optional Breathing Toggle (for Evening Retreat) */}
        {session.breathingConfig?.isOptional && (
          <div className="p-3.5 rounded-2xl bg-calm-surface/80 border border-calm-border flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-calm-text block">
                {t('sessionOptionBreathing')}
              </span>
              <span className="text-[11px] text-calm-muted block mt-0.5">
                {t('sessionOptionBreathingHint')}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              dir="ltr"
              aria-checked={isBreathingEnabled}
              onClick={() => setIsBreathingEnabled(!isBreathingEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isBreathingEnabled ? 'bg-calm-primary' : 'bg-slate-700'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isBreathingEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* 3. Breathing Pacing Mode (If breathing is active) */}
        {isBreathingEnabled && session.breathingConfig && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-calm-surface/50 border border-calm-border/60">
            {/* Untimed vs Timed toggle (for Diaphragmatic) */}
            {session.breathingConfig.supportsUntimed && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-calm-text block">
                  {t('breathingSetupUntimed')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUntimedAwareness(true)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-colors ${
                      isUntimedAwareness
                        ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                        : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                    }`}
                  >
                    {t('breathingUntimedAwareness')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUntimedAwareness(false)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-colors ${
                      !isUntimedAwareness
                        ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                        : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                    }`}
                  >
                    {t('breathingUntimedTimed')}
                  </button>
                </div>
              </div>
            )}

            {/* Tempo adjustment (for Resonance Pacing) */}
            {session.breathingConfig.techniqueId === 'resonance_frequency' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-calm-text block">
                  {t('breathingSetupPacing')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTempoMultiplier(1.15)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                      tempoMultiplier === 1.15
                        ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                        : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                    }`}
                  >
                    {t('sessionTempoGentle')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempoMultiplier(1.0)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                      tempoMultiplier === 1.0
                        ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                        : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                    }`}
                  >
                    {t('sessionTempoBalanced')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempoMultiplier(0.9)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                      tempoMultiplier === 0.9
                        ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                        : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                    }`}
                  >
                    {t('sessionTempoQuicker')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Audio Accompaniment Track Faders */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-calm-text flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
            <span>{t('sessionDrawerAudioTitle')}</span>
          </label>

          <div className="space-y-2.5">
            {session.audioTracks.map((track) => {
              const isEnabled = enabledTracks[track.soundId] ?? true;
              const vol = trackVolumes[track.soundId] ?? track.defaultVolume;
              const percent = Math.round(vol * 100);

              return (
                <div
                  key={track.soundId}
                  className={`p-3 rounded-xl border transition-colors ${
                    isEnabled
                      ? 'bg-calm-surface border-calm-border'
                      : 'bg-calm-surface/40 border-calm-border/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {track.isOptional && (
                        <input
                          type="checkbox"
                          id={`toggle-${track.soundId}`}
                          checked={isEnabled}
                          onChange={() => handleToggleTrack(track.soundId)}
                          className="w-4 h-4 rounded border-calm-border text-calm-primary focus:ring-calm-primary"
                        />
                      )}
                      <label
                        htmlFor={`toggle-${track.soundId}`}
                        className="text-xs font-semibold text-calm-text cursor-pointer"
                      >
                        {t(getSoundNameKey(track.soundId) as any)}
                      </label>
                    </div>

                    <span className="font-mono text-xs text-calm-muted font-medium">
                      {isEnabled ? `${percent}%` : t('breathingSoundNone')}
                    </span>
                  </div>

                  {isEnabled && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleVolumeChange(track.soundId, vol > 0 ? 0 : track.defaultVolume)}
                        aria-label={t(getSoundNameKey(track.soundId) as any)}
                        className="p-1 rounded text-calm-muted hover:text-calm-text"
                      >
                        {vol === 0 ? (
                          <VolumeX className="w-4 h-4 text-red-400" aria-hidden="true" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-calm-primary" aria-hidden="true" />
                        )}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={percent}
                        onChange={(e) =>
                          handleVolumeChange(track.soundId, Number(e.target.value) / 100)
                        }
                        aria-label={t(getSoundNameKey(track.soundId) as any)}
                        className="w-full h-1.5 bg-calm-border rounded-lg appearance-none cursor-pointer accent-calm-primary"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Action */}
        <div className="pt-2 border-t border-calm-border/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-medium text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="py-2.5 px-5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 bg-calm-primary text-slate-900 hover:bg-emerald-400 shadow-sm transition-colors"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>{t('sessionBeginButton')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
