import {
  CustomPomodoroConfig,
  PomodoroIntervalType,
  PomodoroPreset,
  PomodoroPresetId,
  PomodoroSequenceState,
} from '../types/pomodoro';

export const POMODORO_PRESETS: Record<PomodoroPresetId, PomodoroPreset> = {
  classic: {
    id: 'classic',
    labelKey: 'pomoPresetClassic',
    descriptionKey: 'pomoPresetClassicDesc',
    workDurationMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    intervalsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false,
  },
  deep_work: {
    id: 'deep_work',
    labelKey: 'pomoPresetDeepWork',
    descriptionKey: 'pomoPresetDeepWorkDesc',
    workDurationMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    intervalsBeforeLongBreak: 3,
    autoStartBreaks: false,
    autoStartWork: false,
  },
  custom: {
    id: 'custom',
    labelKey: 'pomoPresetCustom',
    descriptionKey: 'pomoPresetCustomDesc',
    workDurationMinutes: 30,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    intervalsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false,
  },
};

export const DEFAULT_CUSTOM_CONFIG: CustomPomodoroConfig = {
  workDurationMinutes: 30,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  intervalsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
};

function parseClampedInt(val: unknown, min: number, max: number, defaultVal: number): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  if (isNaN(num)) return defaultVal;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/**
 * Validate and clamp custom Pomodoro configuration to safe boundary limits.
 */
export function validateCustomConfig(input?: Partial<CustomPomodoroConfig>): CustomPomodoroConfig {
  if (!input) return { ...DEFAULT_CUSTOM_CONFIG };

  const work = parseClampedInt(input.workDurationMinutes, 1, 180, DEFAULT_CUSTOM_CONFIG.workDurationMinutes);
  const shortBreak = parseClampedInt(input.shortBreakMinutes, 1, 45, DEFAULT_CUSTOM_CONFIG.shortBreakMinutes);
  const longBreak = parseClampedInt(input.longBreakMinutes, 1, 60, DEFAULT_CUSTOM_CONFIG.longBreakMinutes);
  const intervals = parseClampedInt(input.intervalsBeforeLongBreak, 1, 12, DEFAULT_CUSTOM_CONFIG.intervalsBeforeLongBreak);

  return {
    workDurationMinutes: work,
    shortBreakMinutes: shortBreak,
    longBreakMinutes: longBreak,
    intervalsBeforeLongBreak: intervals,
    autoStartBreaks: Boolean(input.autoStartBreaks),
    autoStartWork: Boolean(input.autoStartWork),
  };
}

/**
 * Factory for initial Pomodoro sequence state.
 */
export function createInitialPomodoroState(
  presetId: PomodoroPresetId = 'classic',
  customConfig?: CustomPomodoroConfig
): PomodoroSequenceState {
  const preset = POMODORO_PRESETS[presetId];
  const config = presetId === 'custom' ? validateCustomConfig(customConfig) : undefined;

  const intervalsBeforeLongBreak =
    config?.intervalsBeforeLongBreak ?? preset.intervalsBeforeLongBreak;
  const autoStartBreaks = config?.autoStartBreaks ?? preset.autoStartBreaks;
  const autoStartWork = config?.autoStartWork ?? preset.autoStartWork;

  return {
    patternId: presetId,
    sequenceStatus: 'active',
    intervalType: 'work',
    cycleIntervalNumber: 1,
    cumulativeWorkIntervals: 0,
    intervalsBeforeLongBreak,
    customConfig: config,
    autoStartBreaks,
    autoStartWork,
    isTransitionPending: false,
    nextIntervalType: 'short_break',
  };
}

/**
 * Pure transition logic determining next interval and duration.
 */
export function calculateNextInterval(
  state: PomodoroSequenceState
): {
  nextIntervalType: PomodoroIntervalType;
  nextDurationMinutes: number;
  nextCycleIntervalNumber: number;
  isLongBreakScheduled: boolean;
} {
  const preset = POMODORO_PRESETS[state.patternId];
  const config = state.patternId === 'custom' ? validateCustomConfig(state.customConfig) : undefined;

  const workMins = config?.workDurationMinutes ?? preset.workDurationMinutes;
  const shortBreakMins = config?.shortBreakMinutes ?? preset.shortBreakMinutes;
  const longBreakMins = config?.longBreakMinutes ?? preset.longBreakMinutes;
  const intervalsBeforeLong = config?.intervalsBeforeLongBreak ?? preset.intervalsBeforeLongBreak;

  if (state.intervalType === 'work') {
    // A work interval just completed!
    // Check if current cycle hits the long break threshold
    const isLongBreak = state.cycleIntervalNumber >= intervalsBeforeLong;
    return {
      nextIntervalType: isLongBreak ? 'long_break' : 'short_break',
      nextDurationMinutes: isLongBreak ? longBreakMins : shortBreakMins,
      nextCycleIntervalNumber: state.cycleIntervalNumber, // Holds current interval number during break
      isLongBreakScheduled: isLongBreak,
    };
  }

  // A break interval just completed (short or long)!
  // Next interval is ALWAYS a work interval
  // If a long break concluded, reset cycle counter to 1; otherwise advance by 1
  const wasLongBreak = state.intervalType === 'long_break';
  const nextCycle = wasLongBreak ? 1 : state.cycleIntervalNumber + 1;

  return {
    nextIntervalType: 'work',
    nextDurationMinutes: workMins,
    nextCycleIntervalNumber: nextCycle,
    isLongBreakScheduled: false,
  };
}
