import React from 'react';
import { CheckCircle2, Check, Clock, AlertCircle } from 'lucide-react';
import { DashboardMetrics } from '../../types/dashboard';
import { useLocale } from '../../context/LocaleContext';
import { formatDuration } from '../../utils/dashboardMetrics';

interface WorkloadSummaryCardProps {
  metrics: DashboardMetrics;
}

export const WorkloadSummaryCard: React.FC<WorkloadSummaryCardProps> = ({ metrics }) => {
  const { t, locale } = useLocale();

  const formattedEstimated =
    metrics.totalEstimatedMinutes > 0
      ? formatDuration(metrics.totalEstimatedMinutes, locale)
      : t('noEstimatedTime');

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-5">
      {/* Header with Title and Ratio Note */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-calm-text">
            {t('workloadOverview')}
          </h3>
          <p className="text-xs sm:text-sm text-calm-muted mt-0.5">
            {t('workloadRatio', {
              completed: metrics.completedTasksCount,
              total: metrics.totalTasks,
            })}
          </p>
        </div>
      </div>

      {/* 4 Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Tasks */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-xl sm:text-2xl font-semibold text-calm-text leading-tight">
              {metrics.activeTasksCount}
            </span>
            <span className="block text-xs text-calm-muted truncate">
              {t('activeTasksMetric')}
            </span>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 text-calm-primary shrink-0">
            <Check className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-xl sm:text-2xl font-semibold text-calm-text leading-tight">
              {metrics.completedTasksCount}
            </span>
            <span className="block text-xs text-calm-muted truncate">
              {t('completedTasksMetric')}
            </span>
          </div>
        </div>

        {/* High-Priority Tasks */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-xl sm:text-2xl font-semibold text-calm-text leading-tight">
              {metrics.highPriorityCount}
            </span>
            <span className="block text-xs text-calm-muted truncate">
              {t('highPriorityTasksMetric')}
            </span>
          </div>
        </div>

        {/* Estimated Time (Active) */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-base sm:text-lg font-semibold text-calm-text leading-tight truncate">
              {formattedEstimated}
            </span>
            <span
              className="block text-xs text-calm-muted truncate"
              title={t('estimatedTimeDescription')}
            >
              {t('estimatedTimeTitle')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
