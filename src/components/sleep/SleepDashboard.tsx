/**
 * NeuroCalm & Fokus — Sleep Dashboard Component
 * Phase S4: Sleep status card, manual realtime recording actions, next schedule calculation,
 * quick access to planned modules (S5-S8), and recent sleep activity history.
 */

import React, { useState, useMemo } from 'react';
import {
  Moon,
  Sun,
  Clock,
  Calendar,
  CalendarClock,
  ListChecks,
  Headphones,
  BarChart3,
  AlertCircle,
  X,
  Smile,
  Meh,
  Frown,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useSleep } from '../../hooks/useSleep';
import { useLocale } from '../../context/LocaleContext';
import { SleepRating } from '../../types/sleep';
import { calculateNextBedtime, calculateNextWakeUp } from '../../utils/sleepScheduleUtils';
import { formatDuration } from '../../utils/dashboardMetrics';

/**
 * Format live elapsed seconds into a calm digital/text string.
 */
function formatElapsedTrackingTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours === 0) {
    return `${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

/**
 * Format wall-clock time string safely.
 */
function formatLocalClockTime(timestamp: number, locale: 'en' | 'ar'): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    const d = new Date(timestamp);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

export interface SleepDashboardProps {
  onOpenPreparation?: () => void;
  onOpenSounds?: () => void;
  onOpenSchedule?: () => void;
  onOpenInsights?: () => void;
}

export const SleepDashboard: React.FC<SleepDashboardProps> = ({
  onOpenPreparation,
  onOpenSounds,
  onOpenSchedule,
  onOpenInsights,
}) => {
  const { t, locale } = useLocale();
  const {
    activeSession,
    latestRecord,
    records,
    schedules,
    preferences,
    prepPreferences,
    prepProgress,
    elapsedSeconds,
    startSession,
    wakeUp,
    cancelSession,
    saveReflection,
  } = useSleep();

  // Local state for bedtime intention notes
  const [intentionNotes, setIntentionNotes] = useState('');
  // Cancel confirmation dialog state
  const [showCancelModal, setShowCancelModal] = useState(false);
  // Post-wake reflection state
  const [selectedRating, setSelectedRating] = useState<SleepRating | undefined>(undefined);
  const [reflectionNotes, setReflectionNotes] = useState('');
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);

  // Next schedule calculations via existing utilities
  const nextBedtime = useMemo(() => calculateNextBedtime(schedules), [schedules]);
  const nextWakeUp = useMemo(() => calculateNextWakeUp(schedules), [schedules]);

  // Phase S5: Preparation routine progress calculation for Quick Access Card
  const enabledActivities = useMemo(() => {
    return [
      ...prepPreferences.activities.filter((a) => a.isEnabled),
      ...(prepPreferences.customActivities || []).filter((ca) => ca.isEnabled),
    ];
  }, [prepPreferences]);

  const completedStepsCount = useMemo(() => {
    return enabledActivities.filter((a) => prepProgress[a.id] === 'completed').length;
  }, [enabledActivities, prepProgress]);

  // Handle Starting Sleep
  const handleStartSleep = () => {
    startSession(intentionNotes);
    setIntentionNotes('');
  };

  // Handle Waking Up
  const handleWakeUp = () => {
    wakeUp();
    setSelectedRating(undefined);
    setReflectionNotes('');
    setReflectionSubmitted(false);
  };

  // Handle Saving Morning Reflection
  const handleSaveReflection = (recordId: string) => {
    if (!selectedRating) return;
    saveReflection(recordId, selectedRating, reflectionNotes);
    setReflectionSubmitted(true);
  };

  // Confirm cancel
  const handleConfirmCancel = () => {
    cancelSession();
    setShowCancelModal(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Pillar Header & Philosophy */}
      <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm text-start">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Moon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('sleepTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('sleepDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Philosophy Callout */}
      <div className="p-4 sm:p-5 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3.5 text-start">
        <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
        <p className="text-sm text-calm-text font-medium">
          {t('actionSleepMessage')}
        </p>
      </div>

      {/* 2. Sleep Status & Manual Recording Card (Sections A & B) */}
      <section
        aria-labelledby="sleep-status-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6 text-start"
      >
        <div className="flex items-center justify-between border-b border-calm-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <Moon className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h3 id="sleep-status-heading" className="text-lg font-semibold text-calm-text">
              {t('sleepStatusTitle')}
            </h3>
          </div>
          {/* Status Badge */}
          {activeSession ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" aria-hidden="true" />
              <span>{t('sleepStatusTracking')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-calm-surface border border-calm-border text-calm-muted text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden="true" />
              <span>{t('sleepStatusIdle')}</span>
            </div>
          )}
        </div>

        {/* State Content */}
        {activeSession ? (
          /* Active Sleep Tracking View */
          <div className="space-y-6">
            <p className="text-sm text-calm-muted leading-relaxed">
              {t('sleepStatusTrackingDesc')}
            </p>

            {/* Timer & Details Display */}
            <div className="p-6 rounded-xl bg-calm-surface border border-calm-border text-center space-y-4">
              <div className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                {t('sleepSessionElapsed')}
              </div>
              <div
                className="text-4xl sm:text-5xl font-mono font-bold text-indigo-300 tracking-wider"
                aria-live="polite"
              >
                {formatElapsedTrackingTime(elapsedSeconds)}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-calm-muted pt-2 border-t border-calm-border/50">
                <span>
                  {t('sleepSessionStartedAt')}:{' '}
                  <strong className="text-calm-text font-mono">
                    {formatLocalClockTime(activeSession.startedAt, locale)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  {t('sleepAnchorNight')}:{' '}
                  <strong className="text-calm-text font-mono">{activeSession.sleepDate}</strong>
                </span>
              </div>
              {activeSession.notes && (
                <div className="text-xs text-calm-muted italic bg-calm-card/60 p-2.5 rounded-lg border border-calm-border/40 max-w-md mx-auto text-start">
                  &ldquo;{activeSession.notes}&rdquo;
                </div>
              )}
            </div>

            {/* Actions: Wake Up & Cancel */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleWakeUp}
                className="w-full sm:flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-calm-primary text-white font-medium hover:bg-calm-primary/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary shadow-sm"
              >
                <Sun className="w-5 h-5" aria-hidden="true" />
                <span>{t('sleepWakeAction')}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-calm-surface border border-calm-border text-calm-muted hover:text-red-400 hover:border-red-400/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 text-sm font-medium"
              >
                {t('sleepCancelAction')}
              </button>
            </div>
          </div>
        ) : (
          /* Idle View (Ready to Sleep) */
          <div className="space-y-6">
            <p className="text-sm text-calm-muted leading-relaxed">
              {t('sleepStatusIdleDesc')}
            </p>

            {/* Optional Intention / Bedtime Note */}
            <div className="space-y-2">
              <label htmlFor="bedtime-intention-note" className="text-xs font-medium text-calm-muted">
                {t('sleepIntentionNotesPlaceholder')}
              </label>
              <input
                id="bedtime-intention-note"
                type="text"
                maxLength={280}
                value={intentionNotes}
                onChange={(e) => setIntentionNotes(e.target.value)}
                placeholder={t('sleepIntentionNotesPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-calm-surface border border-calm-border text-calm-text placeholder:text-calm-muted/60 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
              />
            </div>

            {/* Start Sleep Button */}
            <button
              type="button"
              onClick={handleStartSleep}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-sm"
            >
              <Moon className="w-5 h-5" aria-hidden="true" />
              <span>{t('sleepStartAction')}</span>
            </button>
          </div>
        )}

        {/* Latest Completed Sleep Record Summary (when not tracking or just completed) */}
        {!activeSession && latestRecord && (
          <div className="mt-6 pt-6 border-t border-calm-border/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                {t('sleepLatestCompletedTitle')}
              </span>
              <span className="text-xs font-mono text-calm-muted">
                {latestRecord.sleepDate}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-calm-surface border border-calm-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-calm-text">
                    {formatDuration(latestRecord.durationMinutes, locale)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-calm-card border border-calm-border text-calm-muted">
                    {latestRecord.source === 'manual_realtime'
                      ? t('sleepRecordSourceRealtime')
                      : t('sleepRecordSourceRetroactive')}
                  </span>
                  {latestRecord.corrections && latestRecord.corrections.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      {t('sleepRecordEditedBadge')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-calm-muted font-mono">
                  {formatLocalClockTime(latestRecord.startedAt, locale)} –{' '}
                  {formatLocalClockTime(latestRecord.endedAt, locale)}
                </p>
              </div>

              {/* Reflection Status Badge if already saved */}
              {latestRecord.rating ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-indigo-500/10 border-indigo-500/20 text-indigo-300 self-start sm:self-auto">
                  {latestRecord.rating === 'rested' && <Smile className="w-3.5 h-3.5 text-calm-primary" />}
                  {latestRecord.rating === 'neutral' && <Meh className="w-3.5 h-3.5 text-sky-400" />}
                  {latestRecord.rating === 'tired' && <Frown className="w-3.5 h-3.5 text-slate-300" />}
                  <span>
                    {latestRecord.rating === 'rested' && t('sleepRecordRatingRested')}
                    {latestRecord.rating === 'neutral' && t('sleepRecordRatingNeutral')}
                    {latestRecord.rating === 'tired' && t('sleepRecordRatingTired')}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Clock anomaly notice if flagged */}
            {latestRecord.isFlaggedForReview && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{t('sleepRecordFlaggedNotice')}</span>
              </div>
            )}

            {/* Gentle Morning Reflection Check-in Prompt (if enabled & not yet rated) */}
            {preferences.morningCheckInEnabled && !latestRecord.rating && !reflectionSubmitted && (
              <div className="p-4 rounded-xl bg-calm-surface/80 border border-calm-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-calm-text">
                    {t('sleepReflectionPrompt')}
                  </span>
                  <span className="text-[11px] text-calm-muted">
                    {t('sleepReflectionOptional')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRating('rested')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                      selectedRating === 'rested'
                        ? 'bg-calm-primary/20 border-calm-primary text-calm-primary'
                        : 'bg-calm-card border-calm-border text-calm-muted hover:text-calm-text'
                    }`}
                  >
                    <Smile className="w-4 h-4" />
                    <span>{t('sleepRecordRatingRested')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRating('neutral')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      selectedRating === 'neutral'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-calm-card border-calm-border text-calm-muted hover:text-calm-text'
                    }`}
                  >
                    <Meh className="w-4 h-4" />
                    <span>{t('sleepRecordRatingNeutral')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRating('tired')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      selectedRating === 'tired'
                        ? 'bg-slate-500/20 border-slate-400 text-slate-200'
                        : 'bg-calm-card border-calm-border text-calm-muted hover:text-calm-text'
                    }`}
                  >
                    <Frown className="w-4 h-4" />
                    <span>{t('sleepRecordRatingTired')}</span>
                  </button>
                </div>

                {selectedRating && (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      maxLength={280}
                      value={reflectionNotes}
                      onChange={(e) => setReflectionNotes(e.target.value)}
                      placeholder="Optional reflection note..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-calm-card border border-calm-border text-calm-text text-xs placeholder:text-calm-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveReflection(latestRecord.id)}
                      className="px-3 py-1.5 rounded-lg bg-calm-primary text-white text-xs font-medium hover:bg-calm-primary/90 transition-colors"
                    >
                      {t('sleepReflectionSave')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Next Schedule Card (Section C) */}
      <section
        aria-labelledby="next-schedule-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4 text-start"
      >
        <div className="flex items-center justify-between border-b border-calm-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h3 id="next-schedule-heading" className="text-lg font-semibold text-calm-text">
              {t('sleepNextScheduleTitle')}
            </h3>
          </div>
          {onOpenSchedule && (
            <button
              type="button"
              onClick={onOpenSchedule}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {t('sleepScheduleEditButton')} →
            </button>
          )}
        </div>

        {nextBedtime || nextWakeUp ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Next Bedtime */}
            <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1.5">
              <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                {t('sleepNextBedtimeLabel')}
              </span>
              <div className="text-2xl font-bold font-mono text-calm-text">
                {nextBedtime ? nextBedtime.formattedTime : '—'}
              </div>
              <div className="text-xs text-calm-muted">
                {nextBedtime ? `${nextBedtime.scheduleDate}` : 'No upcoming bedtime'}
              </div>
              {nextBedtime && nextBedtime.schedule.bedtimeReminder.enabled && (
                <div className="text-[11px] text-teal-400 pt-1">
                  {t('sleepReminderLeadNotice', {
                    minutes: nextBedtime.schedule.bedtimeReminder.leadTimeMinutes,
                  })}
                </div>
              )}
            </div>

            {/* Next Wake-up */}
            <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1.5">
              <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                {t('sleepNextWakeLabel')}
              </span>
              <div className="text-2xl font-bold font-mono text-calm-text">
                {nextWakeUp ? nextWakeUp.formattedTime : '—'}
              </div>
              <div className="text-xs text-calm-muted">
                {nextWakeUp ? `${nextWakeUp.scheduleDate}` : 'No upcoming wake-up'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-calm-surface/60 border border-calm-border/60 text-center space-y-3">
            <Calendar className="w-8 h-8 text-calm-muted/60 mx-auto" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-calm-text">{t('sleepNoScheduleTitle')}</h4>
            <p className="text-xs text-calm-muted max-w-md mx-auto leading-relaxed">
              {t('sleepNoScheduleDesc')}
            </p>
            {onOpenSchedule && (
              <button
                type="button"
                onClick={onOpenSchedule}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <span>{t('sleepScheduleConfigureButton')}</span>
                <span>→</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* 4. Quick Access Grid (Section D) */}
      <section
        aria-labelledby="quick-access-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4 text-start"
      >
        <div>
          <h3 id="quick-access-heading" className="text-lg font-semibold text-calm-text">
            {t('sleepQuickAccessTitle')}
          </h3>
          <p className="text-xs text-calm-muted mt-1">
            {t('sleepQuickAccessSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Module 1: Sleep Preparation (Phase S5: Active & Interactive) */}
          <div
            onClick={onOpenPreparation}
            role={onOpenPreparation ? 'button' : undefined}
            tabIndex={onOpenPreparation ? 0 : undefined}
            onKeyDown={(e) => {
              if (onOpenPreparation && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenPreparation();
              }
            }}
            className={`p-4 rounded-xl border space-y-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
              onOpenPreparation
                ? 'bg-calm-surface hover:bg-calm-surface/80 border-calm-border cursor-pointer shadow-sm'
                : 'bg-calm-surface/60 border-calm-border/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <ListChecks className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                {t('sleepPrepActiveBadge')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepModulePrepTitle')}
              </h4>
              <p className="text-xs text-calm-muted leading-relaxed mt-0.5">
                {t('sleepModulePrepDesc')}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-calm-border/40 text-xs">
              <span className="text-calm-muted">
                {t('sleepPrepProgressSummary', {
                  completed: completedStepsCount,
                  total: enabledActivities.length,
                })}
              </span>
              <span className="text-calm-primary font-medium flex items-center gap-1">
                <span>{t('sleepPrepOpenRoutine')}</span>
                <span>→</span>
              </span>
            </div>
          </div>

          {/* Module 2: Sleep Sounds */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenSounds}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSounds?.();
              }
            }}
            className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-2.5 text-start hover:border-indigo-500/40 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Headphones className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {t('sleepSoundsActiveBadge')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepModuleSoundsTitle')}
              </h4>
              <p className="text-xs text-calm-muted leading-relaxed mt-0.5">
                {t('sleepModuleSoundsDesc')}
              </p>
            </div>
            <div className="flex items-center justify-end pt-2 border-t border-calm-border/40 text-xs">
              <span className="text-indigo-400 font-medium flex items-center gap-1">
                <span>{t('sleepSoundsOpenRoutine')}</span>
                <span>→</span>
              </span>
            </div>
          </div>

          {/* Module 3: Sleep Schedule */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenSchedule}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSchedule?.();
              }
            }}
            className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-2.5 text-start hover:border-amber-500/40 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <CalendarClock className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {t('sleepScheduleActiveBadge')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepModuleScheduleTitle')}
              </h4>
              <p className="text-xs text-calm-muted leading-relaxed mt-0.5">
                {t('sleepModuleScheduleDesc')}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-calm-border/40 text-xs">
              <span className="text-calm-muted">
                {schedules.length > 0 && schedules[0].enabled
                  ? `${schedules[0].targetBedtime} – ${schedules[0].targetWakeTime}`
                  : t('sleepScheduleDisabled')}
              </span>
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <span>{t('sleepScheduleOpenRoutine')}</span>
                <span>→</span>
              </span>
            </div>
          </div>

          {/* Module 4: Sleep Insights */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenInsights}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenInsights?.();
              }
            }}
            className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-2.5 text-start hover:border-violet-500/40 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <BarChart3 className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {t('sleepInsightsActiveBadge')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepModuleInsightsTitle')}
              </h4>
              <p className="text-xs text-calm-muted leading-relaxed mt-0.5">
                {t('sleepModuleInsightsDesc')}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-calm-border/40 text-xs">
              <span className="text-calm-muted">
                {records.length > 0
                  ? t('sleepInsightsRecordsSummary', { count: records.length })
                  : t('sleepInsightsNoRecordsYet')}
              </span>
              <span className="text-violet-400 font-medium flex items-center gap-1">
                <span>{t('sleepInsightsOpenRoutine')}</span>
                <span>→</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Recent Sleep Activity (Section E) */}
      <section
        aria-labelledby="recent-activity-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4 text-start"
      >
        <div>
          <h3 id="recent-activity-heading" className="text-lg font-semibold text-calm-text">
            {t('sleepRecentActivityTitle')}
          </h3>
          <p className="text-xs text-calm-muted mt-1">
            {t('sleepRecentActivitySubtitle')}
          </p>
        </div>

        {records.length > 0 ? (
          <div className="space-y-3">
            {records.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="p-4 rounded-xl bg-calm-surface border border-calm-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-calm-text">
                      {formatDuration(record.durationMinutes, locale)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-calm-card border border-calm-border text-calm-muted">
                      {record.source === 'manual_realtime'
                        ? t('sleepRecordSourceRealtime')
                        : t('sleepRecordSourceRetroactive')}
                    </span>
                    {record.corrections && record.corrections.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        {t('sleepRecordEditedBadge')}
                      </span>
                    )}
                    {record.isFlaggedForReview && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Review</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-calm-muted font-mono">
                    <span>{record.sleepDate}</span>
                    <span className="mx-2">•</span>
                    <span>
                      {formatLocalClockTime(record.startedAt, locale)} –{' '}
                      {formatLocalClockTime(record.endedAt, locale)}
                    </span>
                  </div>
                  {record.notes && (
                    <p className="text-xs text-calm-muted italic pt-1">&ldquo;{record.notes}&rdquo;</p>
                  )}
                </div>

                {record.rating && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-indigo-500/10 border-indigo-500/20 text-indigo-300 self-start sm:self-auto">
                    {record.rating === 'rested' && <Smile className="w-3.5 h-3.5 text-calm-primary" />}
                    {record.rating === 'neutral' && <Meh className="w-3.5 h-3.5 text-sky-400" />}
                    {record.rating === 'tired' && <Frown className="w-3.5 h-3.5 text-slate-300" />}
                    <span>
                      {record.rating === 'rested' && t('sleepRecordRatingRested')}
                      {record.rating === 'neutral' && t('sleepRecordRatingNeutral')}
                      {record.rating === 'tired' && t('sleepRecordRatingTired')}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {records.length > 0 && onOpenInsights && (
              <div className="pt-2 text-center sm:text-end">
                <button
                  type="button"
                  onClick={onOpenInsights}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors inline-flex items-center gap-1"
                >
                  <span>{t('sleepInsightsViewAllHistory')}</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-calm-surface/60 border border-calm-border/60 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-calm-muted/60 mx-auto" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-calm-text">{t('sleepRecentEmptyTitle')}</h4>
            <p className="text-xs text-calm-muted max-w-md mx-auto leading-relaxed">
              {t('sleepRecentEmptyDesc')}
            </p>
          </div>
        )}
      </section>

      {/* Cancel Session Confirmation Modal */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-calm-card border border-calm-border p-6 shadow-xl space-y-5 text-start">
            <div className="flex items-center justify-between">
              <h4 id="cancel-modal-title" className="text-base font-semibold text-calm-text">
                {t('sleepCancelConfirmTitle')}
              </h4>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-calm-muted hover:text-calm-text p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-calm-muted leading-relaxed">
              {t('sleepCancelConfirmMessage')}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl bg-calm-surface border border-calm-border text-calm-text text-sm font-medium hover:bg-calm-surface/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
              >
                {t('sleepCancelConfirmKeep')}
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                {t('sleepCancelConfirmDiscard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
