import React from 'react';
import { Calendar, Clock, Check, CalendarDays, AlertTriangle } from 'lucide-react';
import { Task, TaskPriority } from '../../types/task';
import { DashboardMetrics } from '../../types/dashboard';
import { useLocale } from '../../context/LocaleContext';

interface UpcomingDeadlinesCardProps {
  metrics: DashboardMetrics;
  onToggleStatus: (id: string) => void;
}

export const UpcomingDeadlinesCard: React.FC<UpcomingDeadlinesCardProps> = ({
  metrics,
  onToggleStatus,
}) => {
  const { t } = useLocale();

  const priorityBadges: Record<TaskPriority, string> = {
    low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };

  const priorityLabels: Record<TaskPriority, string> = {
    low: t('priorityLow'),
    medium: t('priorityMedium'),
    high: t('priorityHigh'),
  };

  const hasAnyDeadlineTask =
    metrics.pastTargetDateTasks.length > 0 ||
    metrics.todayTasks.length > 0 ||
    metrics.next7DaysTasks.length > 0;

  const renderTaskItem = (task: Task, isPast: boolean = false) => {
    return (
      <li
        key={task.id}
        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-calm-surface border border-calm-border hover:border-calm-border/80 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Checkbox button */}
          <button
            type="button"
            onClick={() => onToggleStatus(task.id)}
            aria-label={t('markComplete')}
            title={t('markComplete')}
            className="w-4 h-4 rounded-md border border-calm-border bg-calm-card text-transparent hover:border-calm-primary/60 flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
          >
            <Check className="w-3 h-3 stroke-[2.5] opacity-0 group-hover:opacity-100" />
          </button>

          <div className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-calm-text truncate">
              {task.title}
            </span>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-calm-muted flex-wrap">
              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    isPast ? 'text-amber-400/90 font-medium' : ''
                  }`}
                >
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  {task.dueDate}
                </span>
              )}
              {task.dueTime && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {task.dueTime}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Priority Badge */}
        <span
          className={`px-2 py-0.5 text-xs rounded-full border shrink-0 font-medium ${
            priorityBadges[task.priority]
          }`}
        >
          {priorityLabels[task.priority]}
        </span>
      </li>
    );
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-calm-text flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-calm-primary" aria-hidden="true" />
          {t('upcomingDeadlines')}
        </h3>
      </div>

      {hasAnyDeadlineTask ? (
        <div className="space-y-4">
          {/* Past Target Date Group */}
          {metrics.pastTargetDateTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                {t('pastTargetDate')} ({metrics.pastTargetDateTasks.length})
              </h4>
              <ul className="space-y-2">
                {metrics.pastTargetDateTasks.map((t) => renderTaskItem(t, true))}
              </ul>
            </div>
          )}

          {/* Today Group */}
          {metrics.todayTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-calm-primary uppercase tracking-wider">
                {t('deadlineToday')} ({metrics.todayTasks.length})
              </h4>
              <ul className="space-y-2">
                {metrics.todayTasks.map((t) => renderTaskItem(t, false))}
              </ul>
            </div>
          )}

          {/* Next 7 Days Group */}
          {metrics.next7DaysTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                {t('deadlineNext7Days')} ({metrics.next7DaysTasks.length})
              </h4>
              <ul className="space-y-2">
                {metrics.next7DaysTasks.map((t) => renderTaskItem(t, false))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="py-6 text-center space-y-1">
          <p className="text-sm font-medium text-calm-text">
            {t('noTasksInDeadlineWindow')}
          </p>
        </div>
      )}

      {/* Calm footnote for distant or undated active tasks */}
      {metrics.distantOrUndatedActiveCount > 0 && (
        <div className="pt-2 border-t border-calm-border/60 text-xs text-calm-muted text-center sm:text-start">
          {t('distantOrUndatedNote', {
            count: metrics.distantOrUndatedActiveCount,
          })}
        </div>
      )}
    </div>
  );
};
