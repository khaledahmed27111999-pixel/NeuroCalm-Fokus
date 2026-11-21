/**
 * NeuroCalm & Fokus — Sleep Insights & Analytics View
 * Phase S8: Dedicated insights and analytics interface for descriptive
 * summaries, historical interval trends, schedule comparisons,
 * and morning reflection distributions.
 *
 * All metrics reflect manual timestamps and are strictly non-medical.
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Moon,
  Clock,
  Smile,
  Meh,
  Frown,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Info,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { useSleep } from '../../hooks/useSleep';
import { useLocale } from '../../context/LocaleContext';
import {
  AnalyticsTimeRange,
  filterRecordsByRange,
  calculateSleepOverviewStats,
  calculateNightlyTrendBuckets,
  calculateMorningCheckInStats,
  calculateConsistencyMetrics,
  calculateScheduleComparisons,
} from '../../utils/sleepAnalyticsUtils';
import { formatDuration } from '../../utils/dashboardMetrics';
import { TranslationKey } from '../../types/locale';

interface SleepInsightsViewProps {
  onBack: () => void;
}

export const SleepInsightsView: React.FC<SleepInsightsViewProps> = ({ onBack }) => {
  const { t, locale } = useLocale();
  const { records, schedules, preferences } = useSleep();

  // Active time range filter
  const [selectedRange, setSelectedRange] = useState<AnalyticsTimeRange>('7d');

  // Currently active schedule (if any)
  const activeSchedule = useMemo(() => {
    return schedules.find((s) => s.enabled);
  }, [schedules]);

  // Filter records by selected range
  const filteredRecords = useMemo(() => {
    return filterRecordsByRange(
      records,
      selectedRange,
      new Date(),
      preferences.anchorBoundaryTime || '06:00'
    );
  }, [records, selectedRange, preferences.anchorBoundaryTime]);

  // Statistical calculations
  const overview = useMemo(() => {
    return calculateSleepOverviewStats(filteredRecords);
  }, [filteredRecords]);

  const trendBuckets = useMemo(() => {
    return calculateNightlyTrendBuckets(
      filteredRecords,
      selectedRange,
      new Date(),
      preferences.anchorBoundaryTime || '06:00'
    );
  }, [filteredRecords, selectedRange, preferences.anchorBoundaryTime]);

  const checkInStats = useMemo(() => {
    return calculateMorningCheckInStats(filteredRecords);
  }, [filteredRecords]);

  const consistency = useMemo(() => {
    return calculateConsistencyMetrics(filteredRecords);
  }, [filteredRecords]);

  const scheduleComparison = useMemo(() => {
    return calculateScheduleComparisons(filteredRecords, activeSchedule);
  }, [filteredRecords, activeSchedule]);

  // Max duration in trend buckets for scaling the chart (minimum 8 hours / 480 mins)
  const maxChartMinutes = useMemo(() => {
    const maxInBuckets = Math.max(
      ...trendBuckets.map((b) => b.totalDurationMinutes),
      0
    );
    return Math.max(maxInBuckets, 480);
  }, [trendBuckets]);

  // Time format helper
  const formatClockTime = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      const d = new Date(timestamp);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  };

  // Day short name helper
  const getDayShortKey = (day: number): TranslationKey => {
    const keys: TranslationKey[] = [
      'daySunShort',
      'dayMonShort',
      'dayTueShort',
      'dayWedShort',
      'dayThuShort',
      'dayFriShort',
      'daySatShort',
    ];
    return keys[day] || 'daySunShort';
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-start max-w-4xl mx-auto pb-12">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-calm-border/60 pb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-calm-muted hover:text-calm-text transition-colors self-start"
          aria-label={t('sleepInsightsBackToDashboard')}
        >
          {locale === 'ar' ? (
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{t('sleepInsightsBackToDashboard')}</span>
        </button>

        {/* Time Range Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-calm-surface border border-calm-border self-start sm:self-auto">
          {(['7d', '14d', '30d', 'all'] as const).map((r) => {
            const keyMap = {
              '7d': 'sleepInsightsRange7d',
              '14d': 'sleepInsightsRange14d',
              '30d': 'sleepInsightsRange30d',
              all: 'sleepInsightsRangeAll',
            } as const;
            const isSelected = selectedRange === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRange(r)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-calm-muted hover:text-calm-text'
                }`}
              >
                {t(keyMap[r])}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title & Philosophy Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
            <BarChart3 className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-calm-text">
              {t('sleepInsightsNavTitle')}
            </h2>
            <p className="text-sm sm:text-base text-calm-muted leading-relaxed">
              {t('sleepInsightsNavSubtitle')}
            </p>
          </div>
        </div>

        {/* Philosophy Callout */}
        <div className="p-4 rounded-xl bg-calm-surface border border-calm-border flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-calm-text font-medium leading-relaxed">
            {t('sleepInsightsPhilosophy')}
          </p>
        </div>

        {/* Transparent Disclaimer Callout */}
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-start gap-3">
          <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-violet-300 leading-relaxed">
            {t('sleepInsightsDisclaimer')}
          </p>
        </div>
      </div>

      {/* Empty State when no records exist */}
      {!overview.hasEnoughData ? (
        <div className="p-10 rounded-2xl bg-calm-card border border-calm-border text-center space-y-3">
          <Moon className="w-10 h-10 text-calm-muted/50 mx-auto" aria-hidden="true" />
          <h3 className="text-base font-semibold text-calm-text">
            {t('sleepInsightsNoDataTitle')}
          </h3>
          <p className="text-xs text-calm-muted max-w-md mx-auto leading-relaxed">
            {t('sleepInsightsNoDataDesc')}
          </p>
        </div>
      ) : (
        <>
          {/* 2. Overview Statistics Cards */}
          <section
            aria-labelledby="overview-heading"
            className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
          >
            <div className="flex items-center gap-2.5 border-b border-calm-border/60 pb-4">
              <TrendingUp className="w-5 h-5 text-violet-400" aria-hidden="true" />
              <h3 id="overview-heading" className="text-lg font-semibold text-calm-text">
                {t('sleepInsightsOverviewTitle')}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Card 1: Total Sessions */}
              <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                  {t('sleepInsightsTotalSessions')}
                </span>
                <div className="text-2xl font-bold font-mono text-calm-text">
                  {overview.totalRecords}
                </div>
                <div className="text-[11px] text-calm-muted">
                  {t('sleepInsightsUniqueNights')}: {overview.uniqueNights}
                </div>
              </div>

              {/* Card 2: Average Recorded Interval */}
              <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                  {t('sleepInsightsAvgInterval')}
                </span>
                <div className="text-2xl font-bold font-mono text-violet-300">
                  {formatDuration(overview.avgDurationMinutes, locale)}
                </div>
                <div className="text-[11px] text-calm-muted">
                  {overview.totalRecords} {overview.totalRecords === 1 ? 'session' : 'sessions'}
                </div>
              </div>

              {/* Card 3: Longest Interval */}
              <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                  {t('sleepInsightsLongestInterval')}
                </span>
                <div className="text-2xl font-bold font-mono text-teal-300">
                  {overview.longestRecord
                    ? formatDuration(overview.longestRecord.durationMinutes, locale)
                    : '—'}
                </div>
                <div className="text-[11px] text-calm-muted font-mono">
                  {overview.longestRecord ? overview.longestRecord.sleepDate : '—'}
                </div>
              </div>

              {/* Card 4: Shortest Interval */}
              <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                <span className="text-xs font-medium text-calm-muted uppercase tracking-wider">
                  {t('sleepInsightsShortestInterval')}
                </span>
                <div className="text-2xl font-bold font-mono text-amber-300">
                  {overview.shortestRecord
                    ? formatDuration(overview.shortestRecord.durationMinutes, locale)
                    : '—'}
                </div>
                <div className="text-[11px] text-calm-muted font-mono">
                  {overview.shortestRecord ? overview.shortestRecord.sleepDate : '—'}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-calm-muted/80 italic pt-1">
              {t('sleepInsightsIntervalDefinitionNotice')}
            </div>
          </section>

          {/* 3. Recorded Interval Trends (Visual Bar Chart) */}
          <section
            aria-labelledby="trends-heading"
            className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
          >
            <div className="space-y-1 border-b border-calm-border/60 pb-4">
              <h3 id="trends-heading" className="text-lg font-semibold text-calm-text">
                {t('sleepInsightsTrendsTitle')}
              </h3>
              <p className="text-xs text-calm-muted">
                {t('sleepInsightsTrendsSubtitle')}
              </p>
            </div>

            {/* Visual Bar Chart */}
            <div className="space-y-2">
              <div className="h-48 sm:h-56 flex items-end gap-1.5 sm:gap-2.5 pt-6 pb-2 border-b border-calm-border/60 overflow-x-auto">
                {trendBuckets.map((bucket) => {
                  const heightPercent = bucket.hasRecord
                    ? Math.min(100, Math.max(12, Math.round((bucket.totalDurationMinutes / maxChartMinutes) * 100)))
                    : 0;

                  // Bar color based on rating if available
                  const barColor = !bucket.hasRecord
                    ? 'bg-transparent'
                    : bucket.rating === 'rested'
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : bucket.rating === 'neutral'
                    ? 'bg-sky-500 hover:bg-sky-400'
                    : bucket.rating === 'tired'
                    ? 'bg-slate-400 hover:bg-slate-300'
                    : 'bg-violet-500 hover:bg-violet-400';

                  return (
                    <div
                      key={bucket.sleepDate}
                      className="flex-1 min-w-[28px] sm:min-w-[36px] flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-white shadow-xl whitespace-nowrap">
                          <div className="font-semibold">{bucket.sleepDate}</div>
                          {bucket.hasRecord ? (
                            <div>
                              {formatDuration(bucket.totalDurationMinutes, locale)}
                              {bucket.rating && ` (${bucket.rating})`}
                            </div>
                          ) : (
                            <div className="text-slate-400">{t('sleepInsightsNoRecordForNight')}</div>
                          )}
                        </div>
                        <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                      </div>

                      {/* Bar or Missing Dash */}
                      {bucket.hasRecord ? (
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[32px] rounded-t-md transition-all ${barColor}`}
                          aria-label={`${bucket.sleepDate}: ${formatDuration(bucket.totalDurationMinutes, locale)}`}
                        />
                      ) : (
                        <div
                          className="w-full max-w-[20px] h-1 bg-slate-700/60 rounded-full mb-1"
                          aria-label={`${bucket.sleepDate}: ${t('sleepInsightsNoRecordForNight')}`}
                        />
                      )}

                      {/* Day Label */}
                      <div className="text-[10px] text-calm-muted mt-2 font-mono truncate">
                        {t(getDayShortKey(bucket.dayOfWeek))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-calm-muted pt-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                    <span>{t('sleepInsightsNightlyDurationTitle')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-0.5 bg-slate-600" />
                    <span>{t('sleepInsightsNoRecordForNight')}</span>
                  </div>
                </div>
                <div className="text-[11px]">
                  Max scale: {formatDuration(maxChartMinutes, locale)}
                </div>
              </div>
            </div>

            {/* Consistency Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-calm-border/60">
              <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Moon className="w-4 h-4" />
                  <span className="text-xs font-semibold text-calm-text">
                    {t('sleepInsightsBedtimeConsistencyTitle')}
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-calm-text">
                  {consistency.hasEnoughData ? consistency.avgStartTimeFormatted : '—'}
                </div>
                <div className="text-xs text-calm-muted">
                  {consistency.hasEnoughData
                    ? `±${consistency.startStdDevMinutes}m dispersion`
                    : t('sleepInsightsInsufficientData')}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                <div className="flex items-center gap-2 text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-semibold text-calm-text">
                    {t('sleepInsightsWakeConsistencyTitle')}
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-calm-text">
                  {consistency.hasEnoughData ? consistency.avgWakeTimeFormatted : '—'}
                </div>
                <div className="text-xs text-calm-muted">
                  {consistency.hasEnoughData
                    ? `±${consistency.wakeStdDevMinutes}m dispersion`
                    : t('sleepInsightsInsufficientData')}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Schedule Comparison (if active schedule exists) */}
          {scheduleComparison.hasSchedule && (
            <section
              aria-labelledby="schedule-comp-heading"
              className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
            >
              <div className="space-y-1 border-b border-calm-border/60 pb-4">
                <h3 id="schedule-comp-heading" className="text-lg font-semibold text-calm-text">
                  {t('sleepInsightsScheduleComparisonTitle')}
                </h3>
                <p className="text-xs text-calm-muted">
                  {t('sleepInsightsScheduleComparisonSubtitle')}
                </p>
              </div>

              {scheduleComparison.totalCompared > 0 ? (
                <div className="space-y-4">
                  {/* Summary Difference Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                      <span className="text-xs text-calm-muted">
                        {t('sleepInsightsStartDiffPlanned')} ({activeSchedule?.targetBedtime})
                      </span>
                      <div className="text-lg font-bold font-mono text-calm-text">
                        {scheduleComparison.avgStartDiffMinutes === 0
                          ? t('sleepInsightsOnTime')
                          : scheduleComparison.avgStartDiffMinutes > 0
                          ? t('sleepInsightsLaterBy', { minutes: scheduleComparison.avgStartDiffMinutes })
                          : t('sleepInsightsEarlierBy', { minutes: Math.abs(scheduleComparison.avgStartDiffMinutes) })}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-calm-surface border border-calm-border space-y-1">
                      <span className="text-xs text-calm-muted">
                        {t('sleepInsightsWakeDiffPlanned')} ({activeSchedule?.targetWakeTime})
                      </span>
                      <div className="text-lg font-bold font-mono text-calm-text">
                        {scheduleComparison.avgWakeDiffMinutes === 0
                          ? t('sleepInsightsOnTime')
                          : scheduleComparison.avgWakeDiffMinutes > 0
                          ? t('sleepInsightsLaterBy', { minutes: scheduleComparison.avgWakeDiffMinutes })
                          : t('sleepInsightsEarlierBy', { minutes: Math.abs(scheduleComparison.avgWakeDiffMinutes) })}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-calm-muted italic pt-1">
                    {t('sleepInsightsScheduleComparisonDisclaimer')}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-calm-muted">
                  No completed sessions in this timeframe match the active schedule's configured weekdays.
                </p>
              )}
            </section>
          )}

          {/* 5. Morning Reflection Distribution */}
          <section
            aria-labelledby="checkin-heading"
            className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-6"
          >
            <div className="space-y-1 border-b border-calm-border/60 pb-4">
              <h3 id="checkin-heading" className="text-lg font-semibold text-calm-text">
                {t('sleepInsightsCheckInTitle')}
              </h3>
              <p className="text-xs text-calm-muted">
                {t('sleepInsightsCheckInSubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Rested */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Smile className="w-4 h-4" />
                  <span className="text-xs font-semibold">
                    {t('sleepRecordRatingRested')}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-300">
                  {checkInStats.restedCount}
                </div>
                <div className="text-[11px] text-emerald-400/80">
                  {checkInStats.restedPercent}% of ratings
                </div>
              </div>

              {/* Neutral */}
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-sky-400">
                  <Meh className="w-4 h-4" />
                  <span className="text-xs font-semibold">
                    {t('sleepRecordRatingNeutral')}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-sky-300">
                  {checkInStats.neutralCount}
                </div>
                <div className="text-[11px] text-sky-400/80">
                  {checkInStats.neutralPercent}% of ratings
                </div>
              </div>

              {/* Tired */}
              <div className="p-4 rounded-xl bg-slate-500/10 border border-slate-500/20 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Frown className="w-4 h-4" />
                  <span className="text-xs font-semibold">
                    {t('sleepRecordRatingTired')}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-200">
                  {checkInStats.tiredCount}
                </div>
                <div className="text-[11px] text-slate-400">
                  {checkInStats.tiredPercent}% of ratings
                </div>
              </div>
            </div>

            {checkInStats.unratedCount > 0 && (
              <div className="text-xs text-calm-muted pt-1">
                {t('sleepInsightsCheckInUnratedCount', { count: checkInStats.unratedCount })}
              </div>
            )}
          </section>

          {/* 6. Completed Records History Log */}
          <section
            aria-labelledby="history-heading"
            className="p-6 sm:p-8 rounded-2xl bg-calm-card border border-calm-border shadow-sm space-y-4"
          >
            <div className="space-y-1 border-b border-calm-border/60 pb-4">
              <h3 id="history-heading" className="text-lg font-semibold text-calm-text">
                {t('sleepInsightsHistoryTitle')}
              </h3>
              <p className="text-xs text-calm-muted">
                {t('sleepInsightsHistorySubtitle')}
              </p>
            </div>

            <div className="space-y-3">
              {filteredRecords.map((record) => (
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
                        {formatClockTime(record.startedAt)} – {formatClockTime(record.endedAt)}
                      </span>
                    </div>
                    {record.notes && (
                      <p className="text-xs text-calm-muted italic pt-1">&ldquo;{record.notes}&rdquo;</p>
                    )}
                  </div>

                  {/* Reflection Rating Badge */}
                  {record.rating && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-indigo-500/10 border-indigo-500/20 text-indigo-300 self-start sm:self-auto shrink-0">
                      {record.rating === 'rested' && <Smile className="w-3.5 h-3.5 text-emerald-400" />}
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
            </div>
          </section>
        </>
      )}
    </div>
  );
};
