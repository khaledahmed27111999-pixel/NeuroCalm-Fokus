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

  // Status validation
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
 * Loads and validates tasks from storage with corrupted data preservation
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
    if (!rawData) {
      return {
        tasks: [],
        status: {
          isPersistent: true,
          hasCorruptedDataWarning: false,
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      // Preserve corrupted data without deleting it
      try {
        localStorage.setItem(TASK_CORRUPTED_KEY, rawData);
      } catch {
        // Ignore backup failure
      }
      return {
        tasks: [],
        status: {
          isPersistent: true,
          hasCorruptedDataWarning: true,
          errorMessage: 'Corrupted task data detected. Stored data was preserved as backup.',
        },
      };
    }

    if (!Array.isArray(parsed)) {
      try {
        localStorage.setItem(TASK_CORRUPTED_KEY, rawData);
      } catch {
        // Ignore backup failure
      }
      return {
        tasks: [],
        status: {
          isPersistent: true,
          hasCorruptedDataWarning: true,
          errorMessage: 'Stored task structure was invalid. A backup copy has been preserved.',
        },
      };
    }

    const seenIds = new Set<string>();
    const validTasks: Task[] = [];
    let hasCorruptedRecord = false;

    for (const item of parsed) {
      if (isValidTaskRecord(item, seenIds)) {
        seenIds.add(item.id);
        validTasks.push(item);
      } else {
        hasCorruptedRecord = true;
      }
    }

    if (hasCorruptedRecord) {
      try {
        localStorage.setItem(TASK_CORRUPTED_KEY, rawData);
      } catch {
        // Ignore backup failure
      }
    }

    inMemoryTasks = [...validTasks];

    return {
      tasks: validTasks,
      status: {
        isPersistent: true,
        hasCorruptedDataWarning: hasCorruptedRecord,
        errorMessage: hasCorruptedRecord
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
