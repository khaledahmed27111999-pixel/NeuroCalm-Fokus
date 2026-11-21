/**
 * NeuroCalm & Fokus — Breathing Session Setup Modal
 * Phase 3A / Phase 3C-UI-3: Pre-session customization modal supporting finite durations,
 * unforced pacing, genuine hold-removal, optional sound pairing, and procedural audio cue customization.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Music,
} from 'lucide-react';
import {
  BreathingTechnique,
  BreathingSessionConfig,
  RetentionMode,
  BreathingCueProfile,
  BreathingOptionalCueProfile,
  DEFAULT_BREATHING_CUE_PREFERENCES,
} from '../../types/breathing';
import { useLocale } from '../../context/LocaleContext';
import { useBreathing } from '../../context/BreathingContext';
import { SoundscapeId } from '../../types/audio';
import {
  previewCue,
  stopPreview,
  CuePhaseType,
} from '../../utils/breathingAudioCue';

export interface BreathingSetupModalProps {
  technique: BreathingTechnique;
  onClose: () => void;
  onBegin: (config: BreathingSessionConfig) => void;
  defaultDurationMinutes?: 2 | 3 | 5 | 10;
  defaultSoundscapeId?: SoundscapeId | 'silent';
  defaultAudioCueEnabled?: boolean;
}

interface SoundscapeOption {
  id: SoundscapeId | 'silent';
  nameKey: string;
  isInstrumental?: boolean;
}

const AVAILABLE_SOUNDSCAPES: SoundscapeOption[] = [
  { id: 'silent', nameKey: 'breathingSoundNone' },
  // Nature & Environment
  { id: 'rain', nameKey: 'soundRain' },
  { id: 'stream', nameKey: 'soundStream' },
  { id: 'ocean_waves', nameKey: 'soundOceanWaves' },
  { id: 'fireplace', nameKey: 'soundFireplace' },
  { id: 'fan', nameKey: 'soundFan' },
  // Chinese Traditional Instruments
  { id: 'xiao', nameKey: 'soundXiao', isInstrumental: true },
  { id: 'dizi', nameKey: 'soundDizi', isInstrumental: true },
  { id: 'guqin', nameKey: 'soundGuqin', isInstrumental: true },
  { id: 'guzheng', nameKey: 'soundGuzheng', isInstrumental: true },
];

const PROFILE_OPTIONS: Array<{ id: BreathingCueProfile; labelKey: string }> = [
  { id: 'chime', labelKey: 'breathingCueProfileChime' },
  { id: 'resonant', labelKey: 'breathingCueProfileResonant' },
  { id: 'bell', labelKey: 'breathingCueProfileBell' },
  { id: 'wood', labelKey: 'breathingCueProfileWood' },
];

const OPTIONAL_PROFILE_OPTIONS: Array<{ id: BreathingOptionalCueProfile; labelKey: string }> = [
  { id: 'chime', labelKey: 'breathingCueProfileChime' },
  { id: 'resonant', labelKey: 'breathingCueProfileResonant' },
  { id: 'bell', labelKey: 'breathingCueProfileBell' },
  { id: 'wood', labelKey: 'breathingCueProfileWood' },
  { id: 'none', labelKey: 'breathingCueProfileNone' },
];

export const BreathingSetupModal: React.FC<BreathingSetupModalProps> = ({
  technique,
  onClose,
  onBegin,
  defaultDurationMinutes = 3,
  defaultSoundscapeId = 'silent',
  defaultAudioCueEnabled = false,
}) => {
  const { t } = useLocale();
  const { preferences } = useBreathing();

  const [durationMinutes, setDurationMinutes] = useState<2 | 3 | 5 | 10>(
    defaultDurationMinutes
  );
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);
  const [retentionMode, setRetentionMode] = useState<RetentionMode>('standard');
  const [isUntimedAwareness, setIsUntimedAwareness] = useState<boolean>(
    Boolean(technique.isUntimedAwarenessSupported)
  );
  const [soundscapeId, setSoundscapeId] = useState<SoundscapeId | 'silent'>(defaultSoundscapeId);

  // Audio Cue state initialized with saved preferences or safe defaults
  const [audioCueEnabled, setAudioCueEnabled] = useState<boolean>(
    preferences?.audioCueEnabled ?? defaultAudioCueEnabled
  );
  const [cueVolume, setCueVolume] = useState<number>(
    preferences?.cuePreferences?.volume ?? DEFAULT_BREATHING_CUE_PREFERENCES.volume
  );
  const [inhaleProfile, setInhaleProfile] = useState<BreathingCueProfile>(
    preferences?.cuePreferences?.inhaleProfile ?? DEFAULT_BREATHING_CUE_PREFERENCES.inhaleProfile
  );
  const [exhaleProfile, setExhaleProfile] = useState<BreathingCueProfile>(
    preferences?.cuePreferences?.exhaleProfile ?? DEFAULT_BREATHING_CUE_PREFERENCES.exhaleProfile
  );
  const [holdProfile, setHoldProfile] = useState<BreathingOptionalCueProfile>(
    preferences?.cuePreferences?.holdProfile ?? DEFAULT_BREATHING_CUE_PREFERENCES.holdProfile
  );
  const [completionProfile, setCompletionProfile] = useState<BreathingOptionalCueProfile>(
    preferences?.cuePreferences?.completionProfile ?? DEFAULT_BREATHING_CUE_PREFERENCES.completionProfile
  );

  // Stop any active preview sound on unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  const handleClose = () => {
    stopPreview();
    onClose();
  };

  const handlePreview = (phase: CuePhaseType, profile: BreathingOptionalCueProfile) => {
    if (profile === 'none') return;
    previewCue(phase, profile, cueVolume);
  };

  // Determine whether hold phases actually exist in the current configuration
  const hasActiveHolds =
    technique.hasBreathRetention &&
    retentionMode !== 'hold_free' &&
    !isUntimedAwareness;

  const handleStart = () => {
    stopPreview();
    onBegin({
      techniqueId: technique.id,
      durationMinutes,
      tempoMultiplier,
      retentionMode,
      isUntimedAwareness,
      soundscapeId,
      instrumentalId: 'none',
      audioCueEnabled,
      cuePreferences: {
        volume: cueVolume,
        inhaleProfile,
        exhaleProfile,
        holdProfile: hasActiveHolds ? holdProfile : 'none',
        completionProfile,
      },
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-calm-card border border-calm-border shadow-2xl p-6 sm:p-7 text-start space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-calm-border/60">
          <div>
            <h2 id="setup-modal-title" className="text-lg sm:text-xl font-bold text-calm-text">
              {t(technique.nameKey as any)}
            </h2>
            <p className="text-xs text-calm-muted mt-0.5">
              {t(technique.subtitleKey as any)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('cancel')}
            className="p-1.5 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* 1. Finite Duration Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-calm-text block">
            {t('breathingSetupDuration')}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([2, 3, 5, 10] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDurationMinutes(mins)}
                className={`min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-medium border transition-colors inline-flex items-center justify-center ${
                  durationMinutes === mins
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                {t('breathingDurationMinutes', { count: mins })}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Natural Self-Paced Diaphragmatic Option */}
        {technique.isUntimedAwarenessSupported && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-calm-text block">
              {t('breathingSetupUntimed')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsUntimedAwareness(true)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-start transition-colors ${
                  isUntimedAwareness
                    ? 'bg-teal-500/15 text-teal-400 border-teal-500/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                <div className="font-semibold">{t('breathingUntimedAwareness')}</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">
                  {t('breathingUntimedAwarenessDefault')}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsUntimedAwareness(false)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-start transition-colors ${
                  !isUntimedAwareness
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                <div className="font-semibold">{t('breathingUntimedTimed')}</div>
                <div className="text-[11px] opacity-80 mt-0.5 font-normal">
                  {t('breathingUntimedAwarenessHint')}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* 3. Breath Retention Toggle */}
        {!isUntimedAwareness && technique.canDisableRetention && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-calm-text block">
              {t('breathingSetupRetention')}
            </label>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setRetentionMode('standard')}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium border text-start flex items-center justify-between transition-colors ${
                  retentionMode === 'standard'
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                <span>{t('breathingRetentionStandard')}</span>
              </button>

              <button
                type="button"
                onClick={() => setRetentionMode('hold_free')}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium border text-start flex items-center justify-between transition-colors ${
                  retentionMode === 'hold_free'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                <span>
                  {technique.id === '4_7_8_relax'
                    ? t('breathingRetentionHoldFree478')
                    : t('breathingRetentionHoldFree')}
                </span>
                <span className="text-[10px] text-emerald-400/90 font-normal">
                  ({t('breathingNoRetentionBadge')})
                </span>
              </button>

              {technique.trianglePhases && (
                <button
                  type="button"
                  onClick={() => setRetentionMode('triangle')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-medium border text-start flex items-center justify-between transition-colors ${
                    retentionMode === 'triangle'
                      ? 'bg-sky-500/15 text-sky-400 border-sky-500/40 font-semibold'
                      : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                  }`}
                >
                  <span>{t('breathingRetentionTriangle')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. Pacing & Tempo Multiplier */}
        {!isUntimedAwareness && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-calm-text block">
              {t('breathingSetupPacing')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTempoMultiplier(1.15)}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  tempoMultiplier === 1.15
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                {t('breathingPacingGentle')}
              </button>
              <button
                type="button"
                onClick={() => setTempoMultiplier(1.0)}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  tempoMultiplier === 1.0
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                {t('breathingPacingNormal')}
              </button>
              <button
                type="button"
                onClick={() => setTempoMultiplier(0.9)}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  tempoMultiplier === 0.9
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                {t('breathingPacingDeeper')}
              </button>
            </div>
          </div>
        )}

        {/* 5. Sound Accompaniment */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-calm-text block">
            {t('breathingSetupSound')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AVAILABLE_SOUNDSCAPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSoundscapeId(item.id)}
                className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-colors truncate ${
                  soundscapeId === item.id
                    ? 'bg-calm-primary/15 text-calm-primary border-calm-primary/40 font-semibold'
                    : 'bg-calm-surface text-calm-muted hover:text-calm-text border-calm-border'
                }`}
              >
                {item.id === 'silent' ? (
                  <VolumeX className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" aria-hidden="true" />
                ) : item.isInstrumental ? (
                  <Music className="w-3.5 h-3.5 mx-auto mb-1 text-teal-400 opacity-90" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" aria-hidden="true" />
                )}
                <span>{t(item.nameKey as any)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 6. Transition Chimes Toggle (Disabled by default) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-calm-surface/70 border border-calm-border">
            <div className="flex items-center gap-2.5">
              {audioCueEnabled ? (
                <Bell className="w-4 h-4 text-calm-primary shrink-0" aria-hidden="true" />
              ) : (
                <BellOff className="w-4 h-4 text-calm-muted shrink-0" aria-hidden="true" />
              )}
              <div>
                <span className="text-xs font-medium text-calm-text block">
                  {t('breathingSetupCues')}
                </span>
                <span className="text-[11px] text-calm-muted">
                  {audioCueEnabled ? t('breathingCuesOn') : t('breathingCuesOff')}
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              dir="ltr"
              aria-checked={audioCueEnabled}
              onClick={() => setAudioCueEnabled(!audioCueEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                audioCueEnabled ? 'bg-calm-primary' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  audioCueEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Collapsible Cue Customization Section */}
          {audioCueEnabled && (
            <div className="p-3.5 rounded-xl bg-calm-surface/50 border border-calm-border/70 space-y-4 animate-fadeIn">
              {/* Cue Volume Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="cue-volume-slider" className="font-medium text-calm-text flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
                    <span>{t('breathingCueVolume')}</span>
                  </label>
                  <span className="font-mono text-calm-muted text-[11px]">
                    {Math.round(cueVolume * 100)}%
                  </span>
                </div>
                <input
                  id="cue-volume-slider"
                  type="range"
                  min="0.10"
                  max="1.00"
                  step="0.05"
                  value={cueVolume}
                  onChange={(e) => setCueVolume(parseFloat(e.target.value))}
                  aria-label={t('breathingCueVolume')}
                  aria-valuemin={10}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(cueVolume * 100)}
                  className="w-full h-1.5 bg-calm-border rounded-lg appearance-none cursor-pointer accent-calm-primary focus:outline-none focus:ring-1 focus:ring-calm-primary"
                />
              </div>

              {/* Sound Selectors & Audition Previews */}
              <div className="space-y-2.5 pt-1 border-t border-calm-border/40">
                {/* Inhale Sound */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-calm-text w-24 sm:w-28 shrink-0">
                    {t('breathingCueInhale')}
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <select
                      value={inhaleProfile}
                      onChange={(e) => setInhaleProfile(e.target.value as BreathingCueProfile)}
                      aria-label={t('breathingCueInhale')}
                      className="py-1 px-2.5 rounded-lg bg-calm-card border border-calm-border text-xs text-calm-text focus:outline-none focus:ring-1 focus:ring-calm-primary max-w-[140px]"
                    >
                      {PROFILE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {t(opt.labelKey as any)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handlePreview('inhale', inhaleProfile)}
                      aria-label={t('breathingCuePreviewInhale')}
                      className="p-1.5 rounded-lg bg-calm-card hover:bg-calm-primary/20 hover:text-calm-primary text-calm-muted border border-calm-border transition-colors shrink-0"
                      title={t('breathingCuePreview')}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Exhale Sound */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-calm-text w-24 sm:w-28 shrink-0">
                    {t('breathingCueExhale')}
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <select
                      value={exhaleProfile}
                      onChange={(e) => setExhaleProfile(e.target.value as BreathingCueProfile)}
                      aria-label={t('breathingCueExhale')}
                      className="py-1 px-2.5 rounded-lg bg-calm-card border border-calm-border text-xs text-calm-text focus:outline-none focus:ring-1 focus:ring-calm-primary max-w-[140px]"
                    >
                      {PROFILE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {t(opt.labelKey as any)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handlePreview('exhale', exhaleProfile)}
                      aria-label={t('breathingCuePreviewExhale')}
                      className="p-1.5 rounded-lg bg-calm-card hover:bg-calm-primary/20 hover:text-calm-primary text-calm-muted border border-calm-border transition-colors shrink-0"
                      title={t('breathingCuePreview')}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Hold Sound (Shown only when technique includes active hold phases) */}
                {hasActiveHolds && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-calm-text w-24 sm:w-28 shrink-0">
                      {t('breathingCueHold')}
                    </span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <select
                        value={holdProfile}
                        onChange={(e) => setHoldProfile(e.target.value as BreathingOptionalCueProfile)}
                        aria-label={t('breathingCueHold')}
                        className="py-1 px-2.5 rounded-lg bg-calm-card border border-calm-border text-xs text-calm-text focus:outline-none focus:ring-1 focus:ring-calm-primary max-w-[140px]"
                      >
                        {OPTIONAL_PROFILE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {t(opt.labelKey as any)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={holdProfile === 'none'}
                        onClick={() => handlePreview('hold', holdProfile)}
                        aria-label={t('breathingCuePreviewHold')}
                        className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                          holdProfile === 'none'
                            ? 'opacity-40 cursor-not-allowed bg-calm-card text-calm-muted border-calm-border'
                            : 'bg-calm-card hover:bg-calm-primary/20 hover:text-calm-primary text-calm-muted border-calm-border'
                        }`}
                        title={t('breathingCuePreview')}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Completion Sound */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-calm-text w-24 sm:w-28 shrink-0">
                    {t('breathingCueCompletion')}
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <select
                      value={completionProfile}
                      onChange={(e) => setCompletionProfile(e.target.value as BreathingOptionalCueProfile)}
                      aria-label={t('breathingCueCompletion')}
                      className="py-1 px-2.5 rounded-lg bg-calm-card border border-calm-border text-xs text-calm-text focus:outline-none focus:ring-1 focus:ring-calm-primary max-w-[140px]"
                    >
                      {OPTIONAL_PROFILE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {t(opt.labelKey as any)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={completionProfile === 'none'}
                      onClick={() => handlePreview('completion', completionProfile)}
                      aria-label={t('breathingCuePreviewCompletion')}
                      className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                        completionProfile === 'none'
                          ? 'opacity-40 cursor-not-allowed bg-calm-card text-calm-muted border-calm-border'
                          : 'bg-calm-card hover:bg-calm-primary/20 hover:text-calm-primary text-calm-muted border-calm-border'
                      }`}
                      title={t('breathingCuePreview')}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-calm-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-medium bg-calm-surface hover:bg-calm-surface/80 text-calm-text border border-calm-border transition-colors inline-flex items-center justify-center"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="min-h-[44px] sm:min-h-0 px-5 py-2.5 sm:py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 bg-calm-primary text-slate-900 hover:bg-emerald-400 shadow-md transition-colors"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>{t('breathingSetupStart')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
