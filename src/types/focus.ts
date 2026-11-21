import { PomodoroSequenceState } from './pomodoro';

export type FocusMode = 'standard' | 'pomodoro';

export type FocusSessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'ended_early';

export interface FocusCompletionResult {
  sessionId: string;
  wasCompletedNaturally: boolean;
  actualElapsedSeconds: number; // Pure focused time (excluding paused duration; >= 0)
  plannedDurationSeconds: number;
  taskId?: string;
  taskTitle?: string;
  completedAt: number; // Unix timestamp ms
  isArchived?: boolean; // Set true once successfully written to neurocalm_focus_history_v1
}

export interface FocusHistoryRecord {
  sessionId: string;
  mode: FocusMode;
  wasCompletedNaturally: boolean;
  actualElapsedSeconds: number; // >= 0
  plannedDurationSeconds: number; // > 0
  completedAt: number; // Finite epoch ms
  taskId?: string;
  taskTitle?: string;
  pomodoroIntervalIndex?: number; // Cumulative work interval count (>= 1)
}

export interface ActiveFocusSessionState {
  sessionId: string;
  mode: FocusMode;
  status: FocusSessionStatus;
  plannedDurationSeconds: number;
  accumulatedElapsedSeconds: number;
  lastSavedWallTime: number; // Date.now() when state was serialized
  version: number; // Monotonically increasing version counter
  taskId?: string;
  taskTitle?: string;
  pomodoro?: PomodoroSequenceState;
  completionResult?: FocusCompletionResult;
}

export interface FocusContextType {
  session: ActiveFocusSessionState;
  mode: FocusMode;
  setMode: (mode: FocusMode) => void;
  remainingSeconds: number;
  progressPercent: number; // 0 to 100
  selectedDurationMinutes: number;
  setSelectedDurationMinutes: (minutes: number) => void;
  selectedTaskId?: string;
  setSelectedTaskId: (taskId?: string) => void;
  startSession: (
    durationMinutes?: number,
    taskId?: string,
    taskTitle?: string,
    mode?: FocusMode,
    pomodoroMeta?: Partial<PomodoroSequenceState>
  ) => Promise<boolean>;
  pauseSession: () => void;
  resumeSession: () => void;
  endSessionEarly: () => void;
  restartSession: () => Promise<boolean>;
  resetToIdle: () => void;
  extendSessionDuration: (additionalSeconds: number) => Promise<boolean>;
  advancePomodoroInterval: (skip?: boolean) => Promise<boolean>;
  stopPomodoroSequence: () => Promise<boolean>;
  latestCompletedResult: FocusCompletionResult | null;
  history: FocusHistoryRecord[];
  conflictError: string | null;
  clearConflictError: () => void;
}
