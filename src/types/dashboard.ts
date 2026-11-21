import { Task } from './task';

export type PlanSubView = 'tasks' | 'dashboard';

export interface DashboardMetrics {
  totalTasks: number;
  activeTasksCount: number;
  completedTasksCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  totalEstimatedMinutes: number;
  pastTargetDateTasks: Task[];
  todayTasks: Task[];
  next7DaysTasks: Task[];
  distantOrUndatedActiveCount: number;
  recentActivityTasks: Task[];
}
