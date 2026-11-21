import React from 'react';
import { Target, CheckCircle2, X } from 'lucide-react';
import { Task, TaskPriority } from '../../types/task';
import { useLocale } from '../../context/LocaleContext';

interface FocusTaskSelectorProps {
  tasks: Task[];
  selectedTaskId?: string;
  onSelectTaskId: (taskId?: string) => void;
}

export const FocusTaskSelector: React.FC<FocusTaskSelectorProps> = ({
  tasks,
  selectedTaskId,
  onSelectTaskId,
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

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const selectedTask = activeTasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="focus-task-select"
          className="text-xs font-semibold uppercase tracking-wider text-calm-muted flex items-center gap-1.5"
        >
          <Target className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
          {t('linkTaskOptional')}
        </label>

        {selectedTaskId && (
          <button
            type="button"
            onClick={() => onSelectTaskId(undefined)}
            className="text-xs text-calm-muted hover:text-calm-text flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            {t('clearLinkedTask')}
          </button>
        )}
      </div>

      <div className="relative">
        <select
          id="focus-task-select"
          value={selectedTaskId || ''}
          onChange={(e) => onSelectTaskId(e.target.value || undefined)}
          className="w-full py-2.5 px-3 bg-calm-surface border border-calm-border rounded-xl text-sm text-calm-text focus:outline-none focus:ring-2 focus:ring-calm-primary/50 transition-colors cursor-pointer appearance-none pe-8"
        >
          <option value="">{t('noLinkedTask')}</option>
          {activeTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} ({priorityLabels[task.priority]})
            </option>
          ))}
        </select>
      </div>

      {selectedTask && (
        <div className="p-3 rounded-xl bg-calm-surface/60 border border-calm-border/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-calm-primary shrink-0" aria-hidden="true" />
            <span className="font-medium text-calm-text truncate">{selectedTask.title}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${
              priorityBadges[selectedTask.priority]
            }`}
          >
            {priorityLabels[selectedTask.priority]}
          </span>
        </div>
      )}
    </div>
  );
};
