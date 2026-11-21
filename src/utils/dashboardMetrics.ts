import { Task } from '../types/task';
import { DashboardMetrics } from '../types/dashboard';

/**
 * Format a Date object into a local 'YYYY-MM-DD' calendar string.
 * Uses local calendar getters to remain timezone-agnostic and avoid UTC offsets.
 */
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add calendar days to a Date object using calendar date arithmetic.
 * Avoids raw millisecond manipulation to remain safe across Daylight Saving Time shifts.
 */
export function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Deterministic comparison for deadline-sorted tasks:
 * 1. dueDate ascending (oldest / nearest first).
 * 2. Explicit dueTime presence: tasks with dueTime appear before tasks without.
 * 3. dueTime ascending (earliest in the day first).
 * 4. Secondary tie-breaker: createdAt descending (newer tasks first).
 * 5. Final deterministic tie-breaker: task id.
 */
export function compareDeadlines(a: Task, b: Task): number {
  const dateA = a.dueDate || '';
  const dateB = b.dueDate || '';
  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  // Explicit time presence
  if (a.dueTime && !b.dueTime) return -1;
  if (!a.dueTime && b.dueTime) return 1;

  // Time value
  if (a.dueTime && b.dueTime) {
    const timeComp = a.dueTime.localeCompare(b.dueTime);
    if (timeComp !== 0) return timeComp;
  }

  // Secondary tie-breaker: newest createdAt
  if (b.createdAt !== a.createdAt) {
    return b.createdAt - a.createdAt;
  }

  // Final stable tie-breaker: id
  return a.id.localeCompare(b.id);
}

/**
 * Format relative time calmly based on local elapsed milliseconds.
 */
export function formatRelativeTime(
  timestamp: number,
  locale: 'en' | 'ar',
  referenceNow: number = Date.now()
): string {
  const diffMs = Math.max(0, referenceNow - timestamp);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return locale === 'ar' ? 'الآن' : 'Just now';
  }
  if (diffHours < 1) {
    return locale === 'ar' ? `منذ ${diffMinutes} د` : `${diffMinutes}m ago`;
  }
  if (diffDays < 1) {
    return locale === 'ar' ? `منذ ${diffHours} س` : `${diffHours}h ago`;
  }
  return locale === 'ar' ? `منذ ${diffDays} ي` : `${diffDays}d ago`;
}

/**
 * Format total minutes into a human-readable, non-stressful duration string.
 */
export function formatDuration(minutes: number, locale: 'en' | 'ar'): string {
  if (minutes <= 0) {
    return locale === 'ar' ? '0 د' : '0m';
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return locale === 'ar' ? `${remainingMinutes} د` : `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return locale === 'ar' ? `${hours} س` : `${hours}h`;
  }

  return locale === 'ar'
    ? `${hours} س ${remainingMinutes} د`
    : `${hours}h ${remainingMinutes}m`;
}

/**
 * Compute all dashboard metrics deterministically from the current task list.
 * Accepts an injectable reference Date for testing boundaries and time shifts.
 */
export function computeDashboardMetrics(
  tasks: Task[],
  referenceDate: Date = new Date()
): DashboardMetrics {
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const activeTasksCount = activeTasks.length;
  const completedTasksCount = completedTasks.length;

  const highPriorityCount = activeTasks.filter((t) => t.priority === 'high').length;
  const mediumPriorityCount = activeTasks.filter((t) => t.priority === 'medium').length;
  const lowPriorityCount = activeTasks.filter((t) => t.priority === 'low').length;

  const totalEstimatedMinutes = activeTasks.reduce(
    (sum, t) => sum + (t.estimatedDurationMinutes || 0),
    0
  );

  const todayStr = formatLocalDateString(referenceDate);
  const windowEnd = addDaysToDate(referenceDate, 7);
  const windowEndStr = formatLocalDateString(windowEnd);

  // Past Target Date: active tasks with dueDate strictly before today
  const pastTargetDateTasks = activeTasks
    .filter((t) => t.dueDate && t.dueDate < todayStr)
    .sort(compareDeadlines);

  // Today: active tasks with dueDate matching today
  const todayTasks = activeTasks
    .filter((t) => t.dueDate === todayStr)
    .sort(compareDeadlines);

  // Next 7 Days: active tasks from tomorrow through the 7th following day (inclusive)
  const next7DaysTasks = activeTasks
    .filter((t) => t.dueDate && t.dueDate > todayStr && t.dueDate <= windowEndStr)
    .sort(compareDeadlines);

  // Active tasks with deadlines outside the 7-day window or with no target date
  const distantOrUndatedActiveCount = activeTasks.filter(
    (t) => !t.dueDate || t.dueDate > windowEndStr
  ).length;

  // Recent Activity: top 3 most recently updated tasks across all statuses
  const recentActivityTasks = [...tasks]
    .sort((a, b) => {
      if (b.updatedAt !== a.updatedAt) {
        return b.updatedAt - a.updatedAt;
      }
      if (b.createdAt !== a.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return a.id.localeCompare(b.id);
    })
    .slice(0, 3);

  return {
    totalTasks,
    activeTasksCount,
    completedTasksCount,
    highPriorityCount,
    mediumPriorityCount,
    lowPriorityCount,
    totalEstimatedMinutes,
    pastTargetDateTasks,
    todayTasks,
    next7DaysTasks,
    distantOrUndatedActiveCount,
    recentActivityTasks,
  };
}
