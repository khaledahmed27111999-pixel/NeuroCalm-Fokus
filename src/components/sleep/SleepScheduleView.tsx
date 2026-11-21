/**
 * NeuroCalm & Fokus — Sleep Schedule & Preferences View
 * Phase S7: Dedicated schedule management interface for configuring
 * target bedtime, wake-up time, active weekdays, bedtime/wake reminders,
 * configurable anchor-night boundary, and morning reflection check-in.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  CalendarClock,
  Clock,
  Moon,
  Sun,
  Bell,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { useSleep } from '../../hooks/useSleep';
import { useLocale } from '../../context/LocaleContext';
import {
  DayOfWeek,
  ALL_DAYS_OF_WEEK,
  WORKDAYS_OF_WEEK,
  WEEKEND_DAYS_OF_WEEK,
  SleepSchedule,
} from '../../types/sleep';
import {
  isValidTimeString,
  isValidAnchorBoundary,
  DEFAULT_ANCHOR_BOUNDARY_TIME,
} from '../../utils/sleepTimeUtils';
import {
  calculateScheduleDurationMinutes,
  isCrossMidnightSchedule,
  calculateReminderClockTime,
} from '../../utils/sleepScheduleUtils';
import { createDefaultSleepSchedule } from '../../storage/sleepScheduleStorage';
import { formatDuration } from '../../utils/dashboardMetrics';
import { TranslationKey } from '../../types/locale';

interface SleepScheduleViewProps {
  onBack: () => void;
}

const LEAD_TIME_OPTIONS = [15, 30, 45, 60] as const;

export const SleepScheduleView: React.FC<SleepScheduleViewProps> = ({ onBack }) => {
  const { t, locale } = useLocale();
  const { schedules, preferences, saveSchedule, updatePreferences } = useSleep();

  // Primary active schedule or fallback default
  const existingSchedule = useMemo(() => {
    return schedules.length > 0 ? schedules[0] : null;
  }, [schedules]);

  // Form local state
  const [enabled, setEnabled] = useState<boolean>(
    existingSchedule ? existingSchedule.enabled : true
  );
  const [targetBedtime, setTargetBedtime] = useState<string>(
    existingSchedule ? existingSchedule.targetBedtime : '23:00'
  );
  const [targetWakeTime, setTargetWakeTime] = useState<string>(
    existingSchedule ? existingSchedule.targetWakeTime : '07:00'
  );
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(
    existingSchedule ? [...existingSchedule.daysOfWeek] : [...ALL_DAYS_OF_WEEK]
  );
  const [bedtimeReminderEnabled, setBedtimeReminderEnabled] = useState<boolean>(
    existingSchedule ? existingSchedule.bedtimeReminder.enabled : true
  );
  const [leadTimeMinutes, setLeadTimeMinutes] = useState<number>(
    existingSchedule ? existingSchedule.bedtimeReminder.leadTimeMinutes : 30
  );
  const [wakeReminderEnabled, setWakeReminderEnabled] = useState<boolean>(
    existingSchedule ? existingSchedule.wakeReminder.enabled : false
  );

  // Anchor Boundary & Morning Reflection (from SleepPreferences)
  const [anchorBoundaryTime, setAnchorBoundaryTime] = useState<string>(
    preferences.anchorBoundaryTime || DEFAULT_ANCHOR_BOUNDARY_TIME
  );
  const [morningCheckInEnabled, setMorningCheckInEnabled] = useState<boolean>(
    preferences.morningCheckInEnabled
  );

  // Status feedback
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Duration calculations
  const durationMinutes = useMemo(() => {
    return calculateScheduleDurationMinutes(targetBedtime, targetWakeTime);
  }, [targetBedtime, targetWakeTime]);

  const crossesMidnight = useMemo(() => {
    return isCrossMidnightSchedule(targetBedtime, targetWakeTime);
  }, [targetBedtime, targetWakeTime]);

  const calculatedReminderTime = useMemo(() => {
    return calculateReminderClockTime(targetBedtime, leadTimeMinutes);
  }, [targetBedtime, leadTimeMinutes]);

  // Weekday selection toggles
  const toggleDay = useCallback((day: DayOfWeek) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort((a, b) => a - b);
      }
    });
  }, []);

  const selectPresetDays = useCallback((preset: 'all' | 'workdays' | 'weekends') => {
    if (preset === 'all') {
      setDaysOfWeek([...ALL_DAYS_OF_WEEK]);
    } else if (preset === 'workdays') {
      setDaysOfWeek([...WORKDAYS_OF_WEEK]);
    } else if (preset === 'weekends') {
      setDaysOfWeek([...WEEKEND_DAYS_OF_WEEK]);
    }
  }, []);

  // Day label helpers
  const getDayShortKey = (day: DayOfWeek): TranslationKey => {
    const keys: TranslationKey[] = [
      'daySunShort',
      'dayMonShort',
      'dayTueShort',
      'dayWedShort',
      'dayThuShort',
      'dayFriShort',
      'daySatShort',
    ];
    return keys[day];
  };

  const getDayFullKey = (day: DayOfWeek): TranslationKey => {
    const keys: TranslationKey[] = [
      'daySunday',
      'dayMonday',
      'dayTuesday',
      'dayWednesday',
      'dayThursday',
      'dayFriday',
      'daySaturday',
    ];
    return keys[day];
  };

  // Reset all fields to clean defaults
  const handleResetDefaults = () => {
    const def = createDefaultSleepSchedule();
    setEnabled(def.enabled);
    setTargetBedtime(def.targetBedtime);
    setTargetWakeTime(def.targetWakeTime);
    setDaysOfWeek([...def.daysOfWeek]);
    setBedtimeReminderEnabled(def.bedtimeReminder.enabled);
    setLeadTimeMinutes(def.bedtimeReminder.leadTimeMinutes);
    setWakeReminderEnabled(def.wakeReminder.enabled);
    setAnchorBoundaryTime(DEFAULT_ANCHOR_BOUNDARY_TIME);
    setMorningCheckInEnabled(true);
    setSaveStatus('idle');
    setErrorMessage('');
  };

  // Save handler
  const handleSave = () => {
    setErrorMessage('');
    setSaveStatus('idle');

    // Validation 1: Times
    if (!isValidTimeString(targetBedtime) || !isValidTimeString(targetWakeTime)) {
      setErrorMessage(t('sleepScheduleValidationInvalidTime'));
      setSaveStatus('error');
      return;
    }

    // Validation 2: Weekdays
    if (enabled && daysOfWeek.length === 0) {
      setErrorMessage(t('sleepScheduleValidationNoDays'));
      setSaveStatus('error');
      return;
    }

    // Validation 3: Anchor Boundary
    if (!isValidAnchorBoundary(anchorBoundaryTime)) {
      setErrorMessage(t('sleepScheduleValidationInvalidAnchor'));
      setSaveStatus('error');
      return;
    }

    const now = Date.now();
    const schedulePayload: SleepSchedule = {
      id: existingSchedule ? existingSchedule.id : 'schedule_primary',
      version: 1,
      enabled,
      targetBedtime,
      targetWakeTime,
      daysOfWeek: [...daysOfWeek].sort((a, b) => a - b),
      bedtimeReminder: {
        enabled: bedtimeReminderEnabled,
        leadTimeMinutes,
      },
      wakeReminder: {
        enabled: wakeReminderEnabled,
      },
      createdAt: existingSchedule ? existingSchedule.createdAt : now,
      updatedAt: now,
    };

    const scheduleSaved = saveSchedule(schedulePayload);
    const prefsSaved = updatePreferences({
      anchorBoundaryTime,
      morningCheckInEnabled,
    });

    if (scheduleSaved && prefsSaved) {
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 4000);
    } else {
      setErrorMessage('Failed to save schedule preferences');
      setSaveStatus('error');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-start max-w-4xl mx-auto pb-12">
      {/* 1. Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-calm-border/60 pb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-calm-muted hover:text-calm-text transition-colors self-start"
          aria-label={t('sleepScheduleBackToDashboard')}
        >
          {locale === 'ar' ? (
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{t('sleepScheduleBackToDashboard')}</span>
        </button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
              enabled
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-teal-400' : 'bg-slate-500'}`} />
            <span>{enabled ? t('sleepScheduleEnabled') : t('sleepScheduleDisabled')}</span>
          </span>
        </div>
      </div>

      {/* Title & Philosophy Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <CalendarClock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('sleepScheduleNavTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('sleepScheduleNavSubtitle')}
            </p>
          </div>
        </div>

        {/* Philosophy Callout */}
        <div className="p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-calm-text font-medium leading-relaxed">
            {t('sleepSchedulePhilosophy')}
          </p>
        </div>
      </div>

      {/* 2. Schedule Activation Toggle Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-calm-card border border-calm-border flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-calm-text">
            {t('sleepScheduleToggleActive')}
          </h3>
          <p className="text-xs text-calm-muted">
            {enabled ? t('sleepScheduleEnabled') : t('sleepScheduleDisabled')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((prev) => !prev)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            enabled ? 'bg-indigo-600' : 'bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              enabled ? (locale === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 3. Bedtime & Wake-Up Times Section */}
      <section
        aria-labelledby="times-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
      >
        <div className="flex items-center gap-2.5 border-b border-calm-border/60 pb-4">
          <Clock className="w-5 h-5 text-indigo-400" aria-hidden="true" />
          <h3 id="times-heading" className="text-lg font-semibold text-calm-text">
            {t('sleepScheduleBedtimeSection')} & {t('sleepScheduleWakeSection')}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Bedtime Input */}
          <div className="p-5 rounded-xl bg-calm-surface border border-calm-border space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <Moon className="w-4 h-4" aria-hidden="true" />
              <label htmlFor="input-target-bedtime" className="text-sm font-semibold text-calm-text">
                {t('sleepScheduleBedtimeSection')}
              </label>
            </div>
            <p className="text-xs text-calm-muted">{t('sleepScheduleBedtimeHint')}</p>
            <input
              id="input-target-bedtime"
              type="time"
              value={targetBedtime}
              onChange={(e) => setTargetBedtime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-calm-card border border-calm-border text-lg font-mono font-bold text-calm-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Wake-Up Input */}
          <div className="p-5 rounded-xl bg-calm-surface border border-calm-border space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Sun className="w-4 h-4" aria-hidden="true" />
              <label htmlFor="input-target-wake" className="text-sm font-semibold text-calm-text">
                {t('sleepScheduleWakeSection')}
              </label>
            </div>
            <p className="text-xs text-calm-muted">{t('sleepScheduleWakeHint')}</p>
            <input
              id="input-target-wake"
              type="time"
              value={targetWakeTime}
              onChange={(e) => setTargetWakeTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-calm-card border border-calm-border text-lg font-mono font-bold text-calm-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Estimated Duration Banner */}
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-indigo-300">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span className="font-medium">
              {t('sleepScheduleDurationEstimated', {
                duration: formatDuration(durationMinutes, locale),
                crosses: crossesMidnight
                  ? t('sleepScheduleCrossesMidnight')
                  : t('sleepScheduleSameDay'),
              })}
            </span>
          </div>
          <span className="text-xs text-indigo-300/80 font-mono">
            {targetBedtime} → {targetWakeTime}
          </span>
        </div>
      </section>

      {/* 4. Active Weekdays Section */}
      <section
        aria-labelledby="days-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-calm-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <div>
              <h3 id="days-heading" className="text-lg font-semibold text-calm-text">
                {t('sleepScheduleDaysSection')}
              </h3>
              <p className="text-xs text-calm-muted mt-0.5">{t('sleepScheduleDaysHint')}</p>
            </div>
          </div>
          <span className="text-xs text-calm-muted font-medium self-start sm:self-auto">
            {t('sleepScheduleSummaryDays', { count: daysOfWeek.length })}
          </span>
        </div>

        {/* Weekday Selection Chips */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {ALL_DAYS_OF_WEEK.map((day) => {
            const isSelected = daysOfWeek.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={isSelected}
                aria-label={t(getDayFullKey(day))}
                className={`flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-calm-surface border-calm-border text-calm-muted hover:text-calm-text hover:border-calm-border/80'
                }`}
              >
                <span>{t(getDayShortKey(day))}</span>
                <span className="text-[10px] mt-1 font-normal opacity-75">
                  {isSelected ? '✓' : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-calm-border/40">
          <button
            type="button"
            onClick={() => selectPresetDays('all')}
            className="px-3 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-xs font-medium text-calm-muted hover:text-calm-text transition-colors"
          >
            {t('sleepScheduleSelectAllDays')}
          </button>
          <button
            type="button"
            onClick={() => selectPresetDays('workdays')}
            className="px-3 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-xs font-medium text-calm-muted hover:text-calm-text transition-colors"
          >
            {t('sleepScheduleSelectWorkdays')}
          </button>
          <button
            type="button"
            onClick={() => selectPresetDays('weekends')}
            className="px-3 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-xs font-medium text-calm-muted hover:text-calm-text transition-colors"
          >
            {t('sleepScheduleSelectWeekends')}
          </button>
        </div>
      </section>

      {/* 5. Reminders Configuration */}
      <section
        aria-labelledby="reminders-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
      >
        <div className="flex items-center gap-2.5 border-b border-calm-border/60 pb-4">
          <Bell className="w-5 h-5 text-indigo-400" aria-hidden="true" />
          <h3 id="reminders-heading" className="text-lg font-semibold text-calm-text">
            {t('sleepScheduleRemindersSection')}
          </h3>
        </div>

        {/* Bedtime Preparation Reminder */}
        <div className="p-5 rounded-xl bg-calm-surface border border-calm-border space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepScheduleBedtimeReminder')}
              </h4>
              <p className="text-xs text-calm-muted">
                {t('sleepScheduleBedtimeReminderDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bedtimeReminderEnabled}
              onClick={() => setBedtimeReminderEnabled((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                bedtimeReminderEnabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  bedtimeReminderEnabled
                    ? locale === 'ar'
                      ? '-translate-x-5'
                      : 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Lead Time Selection */}
          {bedtimeReminderEnabled && (
            <div className="pt-3 border-t border-calm-border/40 space-y-2">
              <span className="text-xs font-medium text-calm-muted">
                {t('sleepScheduleReminderLeadLabel')}:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LEAD_TIME_OPTIONS.map((mins) => {
                  const leadKey = `sleepScheduleReminderLead${mins}` as TranslationKey;
                  const isSelected = leadTimeMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setLeadTimeMinutes(mins)}
                      aria-pressed={isSelected}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                          : 'bg-calm-card border-calm-border text-calm-muted hover:text-calm-text'
                      }`}
                    >
                      {t(leadKey)}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-teal-400 font-mono pt-1">
                {t('sleepScheduleCalculatedReminderTime', { time: calculatedReminderTime })}
              </div>
            </div>
          )}
        </div>

        {/* Wake-Up Reminder */}
        <div className="p-5 rounded-xl bg-calm-surface border border-calm-border space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepScheduleWakeReminder')}
              </h4>
              <p className="text-xs text-calm-muted">
                {t('sleepScheduleWakeReminderDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={wakeReminderEnabled}
              onClick={() => setWakeReminderEnabled((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                wakeReminderEnabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  wakeReminderEnabled
                    ? locale === 'ar'
                      ? '-translate-x-5'
                      : 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {wakeReminderEnabled && (
            <div className="text-xs text-teal-400 font-mono pt-1 border-t border-calm-border/40">
              {t('sleepScheduleCalculatedReminderTime', { time: targetWakeTime })}
            </div>
          )}
        </div>

        {/* Notification Limitations Notice */}
        <div className="p-4 rounded-xl bg-calm-surface border border-calm-border flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-calm-muted leading-relaxed">
            {t('sleepScheduleNotificationNotice')}
          </p>
        </div>
      </section>

      {/* 6. Anchor Night Boundary & Reflection Settings */}
      <section
        aria-labelledby="anchor-heading"
        className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
      >
        <div className="flex items-center gap-2.5 border-b border-calm-border/60 pb-4">
          <Moon className="w-5 h-5 text-indigo-400" aria-hidden="true" />
          <h3 id="anchor-heading" className="text-lg font-semibold text-calm-text">
            {t('sleepScheduleAnchorSection')}
          </h3>
        </div>

        <div className="space-y-4">
          {/* Anchor Boundary Time */}
          <div className="p-5 rounded-xl bg-calm-surface border border-calm-border space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label htmlFor="input-anchor-boundary" className="text-sm font-semibold text-calm-text">
                {t('sleepScheduleAnchorBoundary')}
              </label>
              <input
                id="input-anchor-boundary"
                type="time"
                value={anchorBoundaryTime}
                onChange={(e) => setAnchorBoundaryTime(e.target.value)}
                className="w-32 px-3 py-2 rounded-xl bg-calm-card border border-calm-border text-sm font-mono font-bold text-calm-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-calm-muted leading-relaxed">
              {t('sleepScheduleAnchorHint')}
            </p>
          </div>

          {/* Morning Check-In Prompt Toggle */}
          <div className="p-5 rounded-xl bg-calm-surface border border-calm-border flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-calm-text">
                {t('sleepScheduleMorningCheckIn')}
              </h4>
              <p className="text-xs text-calm-muted">
                {t('sleepScheduleMorningCheckInDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={morningCheckInEnabled}
              onClick={() => setMorningCheckInEnabled((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                morningCheckInEnabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  morningCheckInEnabled
                    ? locale === 'ar'
                      ? '-translate-x-5'
                      : 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 7. Action Buttons & Feedback */}
      <div className="space-y-3">
        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
            <span>{t('sleepScheduleSaveSuccess')}</span>
          </div>
        )}

        {saveStatus === 'error' && errorMessage && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-calm-surface border border-calm-border text-xs text-calm-muted hover:text-calm-text transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('sleepScheduleResetDefaults')}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>{t('sleepScheduleSaveChanges')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
