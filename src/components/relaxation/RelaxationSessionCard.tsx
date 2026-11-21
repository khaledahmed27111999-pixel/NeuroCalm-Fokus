/**
 * NeuroCalm & Fokus — Relaxation Session Card
 * Phase 3C: Presentation card for curated relaxation sessions with
 * family badges, mode distinction (Breathing vs Music-Only), and setup trigger.
 */

import React from 'react';
import {
  Sparkles,
  Wind,
  Music,
  Headphones,
  Clock,
  Play,
  Waves,
} from 'lucide-react';
import { RelaxationSessionDefinition } from '../../types/relaxationSession';
import { useLocale } from '../../context/LocaleContext';
import { getSoundNameKey } from '../audio/SoundCard';

export interface RelaxationSessionCardProps {
  session: RelaxationSessionDefinition;
  onStart: (session: RelaxationSessionDefinition) => void;
}

export const RelaxationSessionCard: React.FC<RelaxationSessionCardProps> = ({
  session,
  onStart,
}) => {
  const { t } = useLocale();

  const getFamilyBadge = () => {
    switch (session.familyId) {
      case 'combined_soundscape':
        return {
          label: t('sessionFamilyCombined'),
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
          icon: <Sparkles className="w-3 h-3" aria-hidden="true" />,
        };
      case 'chinese_instrumental':
        return {
          label: t('sessionFamilyInstrumental'),
          className: 'bg-teal-500/10 text-teal-400 border-teal-500/25',
          icon: <Music className="w-3 h-3" aria-hidden="true" />,
        };
      case 'nature_based':
        return {
          label: t('sessionFamilyNature'),
          className: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
          icon: <Waves className="w-3 h-3" aria-hidden="true" />,
        };
      case 'music_only':
        return {
          label: t('sessionFamilyMusicOnly'),
          className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
          icon: <Headphones className="w-3 h-3" aria-hidden="true" />,
        };
      default:
        return {
          label: t('sessionFamilyAll'),
          className: 'bg-calm-surface text-calm-muted border-calm-border',
          icon: <Sparkles className="w-3 h-3" aria-hidden="true" />,
        };
    }
  };

  const familyBadge = getFamilyBadge();

  return (
    <div
      data-session-id={session.id}
      className="group relative rounded-2xl bg-calm-card border border-calm-border/80 hover:border-calm-border p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all shadow-sm hover:shadow-md text-start"
    >
      <div className="space-y-4">
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {/* Family Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${familyBadge.className}`}
            >
              {familyBadge.icon}
              <span>{familyBadge.label}</span>
            </span>

            {/* Mode Badge (Breathing vs Music Only) */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                session.isBreathingSession
                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}
            >
              {session.isBreathingSession ? (
                <>
                  <Wind className="w-3 h-3" aria-hidden="true" />
                  <span>{t('sessionModeBreathing')}</span>
                </>
              ) : (
                <>
                  <Music className="w-3 h-3" aria-hidden="true" />
                  <span>{t('sessionModeMusicOnly')}</span>
                </>
              )}
            </span>
          </div>

          {/* Default Duration Tag */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-calm-surface text-calm-muted border border-calm-border/60">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>
              {session.defaultDuration === 'open_ended'
                ? t('sessionOpenEnded')
                : t('breathingDurationMinutes', { count: session.defaultDuration })}
            </span>
          </span>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-calm-text group-hover:text-calm-primary transition-colors">
            {t(session.nameKey as any)}
          </h3>
          <p className="text-xs text-calm-primary/90 font-medium">
            {t(session.subtitleKey as any)}
          </p>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-calm-muted leading-relaxed line-clamp-3">
          {t(session.descriptionKey as any)}
        </p>

        {/* Included Audio Elements */}
        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-calm-muted font-medium me-1">
            {t('sessionDrawerAudioTitle')}:
          </span>
          {session.audioTracks.map((track) => (
            <span
              key={track.soundId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-calm-surface text-calm-text border border-calm-border/60"
            >
              <span>{t(getSoundNameKey(track.soundId) as any)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Start Action Button */}
      <div className="pt-2 border-t border-calm-border/40">
        <button
          type="button"
          onClick={() => onStart(session)}
          className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 bg-calm-surface hover:bg-calm-primary text-calm-text hover:text-slate-900 border border-calm-border hover:border-calm-primary transition-all shadow-sm group-hover:bg-calm-primary group-hover:text-slate-900 group-hover:border-calm-primary"
        >
          <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          <span>{t('sessionBeginButton')}</span>
        </button>
      </div>
    </div>
  );
};
