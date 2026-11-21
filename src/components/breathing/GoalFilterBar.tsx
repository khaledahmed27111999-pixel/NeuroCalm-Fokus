/**
 * NeuroCalm & Fokus — Goal Filter Bar
 * Phase 3A: Interactive goal categories for discovering relevant breathing exercises.
 */

import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import { BREATHING_GOALS } from '../../data/breathingTechniques';

export interface GoalFilterBarProps {
  selectedGoal: string;
  onSelectGoal: (goalId: string) => void;
}

export const GoalFilterBar: React.FC<GoalFilterBarProps> = ({
  selectedGoal,
  onSelectGoal,
}) => {
  const { t } = useLocale();

  return (
    <div
      role="tablist"
      aria-label={t('breathingLibraryTitle')}
      className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar text-start"
    >
      {/* 'All' Filter Pill */}
      <button
        type="button"
        role="tab"
        aria-selected={selectedGoal === 'all'}
        onClick={() => onSelectGoal('all')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-150 shrink-0 ${
          selectedGoal === 'all'
            ? 'bg-calm-primary text-slate-900 shadow-sm font-semibold'
            : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-surface/80 border border-calm-border/60'
        }`}
      >
        {t('breathingFilterAll')}
      </button>

      {/* Goal Filter Pills */}
      {BREATHING_GOALS.map((goal) => {
        const isSelected = selectedGoal === goal.id;
        return (
          <button
            key={goal.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectGoal(goal.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-150 shrink-0 ${
              isSelected
                ? 'bg-calm-primary text-slate-900 shadow-sm font-semibold'
                : 'bg-calm-surface text-calm-muted hover:text-calm-text hover:bg-calm-surface/80 border border-calm-border/60'
            }`}
          >
            {t(goal.nameKey as any)}
          </button>
        );
      })}
    </div>
  );
};
