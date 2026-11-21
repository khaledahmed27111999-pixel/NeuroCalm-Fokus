import assert from 'node:assert';
import {
  formatLocalDateString,
  addDaysToDate,
  compareDeadlines,
  formatDuration,
  formatRelativeTime,
  computeDashboardMetrics,
} from '../src/utils/dashboardMetrics';
import { Task } from '../src/types/task';

console.log('--- Starting Phase 1C Metrics & Logic Verification ---');

// 1. Date Formatting & Arithmetic
{
  const d1 = new Date(2026, 10, 18); // Nov 18, 2026
  assert.strictEqual(formatLocalDateString(d1), '2026-11-18', 'Date format should match YYYY-MM-DD');

  // Month boundary (Nov 30 -> Dec 1)
  const dNov30 = new Date(2026, 10, 30);
  const dDec1 = addDaysToDate(dNov30, 1);
  assert.strictEqual(formatLocalDateString(dDec1), '2026-12-01', 'Month boundary arithmetic failed');

  // Year boundary (Dec 31, 2026 -> Jan 1, 2027)
  const dDec31 = new Date(2026, 11, 31);
  const dJan1 = addDaysToDate(dDec31, 1);
  assert.strictEqual(formatLocalDateString(dJan1), '2027-01-01', 'Year boundary arithmetic failed');

  // Leap year boundary (Feb 28, 2028 -> Feb 29, 2028 -> Mar 1, 2028)
  const dFeb28_2028 = new Date(2028, 1, 28);
  const dFeb29 = addDaysToDate(dFeb28_2028, 1);
  assert.strictEqual(formatLocalDateString(dFeb29), '2028-02-29', 'Leap year Feb 29 calculation failed');
  const dMar1 = addDaysToDate(dFeb28_2028, 2);
  assert.strictEqual(formatLocalDateString(dMar1), '2028-03-01', 'Leap year Mar 1 calculation failed');

  // Non-leap year boundary (Feb 28, 2027 -> Mar 1, 2027)
  const dFeb28_2027 = new Date(2027, 1, 28);
  const dMar1_2027 = addDaysToDate(dFeb28_2027, 1);
  assert.strictEqual(formatLocalDateString(dMar1_2027), '2027-03-01', 'Non-leap year Mar 1 failed');

  console.log('✓ Date formatting and calendar boundary arithmetic passed');
}

// 2. Deadline Sorting & Deterministic Precedence
{
  // Test case A: Date precedence
  const taskEarlier: Task = {
    id: 't1',
    title: 'Earlier',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    createdAt: 100,
    updatedAt: 100,
  };
  const taskLater: Task = {
    id: 't2',
    title: 'Later',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-19',
    createdAt: 200,
    updatedAt: 200,
  };
  assert(compareDeadlines(taskEarlier, taskLater) < 0, 'Earlier date should sort before later date');

  // Test case B: Same date, explicit dueTime comes before missing dueTime
  const taskWithTime: Task = {
    id: 't3',
    title: 'With Time',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    dueTime: '14:00',
    createdAt: 100,
    updatedAt: 100,
  };
  const taskWithoutTime: Task = {
    id: 't4',
    title: 'Without Time',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    createdAt: 200,
    updatedAt: 200,
  };
  assert(compareDeadlines(taskWithTime, taskWithoutTime) < 0, 'Task with dueTime should precede task without');
  assert(compareDeadlines(taskWithoutTime, taskWithTime) > 0, 'Task without dueTime should succeed task with');

  // Test case C: Same date, both have dueTime -> earliest time first
  const task10am: Task = {
    id: 't5',
    title: '10am',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    dueTime: '10:00',
    createdAt: 100,
    updatedAt: 100,
  };
  const task2pm: Task = {
    id: 't6',
    title: '2pm',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    dueTime: '14:00',
    createdAt: 100,
    updatedAt: 100,
  };
  assert(compareDeadlines(task10am, task2pm) < 0, '10:00 should sort before 14:00');

  // Test case D: Same date, same time -> newest createdAt first
  const taskNewer: Task = {
    id: 't7',
    title: 'Newer',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    dueTime: '10:00',
    createdAt: 500,
    updatedAt: 500,
  };
  const taskOlder: Task = {
    id: 't8',
    title: 'Older',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    dueTime: '10:00',
    createdAt: 100,
    updatedAt: 100,
  };
  assert(compareDeadlines(taskNewer, taskOlder) < 0, 'Newer task should come before older on tie');

  // Test case E: Exact tie -> ID tie-breaker
  const taskA: Task = {
    id: 'a-id',
    title: 'A',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    createdAt: 100,
    updatedAt: 100,
  };
  const taskB: Task = {
    id: 'b-id',
    title: 'B',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-11-18',
    createdAt: 100,
    updatedAt: 100,
  };
  assert(compareDeadlines(taskA, taskB) < 0, 'ID tie-breaker failed');

  console.log('✓ Deadline deterministic sorting and precedence passed');
}

// 3. Duration & Relative Time Formatting
{
  assert.strictEqual(formatDuration(0, 'en'), '0m');
  assert.strictEqual(formatDuration(45, 'en'), '45m');
  assert.strictEqual(formatDuration(60, 'en'), '1h');
  assert.strictEqual(formatDuration(90, 'en'), '1h 30m');
  assert.strictEqual(formatDuration(125, 'ar'), '2 س 5 د');

  const now = 1000000;
  assert.strictEqual(formatRelativeTime(now - 10000, 'en', now), 'Just now');
  assert.strictEqual(formatRelativeTime(now - 5 * 60 * 1000, 'en', now), '5m ago');
  assert.strictEqual(formatRelativeTime(now - 3 * 3600 * 1000, 'en', now), '3h ago');
  assert.strictEqual(formatRelativeTime(now - 2 * 86400 * 1000, 'en', now), '2d ago');
  assert.strictEqual(formatRelativeTime(now - 5 * 60 * 1000, 'ar', now), 'منذ 5 د');

  console.log('✓ Duration and relative time formatting passed');
}

