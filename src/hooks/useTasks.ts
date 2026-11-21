import { useState, useEffect, useCallback } from 'react';
import { Task, CreateTaskInput, UpdateTaskInput, StorageStatus } from '../types/task';
import { loadTasksFromStorage, saveTasksToStorage } from '../storage/taskStorage';
import { generateId } from '../utils/id';

export function useTasks(onTaskActionSuccess?: () => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    isPersistent: true,
    hasCorruptedDataWarning: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load tasks on mount
  useEffect(() => {
    const { tasks: loadedTasks, status } = loadTasksFromStorage();
    setTasks(loadedTasks);
    setStorageStatus(status);
    setIsLoaded(true);
  }, []);

  const saveAndSetTasks = useCallback((updater: (prev: Task[]) => Task[]) => {
    setTasks((prev) => {
      const next = updater(prev);
      const status = saveTasksToStorage(next);
      setStorageStatus(status);
      return next;
    });
  }, []);

  const createQuickTask = useCallback(
    (title: string): boolean => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return false;

      const now = Date.now();
      const newTask: Task = {
        id: generateId(),
        title: trimmedTitle,
        priority: 'medium',
        status: 'todo',
        createdAt: now,
        updatedAt: now,
      };

      saveAndSetTasks((prev) => [newTask, ...prev]);
      onTaskActionSuccess?.();
      return true;
    },
    [saveAndSetTasks, onTaskActionSuccess]
  );

  const createDetailedTask = useCallback(
    (input: CreateTaskInput): boolean => {
      const trimmedTitle = input.title.trim();
      if (!trimmedTitle) return false;

      let validDuration: number | undefined = undefined;
      if (input.estimatedDurationMinutes !== undefined && input.estimatedDurationMinutes !== null) {
        const num = Number(input.estimatedDurationMinutes);
        if (num > 0 && Number.isInteger(num)) {
          validDuration = num;
        } else {
          return false;
        }
      }

      const now = Date.now();
      const newTask: Task = {
        id: generateId(),
        title: trimmedTitle,
        description: input.description?.trim() || undefined,
        priority: input.priority || 'medium',
        status: 'todo',
        dueDate: input.dueDate || undefined,
        dueTime: input.dueTime || undefined,
        estimatedDurationMinutes: validDuration,
        createdAt: now,
        updatedAt: now,
      };

      saveAndSetTasks((prev) => [newTask, ...prev]);
      onTaskActionSuccess?.();
      return true;
    },
    [saveAndSetTasks, onTaskActionSuccess]
  );

  const updateTask = useCallback(
    (id: string, updates: UpdateTaskInput): boolean => {
      if (updates.title !== undefined && !updates.title.trim()) {
        return false;
      }

      let validDuration: number | undefined = undefined;
      if (updates.estimatedDurationMinutes !== undefined) {
        if (updates.estimatedDurationMinutes === null || updates.estimatedDurationMinutes === 0) {
          validDuration = undefined;
        } else {
          const num = Number(updates.estimatedDurationMinutes);
          if (num > 0 && Number.isInteger(num)) {
            validDuration = num;
          } else {
            return false;
          }
        }
      }

      saveAndSetTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id) return task;
          return {
            ...task,
            ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
            ...(updates.description !== undefined
              ? { description: updates.description.trim() || undefined }
              : {}),
            ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
            ...(updates.status !== undefined ? { status: updates.status } : {}),
            ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate || undefined } : {}),
            ...(updates.dueTime !== undefined ? { dueTime: updates.dueTime || undefined } : {}),
            ...(updates.estimatedDurationMinutes !== undefined
              ? { estimatedDurationMinutes: validDuration }
              : {}),
            updatedAt: Date.now(),
          };
        })
      );

      onTaskActionSuccess?.();
      return true;
    },
    [saveAndSetTasks, onTaskActionSuccess]
  );

  const deleteTask = useCallback(
    (id: string) => {
      saveAndSetTasks((prev) => prev.filter((t) => t.id !== id));
      onTaskActionSuccess?.();
    },
    [saveAndSetTasks, onTaskActionSuccess]
  );

  const toggleTaskStatus = useCallback(
    (id: string) => {
      saveAndSetTasks((prev) =>
        prev.map((task) => {
          if (task.id !== id) return task;
          const nextStatus: Task['status'] = task.status === 'completed' ? 'todo' : 'completed';
          return {
            ...task,
            status: nextStatus,
            updatedAt: Date.now(),
          };
        })
      );
      onTaskActionSuccess?.();
    },
    [saveAndSetTasks, onTaskActionSuccess]
  );

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return {
    tasks,
    activeTasks,
    completedTasks,
    storageStatus,
    isLoaded,
    createQuickTask,
    createDetailedTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
  };
}
