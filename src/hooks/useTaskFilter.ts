import { useState, useMemo, useCallback } from 'react';
import { Task } from '../types/task';
import {
  TaskStatusFilter,
  TaskPriorityFilter,
  TaskSortOption,
  TaskFilterCriteria,
} from '../types/taskFilter';
import { filterAndSortTasks } from '../utils/taskFilter';

export function useTaskFilter(tasks: Task[], locale: string = 'en') {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>('all');
  const [sortBy, setSortBy] = useState<TaskSortOption>('createdAt_desc');

  const criteria: TaskFilterCriteria = useMemo(
    () => ({
      searchQuery,
      statusFilter,
      priorityFilter,
      sortBy,
    }),
    [searchQuery, statusFilter, priorityFilter, sortBy]
  );

  const isFiltered = useMemo(() => {
    return Boolean(
      searchQuery.trim().length > 0 ||
        statusFilter !== 'all' ||
        priorityFilter !== 'all' ||
        sortBy !== 'createdAt_desc'
    );
  }, [searchQuery, statusFilter, priorityFilter, sortBy]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim().length > 0) count++;
    if (statusFilter !== 'all') count++;
    if (priorityFilter !== 'all') count++;
    if (sortBy !== 'createdAt_desc') count++;
    return count;
  }, [searchQuery, statusFilter, priorityFilter, sortBy]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSortBy('createdAt_desc');
  }, []);

  const filteredTasks = useMemo(() => {
    return filterAndSortTasks(tasks, criteria, locale);
  }, [tasks, criteria, locale]);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    isFiltered,
    activeFilterCount,
    resetFilters,
    filteredTasks,
  };
}
