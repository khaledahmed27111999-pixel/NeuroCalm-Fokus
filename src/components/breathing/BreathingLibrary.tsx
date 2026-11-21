/**
 * NeuroCalm & Fokus — Breathing Library Component
 * Phase 3A: Complete respiratory catalog browser with goal filters,
 * comfort safety guidance, and non-respiratory ambient alternatives.
 */

import React, { useState } from 'react';
import { Wind, ShieldAlert, Headphones } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useBreathing } from '../../context/BreathingContext';
import { getTechniquesByGoal } from '../../data/breathingTechniques';
import { GoalFilterBar } from './GoalFilterBar';
import { BreathingTechniqueCard } from './BreathingTechniqueCard';

export interface BreathingLibraryProps {
  onNavigateToSoundscapes: () => void;
}

export const BreathingLibrary: React.FC<BreathingLibraryProps> = ({
  onNavigateToSoundscapes,
}) => {
  const { t } = useLocale();
  const { startSetup } = useBreathing();
  const [selectedGoal, setSelectedGoal] = useState<string>('all');

  const filteredTechniques = getTechniquesByGoal(selectedGoal);

  return (
    <div className="space-y-6 text-start">
      {/* Library Title & Subtitle Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
            <Wind className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('breathingLibraryTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('breathingLibrarySubtitle')}
            </p>
          </div>
        </div>

        {/* Comfort-First Safety Notice Callout */}
        <div className="mt-5 p-3.5 rounded-xl bg-calm-surface/80 border border-calm-border/70 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-calm-muted/90 leading-relaxed">
            {t('breathingSafetyDisclaimer')}
          </p>
        </div>
      </div>

      {/* Goal Filter Carousel */}
      <div className="space-y-2">
        <GoalFilterBar
          selectedGoal={selectedGoal}
          onSelectGoal={setSelectedGoal}
        />
      </div>

      {/* Techniques Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTechniques.map((technique) => (
          <BreathingTechniqueCard
            key={technique.id}
            technique={technique}
            onStart={startSetup}
          />
        ))}
      </div>

      {/* Somatic / Breath-Aversion Alternative: Ambient Soundscapes */}
      <div className="p-5 rounded-2xl bg-calm-card border border-calm-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 mt-0.5 sm:mt-0">
            <Headphones className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-calm-text">
              {t('breathingAmbientAlternativeTitle')}
            </h3>
            <p className="text-xs text-calm-muted mt-0.5 leading-relaxed">
              {t('breathingAmbientAlternativeDesc')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToSoundscapes}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-calm-surface hover:bg-calm-surface/80 text-calm-text border border-calm-border hover:border-calm-border/80 transition-colors whitespace-nowrap shrink-0 self-end sm:self-center"
        >
          {t('breathingAmbientAlternativeAction')}
        </button>
      </div>
    </div>
  );
};
