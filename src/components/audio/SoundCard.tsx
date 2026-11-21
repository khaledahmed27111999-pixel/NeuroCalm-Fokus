/**
 * NeuroCalm & Fokus — SoundCard Component
 * Displays an individual soundscape modality in the audio library catalog with start/stop toggle.
 */

import React, { useState } from 'react';
import {
  CloudRain,
  Droplets,
  Waves,
  Fan,
  Flame,
  Radio,
  Activity,
  Volume2,
  Sparkles,
  Headphones,
  Play,
  Square,
  Loader2,
  Info,
  ChevronDown,
  CheckCircle2,
  Compass,
  Music,
} from 'lucide-react';
import { SoundscapeId, SoundCategory } from '../../types/audio';
import { useLocale } from '../../context/LocaleContext';
import { TranslationKey } from '../../types/locale';
import { getSoundBenefits } from '../../data/soundBenefits';

export interface SoundCardProps {
  soundId: SoundscapeId;
  name: string;
  description: string;
  category: SoundCategory;
  isPlaying: boolean;
  isLoading: boolean;
  headphoneRequired?: boolean;
  canPlay: boolean;
  onToggle: () => void;
}

export function getSoundNameKey(soundId: SoundscapeId): TranslationKey {
  switch (soundId) {
    case 'rain':
      return 'soundRain';
    case 'stream':
      return 'soundStream';
    case 'ocean_waves':
      return 'soundOceanWaves';
    case 'fan':
      return 'soundFan';
    case 'fireplace':
      return 'soundFireplace';
    case 'xiao':
      return 'soundXiao';
    case 'dizi':
      return 'soundDizi';
    case 'guqin':
      return 'soundGuqin';
    case 'guzheng':
      return 'soundGuzheng';
    case 'white_noise':
      return 'soundWhiteNoise';
    case 'pink_noise':
      return 'soundPinkNoise';
    case 'brown_noise':
      return 'soundBrownNoise';
    case 'violet_noise':
      return 'soundVioletNoise';
    case 'binaural_delta':
      return 'soundBinauralDelta';
    case 'binaural_theta':
      return 'soundBinauralTheta';
    case 'binaural_alpha':
      return 'soundBinauralAlpha';
    case 'binaural_beta':
      return 'soundBinauralBeta';
    case 'binaural_gamma':
      return 'soundBinauralGamma';
    case 'monaural_alpha':
      return 'soundMonauralAlpha';
    case 'isochronic_alpha':
      return 'soundIsochronicAlpha';
    case 'isochronic_theta':
      return 'soundIsochronicTheta';
    default:
      return 'soundRain';
  }
}

export function getSoundIcon(soundId: SoundscapeId): React.ReactElement {
  const iconProps = { className: 'w-5 h-5 shrink-0', 'aria-hidden': true };
  switch (soundId) {
    case 'rain':
      return <CloudRain {...iconProps} />;
    case 'stream':
      return <Droplets {...iconProps} />;
    case 'ocean_waves':
      return <Waves {...iconProps} />;
    case 'fan':
      return <Fan {...iconProps} />;
    case 'fireplace':
      return <Flame {...iconProps} />;
    case 'xiao':
    case 'dizi':
    case 'guqin':
    case 'guzheng':
      return <Music {...iconProps} />;
    case 'white_noise':
      return <Radio {...iconProps} />;
    case 'pink_noise':
      return <Activity {...iconProps} />;
    case 'brown_noise':
      return <Volume2 {...iconProps} />;
    case 'violet_noise':
      return <Sparkles {...iconProps} />;
    default:
      if (soundId.startsWith('binaural_')) return <Headphones {...iconProps} />;
      if (soundId.startsWith('monaural_')) return <Radio {...iconProps} />;
      if (soundId.startsWith('isochronic_')) return <Activity {...iconProps} />;
      return <Volume2 {...iconProps} />;
  }
}

