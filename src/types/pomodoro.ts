import { TranslationKey } from './locale';

export type PomodoroPresetId = 'classic' | 'deep_work' | 'custom';
export type PomodoroIntervalType = 'work' | 'short_break' | 'long_break';
export type PomodoroSequenceStatus = 'active' | 'transition_pending' | 'stopped';

export interface CustomPomodoroConfig {
  workDurationMinutes: number;      // 1–180, default 30
  shortBreakMinutes: number;        // 1–45, default 5
  longBreakMinutes: number;         // 1–60, default 15
  intervalsBeforeLongBreak: number; // 1–12, default 4
  autoStartBreaks: boolean;         // default false
  autoStartWork: boolean;           // default false
}

export interface PomodoroPreset {
  id: PomodoroPresetId;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  workDurationMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  intervalsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export interface PomodoroSequenceState {
  patternId: PomodoroPresetId;
  sequenceStatus: PomodoroSequenceStatus; // 'active' | 'transition_pending' | 'stopped'
  intervalType: PomodoroIntervalType;     // 'work' | 'short_break' | 'long_break'
  cycleIntervalNumber: number;            // 1 to intervalsBeforeLongBreak (resets after long break)
  cumulativeWorkIntervals: number;        // Total work intervals completed in sequence
  intervalsBeforeLongBreak: number;       // 4 for Classic, 3 for Deep Work, or custom
  customConfig?: CustomPomodoroConfig;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  isTransitionPending: boolean;
  nextIntervalType?: PomodoroIntervalType;
  nextPlannedDurationSeconds?: number;
}
