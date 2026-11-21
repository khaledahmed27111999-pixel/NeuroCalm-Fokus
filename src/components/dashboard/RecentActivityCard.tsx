import React from 'react';
import { History, Check } from 'lucide-react';
import { DashboardMetrics } from '../../types/dashboard';
import { useLocale } from '../../context/LocaleContext';
import { formatRelativeTime } from '../../utils/dashboardMetrics';

interface RecentActivityCardProps {
  metrics: DashboardMetrics;
  onToggleStatus: (id: string) => void;
}

export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  metrics,
  onToggleStatus,
}) => {
  const { t, locale } = useLocale();

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-calm-text flex items-center gap-2">
          <History className="w-5 h-5 text-calm-primary" aria-hidden="true" />
          {t('recentActivity')}
        </h3>
      </div>

      {metrics.recentActivityTasks.length > 0 ? (
        <ul className="space-y-2.5">
          {metrics.recentActivityTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            return (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-calm-surface border border-calm-border hover:border-calm-border/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Completion toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleStatus(task.id)}
                    aria-label={isCompleted ? t('markIncomplete') : t('markComplete')}
                    title={isCompleted ? t('markIncomplete') : t('markComplete')}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                      isCompleted
                        ? 'bg-calm-primary border-calm-primary text-white'
                        : 'border-calm-border bg-calm-card text-transparent hover:border-calm-primary/60'
                    }`}
                  >
                    <Check
                      className={`w-3 h-3 stroke-[2.5] ${
                        isCompleted ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-medium truncate ${
                        isCompleted
                          ? 'line-through text-calm-muted'
                          : 'text-calm-text'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="block text-xs text-calm-muted/80 mt-0.5">
                      {formatRelativeTime(task.updatedAt, locale)}
                    </span>
                  </div>
                </div>

                {/* Status indicator pill */}
                <span
                  className={`px-2 py-0.5 text-xs rounded-full border shrink-0 font-medium ${
                    isCompleted
                      ? 'bg-emerald-500/10 text-calm-primary border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}
                >
                  {isCompleted ? t('statusCompleted') : t('statusTodo')}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="py-6 text-center">
          <p className="text-xs text-calm-muted">{t('noRecentActivity')}</p>
        </div>
      )}
    </div>
  );
};
