import React from 'react';
import { Check, Calendar, Clock, Hourglass, Flag, Pencil, Trash2 } from 'lucide-react';
import { Task, TaskPriority } from '../../types/task';
import { useLocale } from '../../context/LocaleContext';

interface TaskItemProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggleStatus,
  onEdit,
  onDelete,
}) => {
  const { t } = useLocale();
  const isCompleted = task.status === 'completed';

  const priorityLabels: Record<TaskPriority, string> = {
    low: t('priorityLow'),
    medium: t('priorityMedium'),
    high: t('priorityHigh'),
  };

  const priorityBadges: Record<TaskPriority, string> = {
    low: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };

  return (
    <div
      className={`group p-4 rounded-2xl bg-calm-card border transition-all ${
        isCompleted
          ? 'border-calm-border/60 opacity-75'
          : 'border-calm-border hover:border-calm-border/80 shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Completion Checkbox */}
        <button
          type="button"
          onClick={() => onToggleStatus(task.id)}
          aria-label={isCompleted ? t('markIncomplete') : t('markComplete')}
          title={isCompleted ? t('markIncomplete') : t('markComplete')}
          className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
            isCompleted
              ? 'bg-calm-primary border-calm-primary text-white'
              : 'border-calm-border bg-calm-surface text-transparent hover:border-calm-primary/60'
          }`}
        >
          <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isCompleted ? 'opacity-100' : 'opacity-0'}`} />
        </button>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={`text-sm font-medium leading-snug break-words ${
                isCompleted
                  ? 'line-through text-calm-muted'
                  : 'text-calm-text'
              }`}
            >
              {task.title}
            </h4>

            {/* Action Buttons (Edit & Delete) */}
            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={t('edit')}
                title={t('edit')}
                className="p-1 rounded-md text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-calm-primary"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task)}
                aria-label={t('delete')}
                title={t('delete')}
                className="p-1 rounded-md text-calm-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Description if present */}
          {task.description && (
            <p className="text-xs text-calm-muted leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          {/* Badges row: Priority, Due Date/Time, Duration */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Priority Badge (Color + Icon + Label: strictly meets accessibility) */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                priorityBadges[task.priority]
              }`}
            >
              <Flag className="w-3 h-3" aria-hidden="true" />
              <span>{priorityLabels[task.priority]}</span>
            </span>

            {/* Due Date & Time */}
            {(task.dueDate || task.dueTime) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-calm-surface text-calm-muted border border-calm-border">
                {task.dueDate && (
                  <>
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    <span>{task.dueDate}</span>
                  </>
                )}
                {task.dueTime && (
                  <>
                    <Clock className="w-3 h-3 ms-1" aria-hidden="true" />
                    <span>{task.dueTime}</span>
                  </>
                )}
              </span>
            )}

            {/* Estimated Duration */}
            {task.estimatedDurationMinutes !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-calm-surface text-calm-muted border border-calm-border">
                <Hourglass className="w-3 h-3" aria-hidden="true" />
                <span>{task.estimatedDurationMinutes}m</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
