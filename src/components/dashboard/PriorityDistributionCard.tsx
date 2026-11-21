import React from 'react';
import { Flag } from 'lucide-react';
import { DashboardMetrics } from '../../types/dashboard';
import { useLocale } from '../../context/LocaleContext';

interface PriorityDistributionCardProps {
  metrics: DashboardMetrics;
}

export const PriorityDistributionCard: React.FC<PriorityDistributionCardProps> = ({ metrics }) => {
  const { t } = useLocale();
  const total = metrics.activeTasksCount;

  const highPct = total > 0 ? (metrics.highPriorityCount / total) * 100 : 0;
  const medPct = total > 0 ? (metrics.mediumPriorityCount / total) * 100 : 0;
  const lowPct = total > 0 ? (metrics.lowPriorityCount / total) * 100 : 0;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-calm-text flex items-center gap-2">
          <Flag className="w-4 h-4 text-calm-primary" aria-hidden="true" />
          {t('priorityBreakdown')}
        </h3>
        <span className="text-xs text-calm-muted">
          {total} {t('activeTasksMetric')}
        </span>
      </div>

      {/* Subtle Proportional Distribution Bar */}
      {total > 0 ? (
        <div className="space-y-3">
          <div className="h-2 w-full rounded-full bg-calm-surface overflow-hidden flex border border-calm-border/60">
            {highPct > 0 && (
              <div
                style={{ width: `${highPct}%` }}
                className="bg-amber-500/80 transition-all duration-300"
                title={`${metrics.highPriorityCount} High`}
              />
            )}
            {medPct > 0 && (
              <div
                style={{ width: `${medPct}%` }}
                className="bg-blue-500/80 transition-all duration-300"
                title={`${metrics.mediumPriorityCount} Medium`}
              />
            )}
            {lowPct > 0 && (
              <div
                style={{ width: `${lowPct}%` }}
                className="bg-slate-400/60 transition-all duration-300"
                title={`${metrics.lowPriorityCount} Low`}
              />
            )}
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 rounded-lg bg-calm-surface border border-calm-border">
              <span className="block text-xs font-medium text-amber-400">
                {t('priorityHigh')}
              </span>
              <span className="text-sm font-semibold text-calm-text mt-0.5 block">
                {metrics.highPriorityCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-calm-surface border border-calm-border">
              <span className="block text-xs font-medium text-blue-400">
                {t('priorityMedium')}
              </span>
              <span className="text-sm font-semibold text-calm-text mt-0.5 block">
                {metrics.mediumPriorityCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-calm-surface border border-calm-border">
              <span className="block text-xs font-medium text-slate-400">
                {t('priorityLow')}
              </span>
              <span className="text-sm font-semibold text-calm-text mt-0.5 block">
                {metrics.lowPriorityCount}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-calm-muted text-center py-4">
          {t('emptyActiveTasks')}
        </p>
      )}
    </div>
  );
};
