import React, { useState, useMemo } from 'react';
import { CalendarCheck2, Sparkles, CheckSquare, LayoutDashboard } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useTasks } from '../hooks/useTasks';
import { useTaskFilter } from '../hooks/useTaskFilter';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types/task';
import { PlanSubView } from '../types/dashboard';
import { computeDashboardMetrics } from '../utils/dashboardMetrics';
import { QuickAddTask } from '../components/tasks/QuickAddTask';
import { DetailedTaskForm } from '../components/tasks/DetailedTaskForm';
import { DeleteConfirmDialog } from '../components/tasks/DeleteConfirmDialog';
import { TaskList } from '../components/tasks/TaskList';
import { TaskFilterBar } from '../components/tasks/TaskFilterBar';
import { DashboardView } from '../components/dashboard/DashboardView';
import { useWisdom } from '../hooks/useWisdom';

export const PlanView: React.FC = () => {
  const { t, locale } = useLocale();
  const { triggerWisdom } = useWisdom();
  const {
    tasks,
    storageStatus,
    createQuickTask,
    createDetailedTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
  } = useTasks(triggerWisdom);

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    isFiltered,
    resetFilters,
    filteredTasks,
  } = useTaskFilter(tasks, locale);

  const [activeSubView, setActiveSubView] = useState<PlanSubView>('tasks');
  const [shouldFocusQuickAdd, setShouldFocusQuickAdd] = useState(false);
  const [isDetailedFormOpen, setIsDetailedFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const metrics = useMemo(() => computeDashboardMetrics(tasks), [tasks]);

  const handleOpenDetailedAdd = () => {
    setEditingTask(null);
    setIsDetailedFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailedFormOpen(true);
  };

  const handleSaveDetailed = (data: CreateTaskInput | UpdateTaskInput): boolean => {
    if (editingTask) {
      return updateTask(editingTask.id, data as UpdateTaskInput);
    } else {
      return createDetailedTask(data as CreateTaskInput);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingTask) {
      deleteTask(deletingTask.id);
      setDeletingTask(null);
    }
  };

  const handleNavigateToCreateTask = () => {
    setActiveSubView('tasks');
    setShouldFocusQuickAdd(true);
  };

  // Derive active and completed sets from filtered/sorted tasks
  const activeFilteredTasks = filteredTasks.filter((t) => t.status !== 'completed');
  const completedFilteredTasks = filteredTasks.filter((t) => t.status === 'completed');

  return (
    <div
      role="tabpanel"
      id="panel-plan"
      aria-labelledby="tab-plan"
      className="space-y-6"
    >
      {/* Pillar Introduction Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-calm-primary border border-emerald-500/20">
            <CalendarCheck2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-2 flex-1">
            <h2 className="text-xl sm:text-2xl font-semibold text-calm-text">
              {t('planTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('planDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Philosophy Callout */}
      <div className="p-5 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3.5">
        <Sparkles className="w-5 h-5 text-calm-primary shrink-0" aria-hidden="true" />
        <p className="text-sm text-calm-text font-medium">
          {t('actionReturnMessage')}
        </p>
      </div>

      {/* Plan Sub-Navigation (Tasks vs Dashboard) */}
      <div className="flex justify-center sm:justify-start">
        <div
          role="tablist"
          aria-label={t('tasksSectionTitle')}
          className="flex items-center gap-1.5 p-1 rounded-xl bg-calm-surface border border-calm-border"
        >
          <button
            type="button"
            role="tab"
            id="subtab-tasks"
            aria-selected={activeSubView === 'tasks'}
            aria-controls="subpanel-tasks"
            tabIndex={activeSubView === 'tasks' ? 0 : -1}
            onClick={() => setActiveSubView('tasks')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
              activeSubView === 'tasks'
                ? 'bg-calm-primary text-white shadow-sm'
                : 'text-calm-muted hover:text-calm-text hover:bg-calm-card/60'
            }`}
          >
            <CheckSquare className="w-4 h-4" aria-hidden="true" />
            <span>{t('subviewTasks')}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="subtab-dashboard"
            aria-selected={activeSubView === 'dashboard'}
            aria-controls="subpanel-dashboard"
            tabIndex={activeSubView === 'dashboard' ? 0 : -1}
            onClick={() => setActiveSubView('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
              activeSubView === 'dashboard'
                ? 'bg-calm-primary text-white shadow-sm'
                : 'text-calm-muted hover:text-calm-text hover:bg-calm-card/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>{t('subviewDashboard')}</span>
          </button>
        </div>
      </div>

      {/* Subview Content */}
      {activeSubView === 'tasks' ? (
        <div
          id="subpanel-tasks"
          role="tabpanel"
          aria-labelledby="subtab-tasks"
          className="space-y-5"
        >
          {/* Quick Add Task Input */}
          <QuickAddTask
            onAdd={createQuickTask}
            onOpenDetailed={handleOpenDetailedAdd}
            autoFocus={shouldFocusQuickAdd}
            onFocused={() => setShouldFocusQuickAdd(false)}
          />

          {/* Task Discovery & Organization Bar */}
          {(tasks.length > 0 || isFiltered) && (
            <TaskFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriorityChange={setPriorityFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              isFiltered={isFiltered}
              onReset={resetFilters}
            />
          )}

          {/* Task List (Filtered Active & Completed) */}
          <TaskList
            activeTasks={activeFilteredTasks}
            completedTasks={completedFilteredTasks}
            storageStatus={storageStatus}
            isFiltered={isFiltered}
            onResetFilters={resetFilters}
            onToggleStatus={toggleTaskStatus}
            onEdit={handleEditTask}
            onDelete={setDeletingTask}
          />
        </div>
      ) : (
        <div
          id="subpanel-dashboard"
          role="tabpanel"
          aria-labelledby="subtab-dashboard"
        >
          <DashboardView
            metrics={metrics}
            onToggleStatus={toggleTaskStatus}
            onNavigateToCreateTask={handleNavigateToCreateTask}
          />
        </div>
      )}

      {/* Detailed Task Form (Create & Edit) */}
      <DetailedTaskForm
        isOpen={isDetailedFormOpen}
        initialData={editingTask || undefined}
        onSave={handleSaveDetailed}
        onCancel={() => {
          setIsDetailedFormOpen(false);
          setEditingTask(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deletingTask}
        taskTitle={deletingTask?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTask(null)}
      />
    </div>
  );
};
