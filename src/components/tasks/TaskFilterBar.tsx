import React from 'react';
import { Search, X, RotateCcw, Filter, ArrowUpDown } from 'lucide-react';
import { TaskStatusFilter, TaskPriorityFilter, TaskSortOption } from '../../types/taskFilter';
import { useLocale } from '../../context/LocaleContext';

interface TaskFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: TaskStatusFilter;
  onStatusChange: (status: TaskStatusFilter) => void;
  priorityFilter: TaskPriorityFilter;
  onPriorityChange: (priority: TaskPriorityFilter) => void;
  sortBy: TaskSortOption;
  onSortChange: (sort: TaskSortOption) => void;
  isFiltered: boolean;
  onReset: () => void;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  sortBy,
  onSortChange,
  isFiltered,
  onReset,
}) => {
  const { t } = useLocale();

  return (
    <div className="space-y-2.5 p-3 rounded-2xl bg-calm-card/70 border border-calm-border/80">
      {/* Search Input Field */}
      <div className="relative flex items-center">
        <div className="absolute start-3 pointer-events-none text-calm-muted">
          <Search className="w-4 h-4" aria-hidden="true" />
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAriaLabel')}
          className="w-full ps-9 pe-8 py-2 text-xs sm:text-sm rounded-xl bg-calm-surface border border-calm-border text-calm-text placeholder:text-calm-muted/60 focus:outline-none focus:ring-2 focus:ring-calm-primary/40 focus:border-calm-primary transition-all"
        />

        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('clearSearch')}
            title={t('clearSearch')}
            className="absolute end-2.5 p-1 rounded-md text-calm-muted hover:text-calm-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-calm-primary"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filter and Sort Selectors (Compact & Responsive) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[120px]">
          <span className="text-calm-muted text-[11px] font-medium hidden sm:inline">
            <Filter className="w-3 h-3 inline me-0.5" aria-hidden="true" />
          </span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as TaskStatusFilter)}
            aria-label={t('filterStatus')}
            className="w-full py-1.5 px-2.5 rounded-lg bg-calm-surface text-calm-text border border-calm-border text-xs focus:outline-none focus:ring-2 focus:ring-calm-primary/40"
          >
            <option value="all">{t('filterStatusAll')}</option>
            <option value="active">{t('filterStatusActive')}</option>
            <option value="completed">{t('filterStatusCompleted')}</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[120px]">
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityChange(e.target.value as TaskPriorityFilter)}
            aria-label={t('taskPriorityLabel')}
            className="w-full py-1.5 px-2.5 rounded-lg bg-calm-surface text-calm-text border border-calm-border text-xs focus:outline-none focus:ring-2 focus:ring-calm-primary/40"
          >
            <option value="all">{t('filterPriorityAll')}</option>
            <option value="high">{t('priorityHigh')}</option>
            <option value="medium">{t('priorityMedium')}</option>
            <option value="low">{t('priorityLow')}</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[130px]">
          <span className="text-calm-muted text-[11px] font-medium hidden sm:inline">
            <ArrowUpDown className="w-3 h-3 inline me-0.5" aria-hidden="true" />
          </span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as TaskSortOption)}
            aria-label={t('sortByLabel')}
            className="w-full py-1.5 px-2.5 rounded-lg bg-calm-surface text-calm-text border border-calm-border text-xs focus:outline-none focus:ring-2 focus:ring-calm-primary/40"
          >
            <option value="createdAt_desc">{t('sortNewest')}</option>
            <option value="createdAt_asc">{t('sortOldest')}</option>
            <option value="dueDate_asc">{t('sortDueDate')}</option>
            <option value="priority_desc">{t('sortPriority')}</option>
            <option value="alphabetical">{t('sortAlphabetical')}</option>
          </select>
        </div>

        {/* Reset Filters Action */}
        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-calm-surface text-calm-muted hover:text-calm-text border border-calm-border hover:border-calm-primary/40 text-xs font-medium transition-colors ms-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-calm-primary"
          >
            <RotateCcw className="w-3 h-3 text-calm-primary" aria-hidden="true" />
            <span>{t('resetFilters')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
