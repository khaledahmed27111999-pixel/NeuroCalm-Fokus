/**
 * NeuroCalm & Fokus — SoundscapeMixer Component
 * Central audio mixing interface for nature soundscapes, colored noise, and brainwave tone synthesis.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Square,
  AlertCircle,
  X,
  Info,
  Waves,
  Moon,
  Plus,
  Settings2,
} from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useLocale } from '../../context/LocaleContext';
import { SoundscapeId, SoundCategory, SoundscapePreset } from '../../types/audio';
import { SOUNDSCAPE_CATALOG } from '../../audio/AudioEngine';
import { ActiveTrackCard } from './ActiveTrackCard';
import { SoundCard } from './SoundCard';
import { PresetBar } from './PresetBar';
import { AudioCreditsModal } from './AudioCreditsModal';
import { SleepTimerModal } from './SleepTimerModal';
import { formatTimeDisplay } from '../../utils/focusTimer';
import {
  getAllPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from '../../storage/soundscapePresetsStorage';
import { TranslationKey } from '../../types/locale';

type CategoryFilter = 'all' | 'nature' | 'environment' | 'noise' | 'tonal' | 'instrumental';

interface SoundItemDef {
  id: SoundscapeId;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  category: SoundCategory;
  headphoneRequired?: boolean;
}

const AVAILABLE_SOUNDS: SoundItemDef[] = [
  // Nature
  { id: 'rain', nameKey: 'soundRain', descKey: 'soundRainDesc', category: 'nature' },
  { id: 'stream', nameKey: 'soundStream', descKey: 'soundStreamDesc', category: 'nature' },
  { id: 'ocean_waves', nameKey: 'soundOceanWaves', descKey: 'soundOceanWavesDesc', category: 'nature' },

  // Environment
  { id: 'fan', nameKey: 'soundFan', descKey: 'soundFanDesc', category: 'environment' },
  { id: 'fireplace', nameKey: 'soundFireplace', descKey: 'soundFireplaceDesc', category: 'environment' },

  // Noise
  { id: 'white_noise', nameKey: 'soundWhiteNoise', descKey: 'soundWhiteNoiseDesc', category: 'noise' },
  { id: 'pink_noise', nameKey: 'soundPinkNoise', descKey: 'soundPinkNoiseDesc', category: 'noise' },
  { id: 'brown_noise', nameKey: 'soundBrownNoise', descKey: 'soundBrownNoiseDesc', category: 'noise' },
  { id: 'violet_noise', nameKey: 'soundVioletNoise', descKey: 'soundVioletNoiseDesc', category: 'noise' },

  // Brainwave & Tones
  { id: 'binaural_delta', nameKey: 'soundBinauralDelta', descKey: 'soundBinauralDeltaDesc', category: 'binaural', headphoneRequired: true },
  { id: 'binaural_theta', nameKey: 'soundBinauralTheta', descKey: 'soundBinauralThetaDesc', category: 'binaural', headphoneRequired: true },
  { id: 'binaural_alpha', nameKey: 'soundBinauralAlpha', descKey: 'soundBinauralAlphaDesc', category: 'binaural', headphoneRequired: true },
  { id: 'binaural_beta', nameKey: 'soundBinauralBeta', descKey: 'soundBinauralBetaDesc', category: 'binaural', headphoneRequired: true },
  { id: 'binaural_gamma', nameKey: 'soundBinauralGamma', descKey: 'soundBinauralGammaDesc', category: 'binaural', headphoneRequired: true },
  { id: 'monaural_alpha', nameKey: 'soundMonauralAlpha', descKey: 'soundMonauralAlphaDesc', category: 'monaural_isochronic', headphoneRequired: false },
  { id: 'isochronic_alpha', nameKey: 'soundIsochronicAlpha', descKey: 'soundIsochronicAlphaDesc', category: 'monaural_isochronic', headphoneRequired: false },
  { id: 'isochronic_theta', nameKey: 'soundIsochronicTheta', descKey: 'soundIsochronicThetaDesc', category: 'monaural_isochronic', headphoneRequired: false },

  // Traditional Chinese Instruments
  { id: 'xiao', nameKey: 'soundXiao', descKey: 'soundXiaoDesc', category: 'instrumental' },
  { id: 'dizi', nameKey: 'soundDizi', descKey: 'soundDiziDesc', category: 'instrumental' },
  { id: 'guqin', nameKey: 'soundGuqin', descKey: 'soundGuqinDesc', category: 'instrumental' },
  { id: 'guzheng', nameKey: 'soundGuzheng', descKey: 'soundGuzhengDesc', category: 'instrumental' },
];

export const SoundscapeMixer: React.FC = () => {
  const {
    state,
    playTrack,
    stopTrack,
    setTrackVolume,
    setMasterVolume,
    toggleMute,
    stopAll,
    clearConflictError,
  } = useAudio();

  const sleepTimer = useSleepTimer();
  const { t } = useLocale();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [presets, setPresets] = useState<SoundscapePreset[]>(() => getAllPresets());
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);

  // Screen reader live announcement management for sleep timer transitions
  const [announcement, setAnnouncement] = useState('');
  const prevStatusRef = useRef(sleepTimer.state.status);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = sleepTimer.state.status;

    if (prevStatus === 'idle' && currentStatus === 'running') {
      setAnnouncement(
        t('sleepTimerAnnounceStarted', {
          timer: sleepTimer.state.durationMinutes,
          fade: Math.round(sleepTimer.state.fadeDurationSeconds / 60),
        })
      );
    } else if (prevStatus === 'running' && currentStatus === 'fading') {
      setAnnouncement(t('sleepTimerAnnounceFading'));
    } else if ((prevStatus === 'running' || prevStatus === 'fading') && currentStatus === 'idle') {
      setAnnouncement(t('sleepTimerAnnounceCancelled'));
    } else if (currentStatus === 'completed' && prevStatus !== 'completed') {
      setAnnouncement(t('sleepTimerAnnounceCompleted'));
    }

    prevStatusRef.current = currentStatus;
  }, [
    sleepTimer.state.status,
    sleepTimer.state.durationMinutes,
    sleepTimer.state.fadeDurationSeconds,
    t,
  ]);

  // Sync presets from storage
  const refreshPresets = useCallback(() => {
    setPresets(getAllPresets());
  }, []);

  const activeSoundIds = useMemo(() => {
    return Object.keys(state.activeTracks) as SoundscapeId[];
  }, [state.activeTracks]);

  const masterPercent = Math.round(state.masterVolume * 100);

  // Filter available sounds
  const filteredSounds = useMemo(() => {
    if (activeCategory === 'all') return AVAILABLE_SOUNDS;
    if (activeCategory === 'nature') return AVAILABLE_SOUNDS.filter((s) => s.category === 'nature');
    if (activeCategory === 'environment') return AVAILABLE_SOUNDS.filter((s) => s.category === 'environment');
    if (activeCategory === 'noise') return AVAILABLE_SOUNDS.filter((s) => s.category === 'noise');
    if (activeCategory === 'tonal') {
      return AVAILABLE_SOUNDS.filter((s) => s.category === 'binaural' || s.category === 'monaural_isochronic');
    }
    if (activeCategory === 'instrumental') {
      return AVAILABLE_SOUNDS.filter((s) => s.category === 'instrumental');
    }
    return AVAILABLE_SOUNDS;
  }, [activeCategory]);

  // Apply a soundscape preset
  const handleApplyPreset = useCallback(
    async (preset: SoundscapePreset) => {
      // 1. Stop current tracks first
      await stopAll();

      // 2. Play each track from the preset and set volume
      for (const track of preset.tracks) {
        if (SOUNDSCAPE_CATALOG[track.soundId]) {
          setTrackVolume(track.soundId, track.volume);
          await playTrack(track.soundId);
        }
      }
    },
    [stopAll, playTrack, setTrackVolume]
  );

  // Save current mix as a custom preset
  const handleSavePreset = useCallback(
    (name: string) => {
      const currentTracks = activeSoundIds.map((id) => ({
        soundId: id,
        volume: state.activeTracks[id]?.volume ?? 0.7,
      }));
      if (currentTracks.length === 0) return;

      saveCustomPreset(name, currentTracks);
      refreshPresets();
    },
    [activeSoundIds, state.activeTracks, refreshPresets]
  );

  // Delete custom preset
  const handleDeletePreset = useCallback(
    (id: string) => {
      deleteCustomPreset(id);
      refreshPresets();
    },
    [refreshPresets]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Screen Reader Live Region for Sleep Timer Transitions */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* 1. Header: Master Controls Card */}
      <div className="p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-5 text-start">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Waves className="w-6 h-6 text-calm-primary" aria-hidden="true" />
              <h2 className="text-xl sm:text-2xl font-semibold text-calm-text">
                {t('mixerTitle')}
              </h2>
            </div>
            <p className="text-sm text-calm-muted mt-1">
              {t('mixerSubtitle')}
            </p>
          </div>

          {/* Master Actions (Sleep Timer Trigger + Stop All) */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            {/* Sleep Timer Idle Button */}
            {sleepTimer.state.status === 'idle' && (
              <button
                id="sleep-timer-trigger-btn"
                type="button"
                onClick={() => setIsSleepModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl bg-calm-surface hover:bg-calm-border/60 text-calm-text border border-calm-border text-xs font-semibold transition-colors"
                aria-label={t('sleepTimerConfigure')}
              >
                <Moon className="w-4 h-4 text-calm-primary" aria-hidden="true" />
                <span>{t('sleepTimerConfigure')}</span>
              </button>
            )}

            {/* Stop All Button */}
            {state.activeCount > 0 && (
              <button
                type="button"
                onClick={() => void stopAll()}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>{t('mixerStopAll')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Sleep Timer Card (when running or fading) */}
        {sleepTimer.state.status !== 'idle' && (
          <div
            id="active-sleep-timer-card"
            className={`p-4 rounded-xl border transition-all text-start flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in ${
              sleepTimer.state.isFading
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-teal-500/10 border-teal-500/30'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  sleepTimer.state.isFading
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                }`}
              >
                <Moon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-calm-text">
                    {sleepTimer.state.isFading
                      ? t('sleepTimerFadingStatus')
                      : t('sleepTimerRunningStatus')}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      sleepTimer.state.isFading
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    }`}
                  >
                    {sleepTimer.state.isFading
                      ? t('sleepTimerUntilSilence', {
                          time: formatTimeDisplay(sleepTimer.state.remainingSeconds),
                        })
                      : t('sleepTimerUntilFade', {
                          time: formatTimeDisplay(sleepTimer.state.remainingSecondsBeforeFade),
                        })}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-calm-muted">
                  {t('sleepTimerUntilSilence', {
                    time: formatTimeDisplay(sleepTimer.state.remainingSeconds),
                  })}
                </p>
              </div>
            </div>

            {/* Actions: +15 min, Edit Settings, Cancel */}
            <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
              <button
                id="sleep-timer-extend-btn"
                type="button"
                onClick={() => {
                  sleepTimer.extendTimer(15);
                  setAnnouncement(t('sleepTimerAnnounceExtended'));
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-calm-surface hover:bg-calm-border/60 text-calm-text border border-calm-border text-xs font-semibold transition-colors"
                aria-label={t('sleepTimerExtend15')}
              >
                <Plus className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
                <span>{t('sleepTimerExtend15')}</span>
              </button>

              <button
                id="sleep-timer-settings-btn"
                type="button"
                onClick={() => setIsSleepModalOpen(true)}
                className="inline-flex items-center justify-center p-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-calm-surface hover:bg-calm-border/60 text-calm-muted hover:text-calm-text border border-calm-border text-xs font-medium transition-colors"
                aria-label={t('sleepTimerTitle')}
                title={t('sleepTimerTitle')}
              >
                <Settings2 className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                id="sleep-timer-cancel-btn"
                type="button"
                onClick={() => {
                  sleepTimer.cancelTimer();
                  setAnnouncement(t('sleepTimerAnnounceCancelled'));
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors"
                aria-label={t('sleepTimerCancel')}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('sleepTimerCancel')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Conflict / Takeover Notice Banner */}
        {state.conflictError && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{state.conflictError}</span>
            </div>
            <button
              type="button"
              onClick={clearConflictError}
              aria-label={t('cancel')}
              className="p-1 rounded text-amber-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Master Volume Fader Bar */}
        <div className="pt-2 border-t border-calm-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-calm-muted">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={state.isMuted ? t('mixerUnmuteAll') : t('mixerMuteAll')}
              className="p-1.5 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors"
            >
              {state.isMuted || masterPercent === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-calm-primary" aria-hidden="true" />
              )}
            </button>
            <span className="text-calm-text font-semibold">{t('mixerMasterVolume')}</span>
            <span className="font-mono text-calm-text">({state.isMuted ? '0%' : `${masterPercent}%`})</span>
          </div>

          <div className="flex items-center gap-3 sm:w-64">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={state.isMuted ? 0 : masterPercent}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              aria-label={t('mixerMasterVolume')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={state.isMuted ? 0 : masterPercent}
              className="w-full h-2 bg-calm-border rounded-lg appearance-none cursor-pointer accent-calm-primary focus:outline-none focus:ring-2 focus:ring-calm-primary/40"
            />
          </div>
        </div>
      </div>

      {/* 2. Presets Bar */}
      <div className="p-5 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
        <PresetBar
          presets={presets}
          activeSoundIds={activeSoundIds}
          activeCount={state.activeCount}
          onApplyPreset={handleApplyPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
        />
      </div>

      {/* 3. Active Sounds Section */}
      <div className="p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4 text-start">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-calm-text">
              {t('mixerActiveTracksTitle')}
            </h3>
            <span className="text-xs font-medium text-calm-muted">
              {t('mixerActiveTracksCount', { count: state.activeCount, max: 4 })}
            </span>
          </div>

          {state.activeCount >= 4 && (
            <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {t('mixerMaxTracksReached')}
            </span>
          )}
        </div>

        {state.activeCount === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-calm-border/80 text-center space-y-2 bg-calm-surface/30">
            <p className="text-sm font-medium text-calm-text">
              {t('mixerEmptyActiveTitle')}
            </p>
            <p className="text-xs text-calm-muted max-w-md mx-auto">
              {t('mixerEmptyActiveDesc')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeSoundIds.map((soundId) => {
              const trackState = state.activeTracks[soundId];
              const soundDef = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
              const displayName = soundDef ? t(soundDef.nameKey) : soundId;

              return (
                <ActiveTrackCard
                  key={soundId}
                  soundId={soundId}
                  name={displayName}
                  volume={trackState?.volume ?? 0.7}
                  isLoading={trackState?.isLoading ?? false}
                  error={trackState?.error ?? null}
                  onVolumeChange={(newVol) => setTrackVolume(soundId, newVol)}
                  onStop={() => void stopTrack(soundId)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Audio Library / Sound Browser */}
      <div className="p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-5 text-start">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-calm-text">
            {t('mixerCategoriesTitle')}
          </h3>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                activeCategory === 'all'
                  ? 'bg-calm-primary text-slate-900 shadow-sm'
                  : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-border/60'
              }`}
            >
              {t('mixerCategoryAll')}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('nature')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                activeCategory === 'nature'
                  ? 'bg-calm-primary text-slate-900 shadow-sm'
                  : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-border/60'
              }`}
            >
              {t('mixerCategoryNature')}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('environment')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                activeCategory === 'environment'
                  ? 'bg-calm-primary text-slate-900 shadow-sm'
                  : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-border/60'
              }`}
            >
              {t('mixerCategoryEnvironment')}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('noise')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                activeCategory === 'noise'
                  ? 'bg-calm-primary text-slate-900 shadow-sm'
                  : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-border/60'
              }`}
            >
              {t('mixerCategoryNoise')}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('tonal')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                activeCategory === 'tonal'
                  ? 'bg-calm-primary text-slate-900 shadow-sm'
                  : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-border/60'
              }`}
            >
              {t('mixerCategoryTonal')}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('instrumental')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                activeCategory === 'instrumental'
                  ? 'bg-calm-primary text-slate-900 shadow-sm'
                  : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-border/60'
              }`}
            >
              {t('mixerCategoryInstrumental')}
            </button>
          </div>
        </div>

        {/* Sound Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSounds.map((sound) => {
            const isPlaying = state.activeTracks[sound.id]?.isPlaying ?? false;
            const isLoading = state.activeTracks[sound.id]?.isLoading ?? false;
            const canPlay = state.activeCount < 4 || isPlaying;

            return (
              <SoundCard
                key={sound.id}
                soundId={sound.id}
                name={t(sound.nameKey)}
                description={t(sound.descKey)}
                category={sound.category}
                isPlaying={isPlaying}
                isLoading={isLoading}
                headphoneRequired={sound.headphoneRequired}
                canPlay={canPlay}
                onToggle={() => {
                  if (isPlaying) {
                    void stopTrack(sound.id);
                  } else {
                    void playTrack(sound.id);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 5. Footer: Attributions Modal Link */}
      <div className="text-center pt-2">
        <button
          id="audio-credits-button"
          type="button"
          onClick={() => setIsCreditsOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-calm-muted hover:text-calm-primary transition-colors underline font-medium"
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('mixerCreditsButton')}</span>
        </button>
      </div>

      {/* Audio Attributions Dialog */}
      <AudioCreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />

      {/* Sleep Timer Configuration Modal */}
      <SleepTimerModal
        isOpen={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
      />
    </div>
  );
};
