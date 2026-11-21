export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  estimatedDurationMinutes?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  dueTime?: string;
  estimatedDurationMinutes?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  dueTime?: string;
  estimatedDurationMinutes?: number;
}

export interface StorageStatus {
  isPersistent: boolean;
  hasCorruptedDataWarning: boolean;
  errorMessage?: string;
}
