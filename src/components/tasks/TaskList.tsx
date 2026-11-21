import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  SearchX,
  RotateCcw,
} from 'lucide-react';
import { Task, StorageStatus } from '../../types/task';
import { useLocale } from '../../context/LocaleContext';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  activeTasks: Task[];
  completedTasks: Task[];
  storageStatus: StorageStatus;
  isFiltered?: boolean;
  onResetFilters?: () => void;
  onToggleStatus: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  activeTasks,
  completedTasks,
  storageStatus,
  isFiltered = false,
  onResetFilters,
  onToggleStatus,
  onEdit,
  onDelete,
}) => {
  const { t } = useLocale();
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  const hasNoMatchingTasks = isFiltered && activeTasks.length === 0 && completedTasks.length === 0;

  return (
    <div className="space-y-6">
      {/* Storage Status Warnings if storage failed or corrupted data backed up */}
      {!storageStatus.isPersistent && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
          <span>{t('storageNotPersistentWarning')}</span>
        </div>
      )}

      {storageStatus.hasCorruptedDataWarning && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" aria-hidden="true" />
          <span>{t('storageCorruptedWarning')}</span>
        </div>
      )}

      {/* Empty Search State */}
      {hasNoMatchingTasks ? (
        <div className="p-8 rounded-2xl border border-dashed border-calm-border bg-calm-card/40 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-calm-surface flex items-center justify-center text-calm-muted">
            <SearchX className="w-5 h-5 text-calm-muted" aria-hidden="true" />
          </div>
          <h4 className="text-sm font-semibold text-calm-text">
            {t('noSearchResultsTitle')}
          </h4>
          <p className="text-xs text-calm-muted max-w-sm mx-auto leading-relaxed">
            {t('noSearchResultsMessage')}
          </p>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-calm-surface text-calm-text border border-calm-border hover:bg-calm-card text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-calm-primary"
            >
              <RotateCcw className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
              <span>{t('resetFilters')}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Active Tasks Section */}
          <section aria-labelledby="active-tasks-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-calm-primary" aria-hidden="true" />
                <h3 id="active-tasks-heading" className="text-sm font-semibold text-calm-text">
                  {t('activeTasksTitle')}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-calm-surface text-calm-muted border border-calm-border">
                {activeTasks.length}
              </span>
            </div>

            {activeTasks.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-calm-border bg-calm-card/30 text-center space-y-2">
                <p className="text-xs sm:text-sm text-calm-muted max-w-sm mx-auto leading-relaxed">
                  {t('emptyActiveTasks')}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleStatus={onToggleStatus}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Completed Tasks Section (Collapsible) */}
          {completedTasks.length > 0 && (
            <section aria-labelledby="completed-tasks-heading" className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCompletedExpanded((prev) => !prev)}
                aria-expanded={isCompletedExpanded}
                className="w-full flex items-center justify-between py-2 text-start text-xs font-semibold text-calm-muted hover:text-calm-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-calm-primary rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  <span id="completed-tasks-heading">{t('completedTasksTitle')}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-calm-surface text-calm-muted border border-calm-border">
                    {completedTasks.length}
                  </span>
                </div>
                {isCompletedExpanded ? (
                  <ChevronDown className="w-4 h-4 text-calm-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-calm-muted rtl:rotate-180" aria-hidden="true" />
                )}
              </button>

              {isCompletedExpanded && (
                <div className="space-y-2.5 animate-fadeIn">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleStatus={onToggleStatus}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