// 4. Metrics Computation with Injected Reference Date
{
  const refDate = new Date(2026, 10, 18); // 2026-11-18

  const mockTasks: Task[] = [
    // Overdue task (2026-11-17 < 2026-11-18)
    {
      id: 'task-overdue',
      title: 'Past target date task',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-11-17',
      estimatedDurationMinutes: 45,
      createdAt: 1000,
      updatedAt: 1000,
    },
    // Today task
    {
      id: 'task-today',
      title: 'Today task with time',
      priority: 'medium',
      status: 'todo',
      dueDate: '2026-11-18',
      dueTime: '15:30',
      estimatedDurationMinutes: 30,
      createdAt: 2000,
      updatedAt: 2000,
    },
    // Next 7 days task (2026-11-22 is day 4)
    {
      id: 'task-next-days',
      title: 'Task due in 4 days',
      priority: 'low',
      status: 'todo',
      dueDate: '2026-11-22',
      estimatedDurationMinutes: 60,
      createdAt: 3000,
      updatedAt: 3000,
    },
    // Distant task (due in 20 days: 2026-12-08)
    {
      id: 'task-distant',
      title: 'Distant task',
      priority: 'medium',
      status: 'todo',
      dueDate: '2026-12-08',
      estimatedDurationMinutes: 20,
      createdAt: 4000,
      updatedAt: 4000,
    },
    // Undated active task
    {
      id: 'task-undated',
      title: 'Undated task',
      priority: 'low',
      status: 'todo',
      createdAt: 5000,
      updatedAt: 5000,
    },
    // Completed task (should be excluded from active deadlines and estimated duration sum)
    {
      id: 'task-completed',
      title: 'Completed task with past deadline',
      priority: 'high',
      status: 'completed',
      dueDate: '2026-11-15',
      estimatedDurationMinutes: 90,
      createdAt: 500,
      updatedAt: 6000, // Most recently updated!
    },
  ];

  const metrics = computeDashboardMetrics(mockTasks, refDate);

  // Overall counts
  assert.strictEqual(metrics.totalTasks, 6, 'Total tasks should be 6');
  assert.strictEqual(metrics.activeTasksCount, 5, 'Active tasks should be 5');
  assert.strictEqual(metrics.completedTasksCount, 1, 'Completed tasks should be 1');

  // Priority counts (Active only!)
  assert.strictEqual(metrics.highPriorityCount, 1, 'Active high priority should be 1');
  assert.strictEqual(metrics.mediumPriorityCount, 2, 'Active medium priority should be 2');
  assert.strictEqual(metrics.lowPriorityCount, 2, 'Active low priority should be 2');

  // Estimated Duration: sum of active tasks only (45 + 30 + 60 + 20 = 155 minutes)
  assert.strictEqual(metrics.totalEstimatedMinutes, 155, 'Active estimated minutes should be 155');

  // Deadline Buckets
  assert.strictEqual(metrics.pastTargetDateTasks.length, 1, 'Should have 1 past target date task');
  assert.strictEqual(metrics.pastTargetDateTasks[0].id, 'task-overdue');

  assert.strictEqual(metrics.todayTasks.length, 1, 'Should have 1 today task');
  assert.strictEqual(metrics.todayTasks[0].id, 'task-today');

  assert.strictEqual(metrics.next7DaysTasks.length, 1, 'Should have 1 next 7 days task');
  assert.strictEqual(metrics.next7DaysTasks[0].id, 'task-next-days');

  // Distant or undated active tasks: task-distant + task-undated = 2
  assert.strictEqual(metrics.distantOrUndatedActiveCount, 2, 'Should have 2 distant/undated active tasks');

  // Recent Activity: top 3 by updatedAt descending
  assert.strictEqual(metrics.recentActivityTasks.length, 3, 'Recent activity should contain top 3');
  assert.strictEqual(metrics.recentActivityTasks[0].id, 'task-completed', 'Most recently updated should be first');
  assert.strictEqual(metrics.recentActivityTasks[1].id, 'task-undated', 'Second most recently updated');
  assert.strictEqual(metrics.recentActivityTasks[2].id, 'task-distant', 'Third most recently updated');

  console.log('✓ Full metrics computation and grouping verified successfully');
}

// 5. Empty Dashboard Metrics
{
  const emptyMetrics = computeDashboardMetrics([], new Date());
  assert.strictEqual(emptyMetrics.totalTasks, 0);
  assert.strictEqual(emptyMetrics.activeTasksCount, 0);
  assert.strictEqual(emptyMetrics.completedTasksCount, 0);
  assert.strictEqual(emptyMetrics.highPriorityCount, 0);
  assert.strictEqual(emptyMetrics.totalEstimatedMinutes, 0);
  assert.strictEqual(emptyMetrics.pastTargetDateTasks.length, 0);
  assert.strictEqual(emptyMetrics.todayTasks.length, 0);
  assert.strictEqual(emptyMetrics.next7DaysTasks.length, 0);
  assert.strictEqual(emptyMetrics.recentActivityTasks.length, 0);
  console.log('✓ Empty task set metrics verified');
}

console.log('ALL UNIT METRIC AND LOGIC TESTS PASSED!');
