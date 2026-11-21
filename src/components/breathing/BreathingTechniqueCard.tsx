/**
 * NeuroCalm & Fokus — Breathing Technique Card
 * Phase 3A: Displays an individual respiratory technique with pattern summary,
 * qualified physiological context, and session setup trigger.
 */

import React, { useState } from 'react';
import {
  Wind,
  Shield,
  Moon,
  Compass,
  Play,
  Info,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { BreathingTechnique } from '../../types/breathing';
import { useLocale } from '../../context/LocaleContext';

export interface BreathingTechniqueCardProps {
  technique: BreathingTechnique;
  onStart: (techniqueId: BreathingTechnique['id']) => void;
}

export function getTechniqueIcon(id: string): React.ReactElement {
  const iconProps = { className: 'w-5 h-5 shrink-0', 'aria-hidden': true };
  switch (id) {
    case 'diaphragmatic':
      return <Wind {...iconProps} />;
    case 'resonance_frequency':
      return <Sparkles {...iconProps} />;
    case 'physiological_sigh':
      return <Wind {...iconProps} />;
    case 'extended_exhale':
      return <Moon {...iconProps} />;
    case 'box_breathing':
      return <Shield {...iconProps} />;
    case '4_7_8_relax':
      return <Moon {...iconProps} />;
    case 'pursed_lip':
      return <Compass {...iconProps} />;
    default:
      return <Wind {...iconProps} />;
  }
}

export const BreathingTechniqueCard: React.FC<BreathingTechniqueCardProps> = ({
  technique,
  onStart,
}) => {
  const { t } = useLocale();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const icon = getTechniqueIcon(technique.id);

  // Compute concise timing preview string
  const timingPreview = technique.phases
    .map((p) => `${p.durationSeconds}s`)
    .join(' • ');

  return (
    <div className="group relative p-5 rounded-2xl bg-calm-card hover:bg-calm-surface/80 border border-calm-border transition-all duration-200 flex flex-col justify-between text-start shadow-sm">
      <div>
        {/* Header: Icon, Title & Badges */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-calm-surface text-teal-400 border border-calm-border/60 group-hover:border-teal-500/30 transition-colors">
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-base text-calm-text leading-snug">
                {t(technique.nameKey as any)}
              </h3>
              <p className="text-xs text-calm-muted/90 mt-0.5 line-clamp-1">
                {t(technique.subtitleKey as any)}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {/* Retention status badge */}
          {!technique.hasBreathRetention ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              {t('breathingNoRetentionBadge')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/25">
              {t('breathingRetentionBadge')}
            </span>
          )}

          {/* Specialized warning badge if applicable */}
          {technique.isSpecialized && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {t('breathingSpecializedBadge')}
            </span>
          )}

          {/* Timing preview pill */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-calm-surface text-calm-muted border border-calm-border">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span>
              {technique.isUntimedAwarenessSupported
                ? t('breathingUntimedAwarenessDefault')
                : timingPreview}
            </span>
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-calm-muted leading-relaxed mb-3">
          {t(technique.descriptionKey as any)}
        </p>

        {/* Expandable Qualified Context Drawer */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setIsContextOpen(!isContextOpen)}
            aria-expanded={isContextOpen}
            aria-controls={`context-${technique.id}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-calm-muted hover:text-calm-text transition-colors py-0.5"
          >
            <Info className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
            <span>{isContextOpen ? t('benefitsToggleClose') : t('benefitsToggleOpen')}</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 shrink-0 ${
                isContextOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {isContextOpen && (
            <div
              id={`context-${technique.id}`}
              className="mt-2.5 p-3 rounded-xl bg-calm-surface/80 border border-calm-border/60 text-xs text-calm-text/90 space-y-2 animate-fadeIn"
            >
              <p className="leading-relaxed">
                {t(technique.scientificContextKey as any)}
              </p>
              {technique.isUntimedAwarenessSupported && (
                <p className="text-[11px] text-teal-400/90 italic pt-1 border-t border-calm-border/40">
                  {t('breathingUntimedAwareness')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="pt-3 border-t border-calm-border/50 flex items-center justify-between gap-3 mt-auto">
        <span className="text-[11px] text-calm-muted">
          {t('breathingDurationMinutes', { count: technique.defaultDurationMinutes })}
        </span>

        <button
          type="button"
          onClick={() => onStart(technique.id)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 bg-calm-primary text-slate-900 hover:bg-emerald-400 shadow-sm transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          <span>{t('breathingCardStart')}</span>
        </button>
      </div>
    </div>
  );
};
