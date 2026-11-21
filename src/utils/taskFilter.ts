import { Task, TaskPriority } from '../types/task';
import { TaskFilterCriteria } from '../types/taskFilter';

const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Pure, deterministic utility to filter and sort tasks without mutating input data.
 */
export function filterAndSortTasks(
  tasks: Task[],
  criteria: TaskFilterCriteria,
  locale: string = 'en'
): Task[] {
  const query = criteria.searchQuery.trim().toLowerCase();

  // 1. Filter phase
  const filtered = tasks.filter((task) => {
    // Search query matching (matches title or optional description)
    if (query) {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchDesc = task.description ? task.description.toLowerCase().includes(query) : false;
      if (!matchTitle && !matchDesc) {
        return false;
      }
    }

    // Status filter
    if (criteria.statusFilter === 'active' && task.status === 'completed') {
      return false;
    }
    if (criteria.statusFilter === 'completed' && task.status !== 'completed') {
      return false;
    }

    // Priority filter
    if (criteria.priorityFilter !== 'all' && task.priority !== criteria.priorityFilter) {
      return false;
    }

    return true;
  });

  // 2. Sort phase on a derived shallow copy
  return [...filtered].sort((a, b) => {
    switch (criteria.sortBy) {
      case 'createdAt_asc': {
        // Oldest creation first
        const diff = a.createdAt - b.createdAt;
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }

      case 'dueDate_asc': {
        // Tasks with valid due dates come first, sorted chronologically
        const hasDueDateA = Boolean(a.dueDate);
        const hasDueDateB = Boolean(b.dueDate);

        if (hasDueDateA && !hasDueDateB) return -1;
        if (!hasDueDateA && hasDueDateB) return 1;

        if (hasDueDateA && hasDueDateB) {
          const keyA = `${a.dueDate}T${a.dueTime || '23:59:59'}`;
          const keyB = `${b.dueDate}T${b.dueTime || '23:59:59'}`;
          const cmp = keyA.localeCompare(keyB);
          if (cmp !== 0) return cmp;
        }

        // Secondary stable sort: newest created first
        return b.createdAt - a.createdAt;
      }

      case 'priority_desc': {
        // Highest priority first
        const diff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (diff !== 0) return diff;
        // Secondary stable sort: newest created first
        return b.createdAt - a.createdAt;
      }

      case 'alphabetical': {
        // Natural language alphabetical comparison
        const diff = a.title.localeCompare(b.title, locale, { sensitivity: 'base' });
        if (diff !== 0) return diff;
        // Secondary stable sort: newest created first
        return b.createdAt - a.createdAt;
      }

      case 'createdAt_desc':
      default: {
        // Default: newest creation first
        const diff = b.createdAt - a.createdAt;
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      }
    }
  });
}
