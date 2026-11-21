/**
 * NeuroCalm & Fokus — Sleep Context & Provider
 * Phase S4 / S5: Centralized state management for manual sleep tracking sessions,
 * historical sleep records, planned schedules, sleep preferences, and customizable
 * pre-sleep wind-down preparation routines.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActiveSleepSession,
  SleepRecord,
  SleepSchedule,
  SleepPreferences,
  SleepPreparationPreferences,
  SleepRating,
} from '../types/sleep';
import {
  loadActiveSleepSession,
  startActiveSleepSession,
  clearActiveSleepSession,
} from '../storage/sleepActiveStorage';
import {
  loadSleepRecords,
  saveSleepRecord,
  updateMorningReflection,
} from '../storage/sleepRecordsStorage';
import {
  loadSleepSchedules,
  saveSleepSchedule,
  deleteSleepSchedule,
} from '../storage/sleepScheduleStorage';
import {
  loadSleepPreferences,
  saveSleepPreferences,
  DEFAULT_SLEEP_PREFERENCES,
} from '../storage/sleepPreferencesStorage';
import {
  loadSleepPrepPreferences,
  saveSleepPrepPreferences,
  resetSleepPrepPreferences,
} from '../storage/sleepPrepStorage';
import {
  loadSleepPrepDailyProgress,
  saveSleepPrepDailyProgress,
  clearSleepPrepDailyProgress,
  PrepItemStatus,
} from '../storage/sleepPrepProgressStorage';
import { calculateAnchorDate, calculateSleepDuration } from '../utils/sleepTimeUtils';
import { generateId } from '../utils/id';
import {
  SLEEP_ACTIVE_STORAGE_KEY,
  SLEEP_RECORDS_STORAGE_KEY,
  SLEEP_SCHEDULE_STORAGE_KEY,
  SLEEP_PREFERENCES_STORAGE_KEY,
  SLEEP_PREP_STORAGE_KEY,
  SLEEP_PREP_PROGRESS_STORAGE_KEY,
} from '../storage/sleepStorageKeys';

export interface SleepContextType {
  activeSession: ActiveSleepSession | null;
  latestRecord: SleepRecord | null;
  records: SleepRecord[];
  schedules: SleepSchedule[];
  preferences: SleepPreferences;
  prepPreferences: SleepPreparationPreferences;
  prepProgress: Record<string, PrepItemStatus>;
  elapsedSeconds: number;
  startSession: (notes?: string) => { success: boolean; error?: string };
  wakeUp: (
    rating?: SleepRating,
    notes?: string
  ) => { success: boolean; record?: SleepRecord; error?: string };
  cancelSession: () => void;
  saveReflection: (recordId: string, rating: SleepRating, notes?: string) => boolean;
  setItemStatus: (activityId: string, status: PrepItemStatus) => void;
  updatePrepPreferences: (prefs: SleepPreparationPreferences) => boolean;
  resetPrepToDefaults: () => void;
  resetTonightProgress: () => void;
  refreshData: () => void;
  // Phase S7: Schedule & Preferences Management
  saveSchedule: (schedule: SleepSchedule) => boolean;
  deleteSchedule: (scheduleId: string) => boolean;
  toggleScheduleEnabled: (scheduleId: string, enabled: boolean) => boolean;
  updatePreferences: (updates: Partial<SleepPreferences>) => boolean;
}

const SleepContext = createContext<SleepContextType | undefined>(undefined);

export const SleepProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSleepSession | null>(() =>
    loadActiveSleepSession()
  );
  const [records, setRecords] = useState<SleepRecord[]>(() => loadSleepRecords());
  const [schedules, setSchedules] = useState<SleepSchedule[]>(() => loadSleepSchedules());
  const [preferences, setPreferences] = useState<SleepPreferences>(() => {
    try {
      return loadSleepPreferences();
    } catch {
      return DEFAULT_SLEEP_PREFERENCES;
    }
  });

  // Current anchor date helper
  const currentAnchorDate = useMemo(() => {
    const boundary = preferences?.anchorBoundaryTime || '06:00';
    return calculateAnchorDate(Date.now(), boundary);
  }, [preferences]);

  // Sleep Preparation Preferences & Daily Progress
  const [prepPreferences, setPrepPreferences] = useState<SleepPreparationPreferences>(() =>
    loadSleepPrepPreferences()
  );
  const [prepProgress, setPrepProgress] = useState<Record<string, PrepItemStatus>>(() =>
    loadSleepPrepDailyProgress(currentAnchorDate)
  );

  const latestRecord = useMemo(() => {
    return records.length > 0 ? records[0] : null;
  }, [records]);

  // Elapsed tracking seconds
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const session = loadActiveSleepSession();
    if (!session) return 0;
    return Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
  });

  // Reconcile and tick elapsed time while a session is active
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - activeSession.startedAt) / 1000)));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const refreshData = useCallback(() => {
    setActiveSession(loadActiveSleepSession());
    setRecords(loadSleepRecords());
    setSchedules(loadSleepSchedules());
    try {
      setPreferences(loadSleepPreferences());
    } catch {
      setPreferences(DEFAULT_SLEEP_PREFERENCES);
    }
    setPrepPreferences(loadSleepPrepPreferences());
    setPrepProgress(loadSleepPrepDailyProgress(currentAnchorDate));
  }, [currentAnchorDate]);

  // Listen to window storage events for multi-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === SLEEP_ACTIVE_STORAGE_KEY ||
        e.key === SLEEP_RECORDS_STORAGE_KEY ||
        e.key === SLEEP_SCHEDULE_STORAGE_KEY ||
        e.key === SLEEP_PREFERENCES_STORAGE_KEY ||
        e.key === SLEEP_PREP_STORAGE_KEY ||
        e.key === SLEEP_PREP_PROGRESS_STORAGE_KEY
      ) {
        refreshData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshData]);

  const startSession = useCallback(
    (notes?: string): { success: boolean; error?: string } => {
      const existing = loadActiveSleepSession();
      if (existing) {
        setActiveSession(existing);
        return { success: false, error: 'A sleep session is already in progress' };
      }

      const now = Date.now();
      const currentPrefs = preferences || DEFAULT_SLEEP_PREFERENCES;
      const anchorDate = calculateAnchorDate(now, currentPrefs.anchorBoundaryTime);
      const timezoneOffsetMinutes = new Date().getTimezoneOffset();

      const newSession: ActiveSleepSession = {
        id: generateId(),
        version: 1,
        status: 'tracking',
        startedAt: now,
        sleepDate: anchorDate,
        timezoneOffsetMinutes,
        createdAt: now,
        notes: notes?.trim() ? notes.trim().slice(0, 280) : undefined,
      };

      const result = startActiveSleepSession(newSession);
      if (result.success) {
        setActiveSession(result.activeSession);
        setElapsedSeconds(0);
        return { success: true };
      }

      return { success: false, error: result.error || 'Failed to start session' };
    },
    [preferences]
  );

  const wakeUp = useCallback(
    (
      rating?: SleepRating,
      notes?: string
    ): { success: boolean; record?: SleepRecord; error?: string } => {
      const current = activeSession ?? loadActiveSleepSession();
      if (!current) {
        return { success: false, error: 'No active sleep session found' };
      }

      const endedAt = Date.now();
      const calc = calculateSleepDuration(current.startedAt, endedAt, endedAt);

      const finalNotes = notes?.trim()
        ? notes.trim().slice(0, 280)
        : current.notes;

      const record: SleepRecord = {
        id: generateId(),
        version: 1,
        sleepDate: current.sleepDate,
        startedAt: current.startedAt,
        endedAt,
        durationMinutes: calc.durationMinutes,
        durationMs: calc.durationMs,
        timezoneOffsetMinutes: current.timezoneOffsetMinutes,
        source: 'manual_realtime',
        rating,
        notes: finalNotes,
        anomalyFlags: calc.anomalies.length > 0 ? calc.anomalies : undefined,
        isFlaggedForReview: calc.isFlaggedForReview,
        createdAt: endedAt,
        updatedAt: endedAt,
      };

      const saved = saveSleepRecord(record);
      if (!saved) {
        return { success: false, error: 'Failed to save completed sleep record' };
      }

      clearActiveSleepSession();
      setActiveSession(null);
      setElapsedSeconds(0);
      setRecords(loadSleepRecords());

      return { success: true, record };
    },
    [activeSession]
  );

  const cancelSession = useCallback(() => {
    clearActiveSleepSession();
    setActiveSession(null);
    setElapsedSeconds(0);
  }, []);

  const saveReflection = useCallback(
    (recordId: string, rating: SleepRating, notes?: string): boolean => {
      const success = updateMorningReflection(recordId, rating, notes);
      if (success) {
        setRecords(loadSleepRecords());
      }
      return success;
    },
    []
  );

  // Phase S5: Preparation Checklist Item State Mutation
  const setItemStatus = useCallback(
    (activityId: string, status: PrepItemStatus) => {
      setPrepProgress((prev) => {
        const updated = { ...prev, [activityId]: status };
        saveSleepPrepDailyProgress(currentAnchorDate, updated);
        return updated;
      });
    },
    [currentAnchorDate]
  );

  // Phase S5: Preparation Routine Customization Persistence
  const updatePrepPreferences = useCallback((newPrefs: SleepPreparationPreferences): boolean => {
    const success = saveSleepPrepPreferences(newPrefs);
    if (success) {
      setPrepPreferences(newPrefs);
    }
    return success;
  }, []);

  const resetPrepToDefaults = useCallback(() => {
    const reset = resetSleepPrepPreferences();
    setPrepPreferences(reset);
  }, []);

  const resetTonightProgress = useCallback(() => {
    clearSleepPrepDailyProgress();
    setPrepProgress({});
  }, []);

  // Phase S7: Sleep Schedule Management Actions
  const saveSchedule = useCallback((schedule: SleepSchedule): boolean => {
    const success = saveSleepSchedule(schedule);
    if (success) {
      setSchedules(loadSleepSchedules());
    }
    return success;
  }, []);

  const deleteSchedule = useCallback((scheduleId: string): boolean => {
    const success = deleteSleepSchedule(scheduleId);
    if (success) {
      setSchedules(loadSleepSchedules());
    }
    return success;
  }, []);

  const toggleScheduleEnabled = useCallback((scheduleId: string, enabled: boolean): boolean => {
    const current = loadSleepSchedules();
    const target = current.find((s) => s.id === scheduleId);
    if (!target) return false;
    const updated: SleepSchedule = { ...target, enabled, updatedAt: Date.now() };
    const success = saveSleepSchedule(updated);
    if (success) {
      setSchedules(loadSleepSchedules());
    }
    return success;
  }, []);

  const updatePreferences = useCallback((updates: Partial<SleepPreferences>): boolean => {
    const success = saveSleepPreferences(updates);
    if (success) {
      setPreferences(loadSleepPreferences());
    }
    return success;
  }, []);

  const value = useMemo<SleepContextType>(
    () => ({
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
      setItemStatus,
      updatePrepPreferences,
      resetPrepToDefaults,
      resetTonightProgress,
      refreshData,
      saveSchedule,
      deleteSchedule,
      toggleScheduleEnabled,
      updatePreferences,
    }),
    [
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
      setItemStatus,
      updatePrepPreferences,
      resetPrepToDefaults,
      resetTonightProgress,
      refreshData,
      saveSchedule,
      deleteSchedule,
      toggleScheduleEnabled,
      updatePreferences,
    ]
  );

  return <SleepContext.Provider value={value}>{children}</SleepContext.Provider>;
};

export const useSleep = (): SleepContextType => {
  const context = useContext(SleepContext);
  if (!context) {
    throw new Error('useSleep must be used within a SleepProvider');
  }
  return context;
};
