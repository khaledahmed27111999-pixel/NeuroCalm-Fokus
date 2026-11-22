import { Task, TaskPriority, TaskStatus, StorageStatus } from '../types/task';

export const TASK_STORAGE_KEY = 'neurocalm_tasks_v1';
export const TASK_CORRUPTED_KEY = 'neurocalm_tasks_corrupted_backup';

let inMemoryTasks: Task[] = [];
let isLocalStorageAvailable = true;

// Safe test for localStorage availability
export function checkLocalStorageAvailable(): boolean {
  try {
    const testKey = '__neurocalm_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a single task record at runtime
 */
export function isValidTaskRecord(item: unknown, seenIds: Set<string>): item is Task {
  if (typeof item !== 'object' || item === null) return false;

  const record = item as Record<string, unknown>;

  // ID validation
  if (typeof record.id !== 'string' || record.id.trim().length === 0 || seenIds.has(record.id)) {
    return false;
  }

  // Title validation (required non-empty string)
  if (typeof record.title !== 'string' || record.title.trim().length === 0) {
    return false;
  }

  // Priority validation
  const validPriorities: TaskPriority[] = ['low', 'medium', 'high'];
  if (!validPriorities.includes(record.priority as TaskPriority)) {
    return false;
  }

  // Status normalization & validation
  // Safely normalize cloud/legacy 'pending' to local 'todo' without accepting arbitrary unknown strings
  if (record.status === 'pending') {
    record.status = 'todo';
  }

  const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'completed'];
  if (!validStatuses.includes(record.status as TaskStatus)) {
    return false;
  }

  // Description validation (optional)
  if (record.description !== undefined && typeof record.description !== 'string') {
    return false;
  }

  // Due date validation (optional ISO-like date string)
  if (record.dueDate !== undefined) {
    if (typeof record.dueDate !== 'string' || record.dueDate.trim().length === 0) {
      return false;
    }
  }

  // Due time validation (optional string)
  if (record.dueTime !== undefined) {
    if (typeof record.dueTime !== 'string') {
      return false;
    }
  }

  // Estimated duration (optional positive integer in minutes)
  if (record.estimatedDurationMinutes !== undefined) {
    if (
      typeof record.estimatedDurationMinutes !== 'number' ||
      !Number.isFinite(record.estimatedDurationMinutes) ||
      record.estimatedDurationMinutes <= 0 ||
      !Number.isInteger(record.estimatedDurationMinutes)
    ) {
      return false;
    }
  }

  // Timestamp validations
  if (typeof record.createdAt !== 'number' || isNaN(record.createdAt) || record.createdAt <= 0) {
    return false;
  }
  if (typeof record.updatedAt !== 'number' || isNaN(record.updatedAt) || record.updatedAt <= 0) {
    return false;
  }

  return true;
}

export interface LoadTasksResult {
  tasks: Task[];
  status: StorageStatus;
}

/**
 * Safely inspects the backup copy and recovers valid tasks whose only discrepancy was 'pending' status.
 * - Preserves the backup key completely intact in localStorage (no deletion, no cleanup).
 * - Recovers only records that are strictly valid with a valid ID and non-empty title.
 * - Does NOT overwrite newer existing records with older backup records.
 * - Idempotent across multiple reloads.
 */
export function recoverTasksFromBackup(currentTaskMap: Map<string, Task>): {
  recoveredCount: number;
} {
  try {
    const rawBackup = localStorage.getItem(TASK_CORRUPTED_KEY);
    if (!rawBackup) return { recoveredCount: 0 };

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBackup);
    } catch {
      return { recoveredCount: 0 };
    }

    if (!Array.isArray(parsed)) return { recoveredCount: 0 };

    let recoveredCount = 0;

    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const candidate = { ...item } as Record<string, unknown>;

      // Normalize 'pending' to 'todo'
      if (candidate.status === 'pending') {
        candidate.status = 'todo';
      }

      // Strict validation: must pass all task rules (title, priority, duration, timestamps, etc.)
      if (!isValidTaskRecord(candidate, new Set<string>())) {
        continue;
      }

      const validCandidate = candidate as Task;
      const existing = currentTaskMap.get(validCandidate.id);

      if (!existing) {
        currentTaskMap.set(validCandidate.id, validCandidate);
        recoveredCount++;
      } else if (validCandidate.updatedAt > existing.updatedAt) {
        // Only replace if the candidate from backup is strictly newer
        currentTaskMap.set(validCandidate.id, validCandidate);
        recoveredCount++;
      }
    }

    return { recoveredCount };
  } catch {
    return { recoveredCount: 0 };
  }
}

