/**
 * NeuroCalm & Fokus — Sleep Sounds & Night Soundscapes View
 * Phase S6: Dedicated sleep-oriented sound library, night mixer,
 * curated sleep presets, and integrated sleep timer.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Square,
  Moon,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Info,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useLocale } from '../../context/LocaleContext';
import { SoundscapeId, SoundCategory, SoundscapePreset } from '../../types/audio';
import { SOUNDSCAPE_CATALOG } from '../../audio/AudioEngine';
import { ActiveTrackCard } from '../audio/ActiveTrackCard';
import { SoundCard, getSoundNameKey } from '../audio/SoundCard';
import { PresetBar } from '../audio/PresetBar';
import { SleepTimerModal } from '../audio/SleepTimerModal';
import { AudioCreditsModal } from '../audio/AudioCreditsModal';
import { getSleepPresets } from '../../data/sleepPresets';
import {
  saveCustomPreset,
  deleteCustomPreset,
} from '../../storage/soundscapePresetsStorage';
import { formatTimeDisplay } from '../../utils/focusTimer';
import { TranslationKey } from '../../types/locale';

interface SleepSoundsViewProps {
  onBack: () => void;
}

export type SleepSoundCategory =
  | 'all'
  | 'rain_water'
  | 'cozy'
  | 'noise'
  | 'frequencies'
  | 'instrumental';

interface SleepSoundItemDef {
  id: SoundscapeId;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  category: SoundCategory;
  sleepCategory: SleepSoundCategory;
  headphoneRequired?: boolean;
}

export const SLEEP_SOUNDS_CATALOG: SleepSoundItemDef[] = [
  // Rain & Water
  {
    id: 'rain',
    nameKey: 'soundRain',
    descKey: 'soundRainDesc',
    category: 'nature',
    sleepCategory: 'rain_water',
  },
  {
    id: 'stream',
    nameKey: 'soundStream',
    descKey: 'soundStreamDesc',
    category: 'nature',
    sleepCategory: 'rain_water',
  },
  {
    id: 'ocean_waves',
    nameKey: 'soundOceanWaves',
    descKey: 'soundOceanWavesDesc',
    category: 'nature',
    sleepCategory: 'rain_water',
  },

  // Cozy Ambience
  {
    id: 'fireplace',
    nameKey: 'soundFireplace',
    descKey: 'soundFireplaceDesc',
    category: 'environment',
    sleepCategory: 'cozy',
  },
  {
    id: 'fan',
    nameKey: 'soundFan',
    descKey: 'soundFanDesc',
    category: 'environment',
    sleepCategory: 'cozy',
  },

  // Masking Noise
  {
    id: 'brown_noise',
    nameKey: 'soundBrownNoise',
    descKey: 'soundBrownNoiseDesc',
    category: 'noise',
    sleepCategory: 'noise',
  },
  {
    id: 'pink_noise',
    nameKey: 'soundPinkNoise',
    descKey: 'soundPinkNoiseDesc',
    category: 'noise',
    sleepCategory: 'noise',
  },
  {
    id: 'white_noise',
    nameKey: 'soundWhiteNoise',
    descKey: 'soundWhiteNoiseDesc',
    category: 'noise',
    sleepCategory: 'noise',
  },

  // Restful Brainwave Frequencies
  {
    id: 'binaural_delta',
    nameKey: 'soundBinauralDelta',
    descKey: 'soundBinauralDeltaDesc',
    category: 'binaural',
    sleepCategory: 'frequencies',
    headphoneRequired: true,
  },
  {
    id: 'binaural_theta',
    nameKey: 'soundBinauralTheta',
    descKey: 'soundBinauralThetaDesc',
    category: 'binaural',
    sleepCategory: 'frequencies',
    headphoneRequired: true,
  },
  {
    id: 'isochronic_theta',
    nameKey: 'soundIsochronicTheta',
    descKey: 'soundIsochronicThetaDesc',
    category: 'monaural_isochronic',
    sleepCategory: 'frequencies',
    headphoneRequired: false,
  },

  // Night Instrumental Music
  {
    id: 'guqin',
    nameKey: 'soundGuqin',
    descKey: 'soundGuqinDesc',
    category: 'instrumental',
    sleepCategory: 'instrumental',
  },
  {
    id: 'xiao',
    nameKey: 'soundXiao',
    descKey: 'soundXiaoDesc',
    category: 'instrumental',
    sleepCategory: 'instrumental',
  },
  {
    id: 'dizi',
    nameKey: 'soundDizi',
    descKey: 'soundDiziDesc',
    category: 'instrumental',
    sleepCategory: 'instrumental',
  },
  {
    id: 'guzheng',
    nameKey: 'soundGuzheng',
    descKey: 'soundGuzhengDesc',
    category: 'instrumental',
    sleepCategory: 'instrumental',
  },
];

export const SleepSoundsView: React.FC<SleepSoundsViewProps> = ({ onBack }) => {
  const { t, direction } = useLocale();
  const {
    state,
    playTrack,
    stopTrack,
    setTrackVolume,
    setMasterVolume,
    toggleMute,
    stopAll,
  } = useAudio();

  const sleepTimer = useSleepTimer();

  const [activeCategory, setActiveCategory] = useState<SleepSoundCategory>('all');
  const [presets, setPresets] = useState<SoundscapePreset[]>(() => getSleepPresets());
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  // Screen reader live announcements for sleep timer transitions
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
    } else if (prevStatus === 'fading' && currentStatus === 'idle' && state.activeCount === 0) {
      setAnnouncement(t('sleepTimerAnnounceCompleted'));
    }

    prevStatusRef.current = currentStatus;
  }, [
    sleepTimer.state.status,
    sleepTimer.state.durationMinutes,
    sleepTimer.state.fadeDurationSeconds,
    state.activeCount,
    t,
  ]);

  const activeSoundIds = useMemo(() => {
    return Object.keys(state.activeTracks) as SoundscapeId[];
  }, [state.activeTracks]);

  const masterPercent = Math.round(state.masterVolume * 100);

  // Filter available sleep sounds
  const filteredSounds = useMemo(() => {
    if (activeCategory === 'all') return SLEEP_SOUNDS_CATALOG;
    return SLEEP_SOUNDS_CATALOG.filter((s) => s.sleepCategory === activeCategory);
  }, [activeCategory]);

  // Apply a soundscape preset
  const handleApplyPreset = useCallback(
    async (preset: SoundscapePreset) => {
      await stopAll();
      for (const track of preset.tracks) {
        if (SOUNDSCAPE_CATALOG[track.soundId]) {
          setTrackVolume(track.soundId, track.volume);
          await playTrack(track.soundId);
        }
      }
    },
    [stopAll, playTrack, setTrackVolume]
  );

  // Save current mix as custom preset
  const handleSavePreset = useCallback(
    (name: string) => {
      const currentTracks = activeSoundIds.map((id) => ({
        soundId: id,
        volume: state.activeTracks[id]?.volume ?? 0.7,
      }));
      const created = saveCustomPreset(name, currentTracks);
      if (created) {
        setPresets(getSleepPresets());
      }
    },
    [activeSoundIds, state.activeTracks]
  );

  // Delete custom preset
  const handleDeletePreset = useCallback((id: string) => {
    const success = deleteCustomPreset(id);
    if (success) {
      setPresets(getSleepPresets());
    }
  }, []);

  // Category filter tabs definition
  const categoryFilters: { id: SleepSoundCategory; label: string }[] = [
    { id: 'all', label: t('sleepCategoryAll') },
    { id: 'rain_water', label: t('sleepCategoryRainWater') },
    { id: 'cozy', label: t('sleepCategoryCozy') },
    { id: 'noise', label: t('sleepCategoryNoise') },
    { id: 'frequencies', label: t('sleepCategoryFrequencies') },
    { id: 'instrumental', label: t('sleepCategoryInstrumental') },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 text-start">
      {/* Screen Reader Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* 1. Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-calm-surface border border-calm-border text-calm-muted hover:text-calm-text hover:bg-calm-surface/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary shrink-0"
            aria-label={t('sleepSoundsBackToDashboard')}
          >
            {direction === 'rtl' ? (
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('sleepSoundsNavTitle')}
            </h2>
            <p className="text-sm text-calm-muted leading-relaxed">
              {t('sleepSoundsNavSubtitle')}
            </p>
          </div>
        </div>

        {/* Top Controls: Sleep Timer Trigger & Credits */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setIsTimerModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
              sleepTimer.state.status !== 'idle'
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-calm-surface border-calm-border text-calm-muted hover:text-calm-text'
            }`}
            aria-label={t('sleepTimerConfigure')}
          >
            <Moon className={`w-4 h-4 ${sleepTimer.state.status !== 'idle' ? 'animate-pulse text-indigo-400' : ''}`} />
            <span>
              {sleepTimer.state.status !== 'idle'
                ? `${t('sleepTimerRunningStatus')} (${formatTimeDisplay(sleepTimer.state.remainingSeconds)})`
                : t('sleepTimerConfigure')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreditsOpen(true)}
            className="p-2 rounded-xl bg-calm-surface border border-calm-border text-calm-muted hover:text-calm-text transition-colors"
            title={t('mixerCreditsTitle')}
            aria-label={t('mixerCreditsTitle')}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Philosophy Callout */}
      <div className="p-4 sm:p-5 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3.5">
        <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
        <p className="text-sm text-calm-text font-medium leading-relaxed">
          {t('sleepSoundsPhilosophy')}
        </p>
      </div>

      {/* Sleep Timer Active Status Alert Banner */}
      {sleepTimer.state.status !== 'idle' && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            sleepTimer.state.isFading
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                sleepTimer.state.isFading
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-indigo-500/20 text-indigo-400'
              }`}
            >
              <Moon className="w-4 h-4 animate-pulse" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {sleepTimer.state.isFading
                  ? t('sleepTimerFadingStatus')
                  : t('sleepTimerRunningStatus')}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                {sleepTimer.state.isFading
                  ? t('sleepTimerUntilSilence', {
                      time: formatTimeDisplay(sleepTimer.state.remainingSeconds),
                    })
                  : t('sleepTimerUntilFade', {
                      time: formatTimeDisplay(sleepTimer.state.remainingSecondsBeforeFade),
                    })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                sleepTimer.extendTimer(15);
                setAnnouncement(t('sleepTimerAnnounceExtended'));
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium border border-white/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline me-1" />
              <span>{t('sleepTimerExtend15')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sleepTimer.cancelTimer();
                setAnnouncement(t('sleepTimerAnnounceCancelled'));
              }}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs font-medium transition-colors"
            >
              {t('sleepTimerCancel')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Curated Sleep Presets Bar */}
      <section
        aria-labelledby="sleep-presets-heading"
        className="p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4"
      >
        <h3 id="sleep-presets-heading" className="sr-only">
          {t('sleepPresetsTitle')}
        </h3>
        <PresetBar
          presets={presets}
          activeSoundIds={activeSoundIds}
          activeCount={state.activeCount}
          onApplyPreset={handleApplyPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
        />
      </section>

      {/* 3. Sleep Mixer Controls: Master Volume & Active Tracks */}
      <section
        aria-labelledby="sleep-mixer-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-calm-border/60 pb-5">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h3 id="sleep-mixer-heading" className="text-lg font-semibold text-calm-text">
              {t('sleepSoundsActiveTracksTitle')}
            </h3>
            <span className="text-xs font-mono text-calm-muted bg-calm-surface px-2.5 py-0.5 rounded-full border border-calm-border">
              {state.activeCount}/4
            </span>
          </div>

          {/* Master Volume Fader & Stop All */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              disabled={state.activeCount === 0}
              className={`p-2 rounded-xl border transition-colors ${
                state.isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-calm-surface border-calm-border text-calm-muted hover:text-calm-text'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={state.isMuted ? t('mixerUnmuteAll') : t('mixerMuteAll')}
            >
              {state.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2">
              <label htmlFor="sleep-master-volume" className="sr-only">
                {t('mixerMasterVolume')}
              </label>
              <input
                id="sleep-master-volume"
                type="range"
                min="0"
                max="100"
                value={state.isMuted ? 0 : masterPercent}
                onChange={(e) => setMasterVolume(parseInt(e.target.value, 10) / 100)}
                disabled={state.activeCount === 0}
                className="w-24 sm:w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-calm-surface accent-calm-primary disabled:opacity-40"
              />
              <span className="text-xs font-mono text-calm-muted w-9 text-end">
                {state.isMuted ? '0%' : `${masterPercent}%`}
              </span>
            </div>

            {state.activeCount > 0 && (
              <button
                type="button"
                onClick={stopAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-calm-surface border border-calm-border text-xs text-calm-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{t('mixerStopAll')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Track Cards Grid */}
        {state.activeCount > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeSoundIds.map((id) => {
              const track = state.activeTracks[id];
              if (!track) return null;
              const nameKey = getSoundNameKey(id);

              return (
                <ActiveTrackCard
                  key={id}
                  soundId={id}
                  name={t(nameKey)}
                  volume={track.volume}
                  isLoading={track.isLoading}
                  error={track.error}
                  onVolumeChange={(vol) => setTrackVolume(id, vol)}
                  onStop={() => stopTrack(id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-calm-surface/40 border border-calm-border/60 text-center space-y-2">
            <Moon className="w-8 h-8 text-calm-muted/50 mx-auto" aria-hidden="true" />
            <p className="text-xs sm:text-sm text-calm-muted max-w-md mx-auto">
              {t('sleepSoundsNoActiveTracks')}
            </p>
          </div>
        )}
      </section>

      {/* 4. Sleep Sound Library */}
      <section
        aria-labelledby="sleep-library-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 id="sleep-library-heading" className="text-lg font-semibold text-calm-text">
              {t('sleepSoundsLibraryTitle')}
            </h3>
            <p className="text-xs text-calm-muted mt-0.5">
              Select up to 4 simultaneous ambient layers.
            </p>
          </div>

          {state.activeCount >= 4 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{t('sleepSoundsCapacityNotice')}</span>
            </div>
          )}
        </div>

        {/* Category Filters Bar */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-calm-surface border border-calm-border">
          {categoryFilters.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                  isActive
                    ? 'bg-calm-primary text-white shadow-sm'
                    : 'text-calm-muted hover:text-calm-text hover:bg-calm-card/50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Sound Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSounds.map((item) => {
            const track = state.activeTracks[item.id];
            const isPlaying = track?.isPlaying ?? false;
            const isLoading = track?.isLoading ?? false;
            const canPlay = isPlaying || state.activeCount < 4;

            return (
              <SoundCard
                key={item.id}
                soundId={item.id}
                name={t(item.nameKey)}
                description={t(item.descKey)}
                category={item.category}
                isPlaying={isPlaying}
                isLoading={isLoading}
                headphoneRequired={item.headphoneRequired}
                canPlay={canPlay}
                onToggle={() => {
                  if (isPlaying) {
                    stopTrack(item.id);
                  } else if (canPlay) {
                    playTrack(item.id);
                  }
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Non-Medical Disclaimer */}
      <footer className="p-4 rounded-xl bg-calm-card/50 border border-calm-border/60 text-xs text-calm-muted leading-relaxed">
        {t('sleepSoundsDisclaimer')}
      </footer>

      {/* Sleep Timer Configuration Modal */}
      <SleepTimerModal
        isOpen={isTimerModalOpen}
        onClose={() => setIsTimerModalOpen(false)}
      />

      {/* Audio Licensing Credits Modal */}
      <AudioCreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </div>
  );
};