export const SoundCard: React.FC<SoundCardProps> = ({
  soundId,
  name,
  description,
  category,
  isPlaying,
  isLoading,
  headphoneRequired,
  canPlay,
  onToggle,
}) => {
  const { t, locale } = useLocale();
  const [isBenefitsOpen, setIsBenefitsOpen] = useState(false);
  const benefits = getSoundBenefits(soundId);
  const icon = getSoundIcon(soundId);

  const isInstrumental = category === 'instrumental';

  // Scientific evidence tiers (ambient / noise / tonal)
  const hasSupported = Boolean(benefits?.supported && benefits.supported.length > 0);
  const hasPromising = Boolean(benefits?.promising && benefits.promising.length > 0);
  const hasPotential = Boolean(benefits?.potential && benefits.potential.length > 0);

  // Qualitative categories (traditional instruments)
  const hasCharacter = Boolean(benefits?.soundCharacter && benefits.soundCharacter.length > 0);
  const hasExperience = Boolean(benefits?.listeningExperience && benefits.listeningExperience.length > 0);
  const hasContexts = Boolean(benefits?.suitableContexts && benefits.suitableContexts.length > 0);

  const hasAnyQualitative = hasCharacter || hasExperience || hasContexts;
  const hasAnyBenefits = hasSupported || hasPromising || hasPotential || hasAnyQualitative;

  return (
    <div
      className={`group relative p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between text-start ${
        isPlaying
          ? 'bg-calm-surface border-calm-primary/50 shadow-sm'
          : 'bg-calm-card hover:bg-calm-surface/80 border-calm-border'
      }`}
    >
      <div>
        {/* Header: Icon, Name, and Badges */}
        <div className="flex items-start justify-between gap-2.5 mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg transition-colors ${
                isPlaying
                  ? 'bg-calm-primary/20 text-calm-primary'
                  : 'bg-calm-surface text-calm-muted group-hover:text-calm-text'
              }`}
            >
              {icon}
            </div>
            <div>
              <h3 className="font-medium text-sm text-calm-text leading-snug">
                {name}
              </h3>
            </div>
          </div>

          {isPlaying && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-calm-primary/15 text-calm-primary border border-calm-primary/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-calm-primary animate-pulse" />
              {t('mixerSoundActive')}
            </span>
          )}
        </div>

        {/* Calm localized description */}
        <p className="text-xs text-calm-muted leading-relaxed mb-2.5">
          {description}
        </p>

        {/* Information Toggle Button */}
        {hasAnyBenefits && (
          <div className="mb-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsBenefitsOpen((prev) => !prev);
              }}
              aria-expanded={isBenefitsOpen}
              aria-controls={`benefits-${soundId}`}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                isBenefitsOpen
                  ? 'bg-calm-surface text-calm-text border border-calm-border'
                  : 'text-calm-muted hover:text-calm-text hover:bg-calm-surface/60'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-calm-primary shrink-0" aria-hidden="true" />
              <span>
                {isInstrumental
                  ? isBenefitsOpen ? t('instrumentalToggleClose') : t('instrumentalToggleOpen')
                  : isBenefitsOpen ? t('benefitsToggleClose') : t('benefitsToggleOpen')}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 shrink-0 ${
                  isBenefitsOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}

        {/* Expandable Information Section */}
        {isBenefitsOpen && hasAnyBenefits && benefits && (
          <div
            id={`benefits-${soundId}`}
            className="mb-3 p-3 rounded-lg bg-calm-surface/70 border border-calm-border/60 text-start space-y-3"
          >
            {/* Qualitative Instrumental Categories */}
            {isInstrumental && (
              <>
                {hasCharacter && benefits.soundCharacter && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        <Music className="w-3 h-3" aria-hidden="true" />
                        {t('instrumentalSoundCharacter')}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-calm-text/90">
                      {benefits.soundCharacter.map((item) => (
                        <li key={item.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item[locale]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasExperience && benefits.listeningExperience && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-sky-500/15 text-sky-400 border border-sky-500/25">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        {t('instrumentalListeningExperience')}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-calm-text/90">
                      {benefits.listeningExperience.map((item) => (
                        <li key={item.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item[locale]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasContexts && benefits.suitableContexts && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                        <Compass className="w-3 h-3" aria-hidden="true" />
                        {t('instrumentalSuitableContexts')}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-calm-text/90">
                      {benefits.suitableContexts.map((item) => (
                        <li key={item.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item[locale]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="pt-2 border-t border-calm-border/40 text-[10px] text-calm-muted/80 leading-normal italic">
                  {t('instrumentalDisclaimer')}
                </p>
              </>
            )}

            {/* Scientific Evidence Tiers (Non-Instrumental Modalities) */}
            {!isInstrumental && (
              <>
                {/* Supported Benefits Tier */}
                {hasSupported && benefits.supported && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        {t('benefitsSupported')}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-calm-text/90">
                      {benefits.supported.map((item) => (
                        <li key={item.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item[locale]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Promising Benefits Tier */}
                {hasPromising && benefits.promising && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-sky-500/15 text-sky-400 border border-sky-500/25">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        {t('benefitsPromising')}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-calm-text/90">
                      {benefits.promising.map((item) => (
                        <li key={item.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item[locale]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Potential Benefits Tier */}
                {hasPotential && benefits.potential && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                        <Compass className="w-3 h-3" aria-hidden="true" />
                        {t('benefitsPotential')}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-calm-text/90">
                      {benefits.potential.map((item) => (
                        <li key={item.id} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item[locale]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Calm Wellness Disclaimer */}
                <p className="pt-2 border-t border-calm-border/40 text-[10px] text-calm-muted/80 leading-normal italic">
                  {t('benefitsDisclaimer')}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer: Headphone notice & Play/Stop Button */}
      <div className="pt-2 flex items-center justify-between gap-2 border-t border-calm-border/40 mt-auto">
        <div className="flex items-center gap-1 text-[11px] text-calm-muted">
          {headphoneRequired ? (
            <span className="inline-flex items-center gap-1 text-teal-400 font-medium">
              <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('mixerHeadphonesRequired')}</span>
            </span>
          ) : (
            <span className="text-calm-muted/80">{t('mixerSpeakersOrHeadphones')}</span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={!isPlaying && !canPlay}
          aria-label={isPlaying ? `${t('mixerSoundStop')} ${name}` : `${t('mixerSoundPlay')} ${name}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
            isPlaying
              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
              : canPlay
              ? 'bg-calm-primary text-slate-900 hover:bg-emerald-400 shadow-sm'
              : 'bg-calm-surface text-calm-muted cursor-not-allowed opacity-60'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              <span>{t('mixerSoundLoading')}</span>
            </>
          ) : isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{t('mixerSoundStop')}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{t('mixerSoundPlay')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
