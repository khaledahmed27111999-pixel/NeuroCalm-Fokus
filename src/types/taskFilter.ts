import { TaskPriority } from './task';

export type TaskStatusFilter = 'all' | 'active' | 'completed';
export type TaskPriorityFilter = 'all' | TaskPriority;
export type TaskSortOption =
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'dueDate_asc'
  | 'priority_desc'
  | 'alphabetical';

export interface TaskFilterCriteria {
  searchQuery: string;
  statusFilter: TaskStatusFilter;
  priorityFilter: TaskPriorityFilter;
  sortBy: TaskSortOption;
}