/**
 * Loads and validates tasks from storage with corrupted data preservation and safe recovery
 */
export function loadTasksFromStorage(): LoadTasksResult {
  isLocalStorageAvailable = checkLocalStorageAvailable();

  if (!isLocalStorageAvailable) {
    return {
      tasks: [...inMemoryTasks],
      status: {
        isPersistent: false,
        hasCorruptedDataWarning: false,
        errorMessage: 'Local storage is unavailable. Tasks are held in memory only for this session.',
      },
    };
  }

  try {
    const rawData = localStorage.getItem(TASK_STORAGE_KEY);
    const seenIds = new Set<string>();
    const taskMap = new Map<string, Task>();
    let hasUnrecoverableCorruptedInActive = false;
    let didNormalizeActive = false;

    if (rawData) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        hasUnrecoverableCorruptedInActive = true;
        try {
          localStorage.setItem(TASK_CORRUPTED_KEY, rawData);
        } catch {}
      }

      if (parsed && !Array.isArray(parsed)) {
        hasUnrecoverableCorruptedInActive = true;
        try {
          localStorage.setItem(TASK_CORRUPTED_KEY, rawData);
        } catch {}
      } else if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'object' && item !== null) {
            const rec = item as Record<string, unknown>;
            if (rec.status === 'pending') {
              rec.status = 'todo';
              didNormalizeActive = true;
            }
          }
          if (isValidTaskRecord(item, seenIds)) {
            seenIds.add(item.id);
            taskMap.set(item.id, item);
          } else {
            hasUnrecoverableCorruptedInActive = true;
          }
        }

        if (hasUnrecoverableCorruptedInActive) {
          try {
            localStorage.setItem(TASK_CORRUPTED_KEY, rawData);
          } catch {}
        }
      }
    }

    // Safely recover valid tasks from backup if present
    const { recoveredCount } = recoverTasksFromBackup(taskMap);

    // If any tasks were normalized or recovered, sync active storage cleanly
    if (recoveredCount > 0 || didNormalizeActive) {
      try {
        const consolidated = Array.from(taskMap.values());
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(consolidated));
      } catch {}
    }

    const finalTasks = Array.from(taskMap.values());
    inMemoryTasks = [...finalTasks];

    return {
      tasks: finalTasks,
      status: {
        isPersistent: true,
        hasCorruptedDataWarning: hasUnrecoverableCorruptedInActive,
        errorMessage: hasUnrecoverableCorruptedInActive
          ? 'Some stored tasks were corrupted and could not be loaded. Valid tasks were preserved.'
          : undefined,
      },
    };
  } catch (error) {
    return {
      tasks: [...inMemoryTasks],
      status: {
        isPersistent: false,
        hasCorruptedDataWarning: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown storage access error',
      },
    };
  }
}

/**
 * Saves tasks to storage with in-memory fallback
 */
export function saveTasksToStorage(tasks: Task[]): StorageStatus {
  inMemoryTasks = [...tasks];
  isLocalStorageAvailable = checkLocalStorageAvailable();

  if (!isLocalStorageAvailable) {
    return {
      isPersistent: false,
      hasCorruptedDataWarning: false,
      errorMessage: 'Changes held in temporary session memory only. Local storage is unavailable.',
    };
  }

  try {
    const serialized = JSON.stringify(tasks);
    localStorage.setItem(TASK_STORAGE_KEY, serialized);
    return {
      isPersistent: true,
      hasCorruptedDataWarning: false,
    };
  } catch (error) {
    return {
      isPersistent: false,
      hasCorruptedDataWarning: false,
      errorMessage:
        error instanceof Error ? error.message : 'Failed to save tasks to local browser storage.',
    };
  }
}
