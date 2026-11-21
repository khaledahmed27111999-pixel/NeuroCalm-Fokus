/**
 * NeuroCalm & Fokus — Sleep Preparation & Wind-Down Routine Component
 * Phase S5: Customizable bedtime preparation checklist, integrating breathing exercises,
 * relaxation sessions, and sleep timer without forcing completion or automatic playback.
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ListChecks,
  CheckCircle2,
  Circle,
  SkipForward,
  RotateCcw,
  Sliders,
  Check,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Wind,
  Headphones,
  Moon,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useSleep } from '../../hooks/useSleep';
import { useLocale } from '../../context/LocaleContext';
import { useBreathing } from '../../context/BreathingContext';
import { useRelaxationSession } from '../../context/RelaxationSessionContext';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { TranslationKey } from '../../types/locale';
import { SleepPrepActivityType } from '../../types/sleep';
import { RELAXATION_SESSIONS } from '../../data/relaxationSessions';
import { BreathingSetupModal } from '../breathing/BreathingSetupModal';
import { BreathingPlayer } from '../breathing/BreathingPlayer';
import { BreathingCompletionModal } from '../breathing/BreathingCompletionModal';
import { RelaxationSetupModal } from '../relaxation/RelaxationSetupModal';
import { SleepTimerModal } from '../audio/SleepTimerModal';
import { formatTimeDisplay } from '../../utils/focusTimer';

interface SleepPreparationRoutineProps {
  onBack: () => void;
}

export const SleepPreparationRoutine: React.FC<SleepPreparationRoutineProps> = ({ onBack }) => {
  const { t, direction } = useLocale();
  const {
    prepPreferences,
    prepProgress,
    setItemStatus,
    updatePrepPreferences,
    resetPrepToDefaults,
    resetTonightProgress,
    startSession,
    activeSession,
  } = useSleep();

  // Breathing integration
  const {
    startSetup: startBreathingSetup,
    setupTechnique,
    closeSetup: closeBreathingSetup,
    beginSession: beginBreathingSession,
    liveState: breathingLiveState,
    dismissCompletion: dismissBreathingCompletion,
  } = useBreathing();

  // Relaxation integration
  const {
    startSetup: startRelaxationSetup,
    setupSession,
    closeSetup: closeRelaxationSetup,
    beginSession: beginRelaxationSession,
  } = useRelaxationSession();

  // Sleep Timer integration
  const sleepTimer = useSleepTimer();
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);

  // Customization mode toggle
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [newCustomTitle, setNewCustomTitle] = useState('');

  // Find evening retreat session
  const eveningSession = useMemo(() => {
    return (
      RELAXATION_SESSIONS.find((s) => s.id === 'session_evening_retreat') ||
      RELAXATION_SESSIONS[0]
    );
  }, []);

  // Sorted list of built-in activities
  const sortedActivities = useMemo(() => {
    return [...prepPreferences.activities].sort((a, b) => a.order - b.order);
  }, [prepPreferences.activities]);

  // Active (enabled) activities for tonight
  const activeActivities = useMemo(() => {
    return sortedActivities.filter((a) => a.isEnabled);
  }, [sortedActivities]);

  // Active custom activities
  const activeCustomActivities = useMemo(() => {
    return (prepPreferences.customActivities || []).filter((ca) => ca.isEnabled);
  }, [prepPreferences.customActivities]);

  // Progress metrics
  const totalSteps = activeActivities.length + activeCustomActivities.length;
  const completedCount = useMemo(() => {
    let count = 0;
    activeActivities.forEach((a) => {
      if (prepProgress[a.id] === 'completed') count++;
    });
    activeCustomActivities.forEach((ca) => {
      if (prepProgress[ca.id] === 'completed') count++;
    });
    return count;
  }, [activeActivities, activeCustomActivities, prepProgress]);

  const skippedCount = useMemo(() => {
    let count = 0;
    activeActivities.forEach((a) => {
      if (prepProgress[a.id] === 'skipped') count++;
    });
    activeCustomActivities.forEach((ca) => {
      if (prepProgress[ca.id] === 'skipped') count++;
    });
    return count;
  }, [activeActivities, activeCustomActivities, prepProgress]);

  const allDone = totalSteps > 0 && completedCount + skippedCount === totalSteps;

  // Checklist Item State Toggles
  const handleToggleComplete = (id: string) => {
    const current = prepProgress[id] || 'pending';
    if (current === 'completed') {
      setItemStatus(id, 'pending');
    } else {
      setItemStatus(id, 'completed');
    }
  };

  const handleToggleSkip = (id: string) => {
    const current = prepProgress[id] || 'pending';
    if (current === 'skipped') {
      setItemStatus(id, 'pending');
    } else {
      setItemStatus(id, 'skipped');
    }
  };

  // Customization Handlers
  const handleToggleEnableActivity = (id: string) => {
    const updated = prepPreferences.activities.map((a) =>
      a.id === id ? { ...a, isEnabled: !a.isEnabled } : a
    );
    updatePrepPreferences({ ...prepPreferences, activities: updated });
  };

  const handleMoveActivity = (index: number, directionOffset: number) => {
    const newIdx = index + directionOffset;
    if (newIdx < 0 || newIdx >= sortedActivities.length) return;

    const list = [...sortedActivities];
    const temp = list[index];
    list[index] = list[newIdx];
    list[newIdx] = temp;

    const reordered = list.map((a, i) => ({ ...a, order: i }));
    updatePrepPreferences({ ...prepPreferences, activities: reordered });
  };

  const handleChangeDuration = (id: string, durationMinutes: number) => {
    const updated = prepPreferences.activities.map((a) =>
      a.id === id ? { ...a, durationMinutes } : a
    );
    updatePrepPreferences({ ...prepPreferences, activities: updated });
  };

  // Custom activity addition
  const handleAddCustomActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomTitle.trim()) return;

    const newId = `custom_${Date.now()}`;
    const newCustom = {
      id: newId,
      title: newCustomTitle.trim().slice(0, 100),
      isEnabled: true,
    };

    const existing = prepPreferences.customActivities || [];
    updatePrepPreferences({
      ...prepPreferences,
      customActivities: [...existing, newCustom],
    });
    setNewCustomTitle('');
  };

  const handleDeleteCustomActivity = (id: string) => {
    const existing = prepPreferences.customActivities || [];
    const updated = existing.filter((ca) => ca.id !== id);
    updatePrepPreferences({ ...prepPreferences, customActivities: updated });
  };

  const handleToggleEnableCustomActivity = (id: string) => {
    const existing = prepPreferences.customActivities || [];
    const updated = existing.map((ca) =>
      ca.id === id ? { ...ca, isEnabled: !ca.isEnabled } : ca
    );
    updatePrepPreferences({ ...prepPreferences, customActivities: updated });
  };

  // Helper for activity icons
  const getActivityIcon = (type: SleepPrepActivityType) => {
    switch (type) {
      case 'breathing':
        return <Wind className="w-5 h-5 text-teal-400" aria-hidden="true" />;
      case 'relaxation':
        return <Headphones className="w-5 h-5 text-indigo-400" aria-hidden="true" />;
      case 'soundscape':
        return <Moon className="w-5 h-5 text-indigo-300" aria-hidden="true" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-400" aria-hidden="true" />;
    }
  };

  const isBreathingActive =
    breathingLiveState.status === 'running' ||
    breathingLiveState.status === 'paused' ||
    breathingLiveState.status === 'settling';

  return (
    <div className="space-y-6 sm:space-y-8 text-start">
      {/* 1. Header & Navigation Back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-calm-surface border border-calm-border text-calm-muted hover:text-calm-text hover:bg-calm-surface/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary shrink-0"
            aria-label={t('sleepPrepBackToDashboard')}
          >
            {direction === 'rtl' ? (
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('sleepPrepNavTitle')}
            </h2>
            <p className="text-sm text-calm-muted">
              {t('sleepPrepNavSubtitle')}
            </p>
          </div>
        </div>

        {/* Customize Routine Button */}
        <button
          type="button"
          onClick={() => setIsCustomizing((prev) => !prev)}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary self-start sm:self-center ${
            isCustomizing
              ? 'bg-calm-primary text-white border-calm-primary'
              : 'bg-calm-surface border-calm-border text-calm-muted hover:text-calm-text'
          }`}
        >
          {isCustomizing ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>{t('sleepPrepCloseCustomize')}</span>
            </>
          ) : (
            <>
              <Sliders className="w-4 h-4" aria-hidden="true" />
              <span>{t('sleepPrepCustomizeToggle')}</span>
            </>
          )}
        </button>
      </div>

      {/* Philosophy Callout */}
      <div className="p-4 sm:p-5 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3.5">
        <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
        <p className="text-sm text-calm-text font-medium leading-relaxed">
          {t('sleepPrepPhilosophy')}
        </p>
      </div>

      {/* Active Sleep Timer Alert Banner (if running) */}
      {sleepTimer.state.status !== 'idle' && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-indigo-300 font-medium">
            <Moon className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>
              {t('sleepPrepTimerNotice', {
                time: formatTimeDisplay(sleepTimer.state.remainingSeconds),
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsTimerModalOpen(true)}
            className="text-xs text-indigo-300 underline hover:text-indigo-200"
          >
            {t('sleepTimerConfigure')}
          </button>
        </div>
      )}

      {/* 2. Progress & Routine Summary Bar */}
      {!isCustomizing && (
        <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-calm-text">
                {t('sleepPrepRoutineHeading')}
              </h3>
              <p className="text-xs text-calm-muted mt-0.5">
                {t('sleepPrepRoutineDesc')}
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <span className="text-xs font-medium text-calm-text">
                {t('sleepPrepProgressSummary', {
                  completed: completedCount,
                  total: totalSteps,
                })}
              </span>
              {skippedCount > 0 && (
                <span className="text-xs text-calm-muted font-medium">
                  {t('sleepPrepSkippedSummary', { skipped: skippedCount })}
                </span>
              )}
            </div>
          </div>

          {/* Calm Visual Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            className="w-full h-2 rounded-full bg-calm-surface overflow-hidden flex"
          >
            <div
              className="h-full bg-calm-primary transition-all duration-300"
              style={{
                width: totalSteps > 0 ? `${(completedCount / totalSteps) * 100}%` : '0%',
              }}
            />
            <div
              className="h-full bg-slate-600/40 transition-all duration-300"
              style={{
                width: totalSteps > 0 ? `${(skippedCount / totalSteps) * 100}%` : '0%',
              }}
            />
          </div>

          {/* All Done gentle message */}
          {allDone && (
            <div className="p-3.5 rounded-xl bg-calm-primary/10 border border-calm-primary/20 text-xs text-calm-primary flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t('sleepPrepAllDoneMessage')}</span>
              </div>
              {!activeSession && (
                <button
                  type="button"
                  onClick={() => startSession()}
                  className="px-3 py-1.5 rounded-lg bg-calm-primary text-white font-medium text-xs hover:bg-calm-primary/90 transition-colors"
                >
                  {t('sleepPrepReadyForSleep')}
                </button>
              )}
            </div>
          )}

          {/* Reset Tonight's Checklist Action */}
          {(completedCount > 0 || skippedCount > 0) && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={resetTonightProgress}
                className="flex items-center gap-1.5 text-xs text-calm-muted hover:text-calm-text transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('sleepPrepResetChecklist')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Customization Section (when isCustomizing === true) */}
      {isCustomizing ? (
        <section aria-label="Routine Customization" className="space-y-6">
          <div className="p-6 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-calm-border pb-4">
              <div>
                <h3 className="text-base font-semibold text-calm-text">
                  {t('sleepPrepCustomizeToggle')}
                </h3>
                <p className="text-xs text-calm-muted mt-0.5">
                  Enable, disable, reorder, or adjust estimated durations.
                </p>
              </div>
              <button
                type="button"
                onClick={resetPrepToDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-xs text-calm-muted hover:text-calm-text transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('sleepPrepResetDefaults')}</span>
              </button>
            </div>

            {/* Reorder and Enable/Disable Built-in Activities */}
            <div className="space-y-3">
              {sortedActivities.map((act, idx) => {
                const title = t(act.titleKey as TranslationKey);
                return (
                  <div
                    key={act.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      act.isEnabled
                        ? 'bg-calm-surface border-calm-border'
                        : 'bg-calm-surface/40 border-calm-border/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-calm-card border border-calm-border shrink-0">
                        {getActivityIcon(act.activityType)}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-calm-text">{title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <label
                            htmlFor={`duration-${act.id}`}
                            className="text-[11px] text-calm-muted"
                          >
                            {t('sleepPrepDurationMinutes', {
                              minutes: act.durationMinutes || 5,
                            })}
                          </label>
                          <select
                            id={`duration-${act.id}`}
                            value={act.durationMinutes || 5}
                            onChange={(e) =>
                              handleChangeDuration(act.id, parseInt(e.target.value, 10))
                            }
                            className="text-xs px-2 py-0.5 rounded bg-calm-card border border-calm-border text-calm-text"
                          >
                            <option value={5}>5 min</option>
                            <option value={10}>10 min</option>
                            <option value={15}>15 min</option>
                            <option value={20}>20 min</option>
                            <option value={30}>30 min</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveActivity(idx, -1)}
                        className="p-1.5 rounded-lg bg-calm-card border border-calm-border text-calm-muted hover:text-calm-text disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t('sleepPrepMoveUp')}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={idx === sortedActivities.length - 1}
                        onClick={() => handleMoveActivity(idx, 1)}
                        className="p-1.5 rounded-lg bg-calm-card border border-calm-border text-calm-muted hover:text-calm-text disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t('sleepPrepMoveDown')}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {/* Enable/Disable Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleEnableActivity(act.id)}
                        className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                          act.isEnabled
                            ? 'bg-calm-primary/10 border-calm-primary/30 text-calm-primary'
                            : 'bg-calm-card border-calm-border text-calm-muted'
                        }`}
                        aria-label={
                          act.isEnabled
                            ? t('sleepPrepToggleDisable')
                            : t('sleepPrepToggleEnable')
                        }
                      >
                        {act.isEnabled ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Activities List */}
            <div className="pt-4 border-t border-calm-border space-y-4">
              <h4 className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                {t('sleepPrepCustomTitle')}
              </h4>

              {/* Existing custom activities */}
              {prepPreferences.customActivities && prepPreferences.customActivities.length > 0 && (
                <div className="space-y-2">
                  {prepPreferences.customActivities.map((ca) => (
                    <div
                      key={ca.id}
                      className="p-3 rounded-xl bg-calm-surface border border-calm-border flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-calm-text font-medium">{ca.title}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleEnableCustomActivity(ca.id)}
                          className={`p-1.5 rounded-lg border text-xs ${
                            ca.isEnabled
                              ? 'bg-calm-primary/10 border-calm-primary/30 text-calm-primary'
                              : 'bg-calm-card border-calm-border text-calm-muted'
                          }`}
                        >
                          {ca.isEnabled ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomActivity(ca.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300"
                          aria-label={t('sleepPrepCustomDelete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Activity Form */}
              <form onSubmit={handleAddCustomActivity} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={100}
                  value={newCustomTitle}
                  onChange={(e) => setNewCustomTitle(e.target.value)}
                  placeholder={t('sleepPrepCustomAddPlaceholder')}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-calm-surface border border-calm-border text-calm-text placeholder:text-calm-muted/60 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
                />
                <button
                  type="submit"
                  disabled={!newCustomTitle.trim()}
                  className="px-4 py-2.5 rounded-xl bg-calm-primary text-white font-medium text-sm hover:bg-calm-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('sleepPrepCustomAddButton')}</span>
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : (
        /* 4. Interactive Checklist View (Normal Routine Mode) */
        <section aria-label="Bedtime Checklist" className="space-y-4">
          {totalSteps === 0 ? (
            <div className="p-8 rounded-2xl bg-calm-card border border-calm-border text-center space-y-3">
              <ListChecks className="w-10 h-10 text-calm-muted/50 mx-auto" />
              <p className="text-sm text-calm-muted max-w-md mx-auto">
                {t('sleepPrepEmptyRoutine')}
              </p>
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="px-4 py-2 rounded-xl bg-calm-surface border border-calm-border text-calm-text text-sm font-medium hover:bg-calm-surface/80"
              >
                {t('sleepPrepCustomizeToggle')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Built-in Activities */}
              {activeActivities.map((act) => {
                const status = prepProgress[act.id] || 'pending';
                const isCompleted = status === 'completed';
                const isSkipped = status === 'skipped';
                const title = t(act.titleKey as TranslationKey);
                const desc = t(act.descriptionKey as TranslationKey);

                return (
                  <div
                    key={act.id}
                    className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'bg-calm-card/80 border-calm-primary/30 shadow-sm'
                        : isSkipped
                        ? 'bg-calm-card/40 border-calm-border/40 opacity-70'
                        : 'bg-calm-card border-calm-border shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1">
                      {/* Checkbox Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(act.id)}
                        className={`mt-0.5 p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                          isCompleted
                            ? 'text-calm-primary'
                            : 'text-calm-muted hover:text-calm-text'
                        }`}
                        aria-label={
                          isCompleted
                            ? t('sleepPrepMarkPending')
                            : t('sleepPrepMarkComplete')
                        }
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 fill-calm-primary/20" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>

                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-base font-semibold transition-colors ${
                              isCompleted
                                ? 'text-calm-text'
                                : isSkipped
                                ? 'text-calm-muted line-through'
                                : 'text-calm-text'
                            }`}
                          >
                            {title}
                          </span>
                          {act.durationMinutes && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-calm-surface border border-calm-border text-calm-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{t('sleepPrepDurationMinutes', { minutes: act.durationMinutes })}</span>
                            </span>
                          )}
                          {isSkipped && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/40 font-medium">
                              {t('sleepPrepStatusSkipped')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-calm-muted leading-relaxed">{desc}</p>
                      </div>
                    </div>

                    {/* Step Actions */}
                    <div className="flex flex-wrap items-center gap-2 ps-9 sm:ps-0 self-start sm:self-center">
                      {/* Integration Actions */}
                      {act.activityType === 'breathing' && !isCompleted && !isSkipped && (
                        <button
                          type="button"
                          onClick={() => startBreathingSetup('4_7_8_relax')}
                          className="px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                        >
                          <Wind className="w-3.5 h-3.5" />
                          <span>{t('sleepPrepActionBreathing')}</span>
                        </button>
                      )}

                      {act.activityType === 'relaxation' && !isCompleted && !isSkipped && (
                        <button
                          type="button"
                          onClick={() => startRelaxationSetup(eveningSession)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                          <Headphones className="w-3.5 h-3.5" />
                          <span>{t('sleepPrepActionRelaxation')}</span>
                        </button>
                      )}

                      {act.activityType === 'soundscape' && !isCompleted && !isSkipped && (
                        <button
                          type="button"
                          onClick={() => setIsTimerModalOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>{t('sleepPrepActionSleepTimer')}</span>
                        </button>
                      )}

                      {/* Skip / Unskip Toggle */}
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleToggleSkip(act.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-calm-surface border border-calm-border text-xs text-calm-muted hover:text-calm-text transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
                        >
                          <SkipForward className="w-3 h-3" />
                          <span>{isSkipped ? t('sleepPrepUnskip') : t('sleepPrepSkip')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Custom Activities */}
              {activeCustomActivities.map((ca) => {
                const status = prepProgress[ca.id] || 'pending';
                const isCompleted = status === 'completed';
                const isSkipped = status === 'skipped';

                return (
                  <div
                    key={ca.id}
                    className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'bg-calm-card/80 border-calm-primary/30 shadow-sm'
                        : isSkipped
                        ? 'bg-calm-card/40 border-calm-border/40 opacity-70'
                        : 'bg-calm-card border-calm-border shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(ca.id)}
                        className={`mt-0.5 p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                          isCompleted
                            ? 'text-calm-primary'
                            : 'text-calm-muted hover:text-calm-text'
                        }`}
                        aria-label={
                          isCompleted
                            ? t('sleepPrepMarkPending')
                            : t('sleepPrepMarkComplete')
                        }
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 fill-calm-primary/20" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>

                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-base font-semibold ${
                              isCompleted
                                ? 'text-calm-text'
                                : isSkipped
                                ? 'text-calm-muted line-through'
                                : 'text-calm-text'
                            }`}
                          >
                            {ca.title}
                          </span>
                          {isSkipped && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/40 font-medium">
                              {t('sleepPrepStatusSkipped')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ps-9 sm:ps-0 self-start sm:self-center">
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleToggleSkip(ca.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-calm-surface border border-calm-border text-xs text-calm-muted hover:text-calm-text transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
                        >
                          <SkipForward className="w-3 h-3" />
                          <span>{isSkipped ? t('sleepPrepUnskip') : t('sleepPrepSkip')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 5. Integrated Modals */}
      {/* Breathing Setup Modal */}
      {setupTechnique && (
        <BreathingSetupModal
          technique={setupTechnique}
          onClose={closeBreathingSetup}
          onBegin={beginBreathingSession}
        />
      )}

      {/* Breathing Active Player (if initiated from routine) */}
      {isBreathingActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-calm-card rounded-3xl border border-calm-border p-6 shadow-2xl">
            <BreathingPlayer />
          </div>
        </div>
      )}

      {/* Breathing Completion Modal */}
      {breathingLiveState.status === 'completed' && (
        <BreathingCompletionModal onDismiss={dismissBreathingCompletion} />
      )}

      {/* Relaxation Setup Modal */}
      {setupSession && (
        <RelaxationSetupModal
          session={setupSession}
          onClose={closeRelaxationSetup}
          onBegin={beginRelaxationSession}
        />
      )}

      {/* Sleep Timer Modal */}
      <SleepTimerModal
        isOpen={isTimerModalOpen}
        onClose={() => setIsTimerModalOpen(false)}
      />
    </div>
  );
};
