import React, { useState } from 'react';
import { Target, AlertCircle, Play } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { useFocus } from '../hooks/useFocus';
import { useTasks } from '../hooks/useTasks';
import { FocusDurationPicker } from '../components/focus/FocusDurationPicker';
import { FocusTaskSelector } from '../components/focus/FocusTaskSelector';
import { FocusTimerDisplay } from '../components/focus/FocusTimerDisplay';
import { FocusCompletionView } from '../components/focus/FocusCompletionView';
import { PomodoroModeToggle } from '../components/pomodoro/PomodoroModeToggle';
import { PomodoroPresetPicker } from '../components/pomodoro/PomodoroPresetPicker';
import { PomodoroCycleIndicator } from '../components/pomodoro/PomodoroCycleIndicator';
import { PomodoroTransitionCard } from '../components/pomodoro/PomodoroTransitionCard';
import { CustomPomodoroConfig, PomodoroPresetId } from '../types/pomodoro';
import { DEFAULT_CUSTOM_CONFIG, POMODORO_PRESETS } from '../utils/pomodoroSequence';

export const FocusView: React.FC = () => {
  const { t } = useLocale();
  const { tasks } = useTasks();
  const {
    session,
    mode,
    setMode,
    remainingSeconds,
    progressPercent,
    selectedDurationMinutes,
    setSelectedDurationMinutes,
    selectedTaskId,
    setSelectedTaskId,
    startSession,
    pauseSession,
    resumeSession,
    endSessionEarly,
    restartSession,
    resetToIdle,
    extendSessionDuration,
    advancePomodoroInterval,
    stopPomodoroSequence,
    conflictError,
    clearConflictError,
  } = useFocus();

  // Pomodoro local configuration state for setup
  const [selectedPreset, setSelectedPreset] = useState<PomodoroPresetId>('classic');
  const [customConfig, setCustomConfig] = useState<CustomPomodoroConfig>(DEFAULT_CUSTOM_CONFIG);

  const selectedTask = tasks.find((tk) => tk.id === selectedTaskId);
  const suggestedTaskMinutes = selectedTask?.estimatedDurationMinutes;

  const isSessionActive = session.status === 'running' || session.status === 'paused';
  const isTransitionPending =
    session.mode === 'pomodoro' &&
    session.pomodoro !== undefined &&
    session.pomodoro.isTransitionPending;

  const handleStartFocus = async () => {
    if (mode === 'pomodoro') {
      const preset = POMODORO_PRESETS[selectedPreset];
      const workDuration =
        selectedPreset === 'custom'
          ? customConfig.workDurationMinutes
          : preset.workDurationMinutes;

      await startSession(
        workDuration,
        selectedTaskId,
        selectedTask?.title,
        'pomodoro',
        {
          patternId: selectedPreset,
          customConfig: selectedPreset === 'custom' ? customConfig : undefined,
          autoStartBreaks:
            selectedPreset === 'custom' ? customConfig.autoStartBreaks : preset.autoStartBreaks,
          autoStartWork:
            selectedPreset === 'custom' ? customConfig.autoStartWork : preset.autoStartWork,
        }
      );
    } else {
      await startSession(
        selectedDurationMinutes,
        selectedTaskId,
        selectedTask?.title,
        'standard'
      );
    }
  };

  return (
    <div
      role="tabpanel"
      id="panel-focus"
      aria-labelledby="tab-focus"
      className="space-y-6 max-w-2xl mx-auto"
    >
      {/* Conflict / Concurrency Alert */}
      {conflictError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 text-sm space-y-1">
            <p className="font-semibold">{conflictError}</p>
            <p className="text-xs text-amber-300/80">
              Only one focus session can run at a time to keep your attention unified.
            </p>
          </div>
          <button
            type="button"
            onClick={clearConflictError}
            className="text-xs underline hover:text-amber-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. IDLE STATE: Setup Card */}
      {session.status === 'idle' && !isTransitionPending && (
        <div className="space-y-6">
          {/* Pillar Introduction Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-calm-secondary border border-blue-500/20">
                <Target className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1 flex-1">
                <h2 className="text-xl sm:text-2xl font-semibold text-calm-text">
                  {t('focusTitle')}
                </h2>
                <p className="text-sm text-calm-muted leading-relaxed">
                  {t('focusDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Setup Configuration Form */}
          <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6">
            {/* Mode Toggle: Standard Timer vs. Pomodoro */}
            <PomodoroModeToggle
              mode={mode}
              onModeChange={setMode}
              disabled={isSessionActive}
            />

            {/* Optional Task Linking (inherits to all work intervals) */}
            <FocusTaskSelector
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTaskId={(id) => {
                setSelectedTaskId(id);
                // In standard mode, offer matching task duration
                if (mode === 'standard') {
                  const taskMatch = tasks.find((tk) => tk.id === id);
                  if (taskMatch?.estimatedDurationMinutes) {
                    setSelectedDurationMinutes(taskMatch.estimatedDurationMinutes);
                  }
                }
              }}
            />

            {/* Timer Duration Picker OR Pomodoro Preset Selector */}
            {mode === 'standard' ? (
              <FocusDurationPicker
                selectedMinutes={selectedDurationMinutes}
                onSelectMinutes={setSelectedDurationMinutes}
                suggestedTaskMinutes={suggestedTaskMinutes}
              />
            ) : (
              <PomodoroPresetPicker
                selectedPreset={selectedPreset}
                onSelectPreset={setSelectedPreset}
                customConfig={customConfig}
                onCustomConfigChange={setCustomConfig}
                disabled={isSessionActive}
              />
            )}

            {/* Start Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartFocus}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl bg-calm-primary text-white text-base font-semibold hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
              >
                <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                <span>{t('startFocus')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TRANSITION PENDING STATE (Pomodoro only: Work Complete -> Start Break OR Break Complete -> Start Work) */}
      {isTransitionPending && session.pomodoro && (
        <div className="space-y-4">
          <PomodoroCycleIndicator pomodoroState={session.pomodoro} />
          <PomodoroTransitionCard
            pomodoroState={session.pomodoro}
            onAdvance={() => advancePomodoroInterval(false)}
            onSkipBreak={
              session.pomodoro.intervalType === 'work'
                ? () => advancePomodoroInterval(true)
                : undefined
            }
            onStopSequence={stopPomodoroSequence}
          />
        </div>
      )}

      {/* 3. RUNNING / PAUSED STATE: Live Timer */}
      {(session.status === 'running' || session.status === 'paused') && !isTransitionPending && (
        <div className="space-y-4">
          {session.mode === 'pomodoro' && session.pomodoro && (
            <PomodoroCycleIndicator pomodoroState={session.pomodoro} />
          )}

          <FocusTimerDisplay
            session={session}
            remainingSeconds={remainingSeconds}
            progressPercent={progressPercent}
            onPause={pauseSession}
            onResume={resumeSession}
            onEndEarly={endSessionEarly}
            onRestart={restartSession}
            onExtendBreak={(minutes) => extendSessionDuration(minutes * 60)}
            onSkipBreak={() => advancePomodoroInterval(true)}
            onStopSequence={stopPomodoroSequence}
          />
        </div>
      )}

      {/* 4. COMPLETED (Standard mode) or ENDED EARLY: Completion Summary */}
      {!isTransitionPending &&
        (session.status === 'ended_early' ||
          (session.status === 'completed' && session.mode === 'standard')) &&
        session.completionResult && (
          <FocusCompletionView
            result={session.completionResult}
            onStartAnother={resetToIdle}
            onReset={resetToIdle}
          />
        )}
    </div>
  );
};
