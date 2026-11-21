/**
 * NeuroCalm & Fokus — Phase S5 Sleep Preparation & Wind-Down Routine Test Suite
 * Automated tests for:
 * 1. Default prep activities contracts and ordering.
 * 2. Translation key completeness, parity, and parameter interpolation in EN and AR.
 * 3. Daily checklist progress persistence, mutual state distinction, and anchor-date rollover.
 * 4. Routine customization, enabling/disabling, reordering, custom activities, and defaults reset.
 * 5. Breathing, Relaxation, and Sleep Timer integration contracts.
 * 6. Non-judgmental progress calculations and defensive corruption recovery.
 */

import assert from 'node:assert';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { TranslationKey } from '../src/types/locale';
import {
  SleepPrepActivity,
  SleepPreparationPreferences,
} from '../src/types/sleep';
import {
  DEFAULT_PREP_ACTIVITIES,
  DEFAULT_SLEEP_PREP_PREFERENCES,
  loadSleepPrepPreferences,
  saveSleepPrepPreferences,
  resetSleepPrepPreferences,
  isValidSleepPrepPreferences,
} from '../src/storage/sleepPrepStorage';
import {
  loadSleepPrepDailyProgress,
  saveSleepPrepDailyProgress,
  clearSleepPrepDailyProgress,
  isValidPrepDailyProgress,
  PrepItemStatus,
} from '../src/storage/sleepPrepProgressStorage';
import {
  SLEEP_PREP_STORAGE_KEY,
  SLEEP_PREP_PROGRESS_STORAGE_KEY,
} from '../src/storage/sleepStorageKeys';
import { BREATHING_TECHNIQUES, getBreathingTechnique } from '../src/data/breathingTechniques';
import { RELAXATION_SESSIONS } from '../src/data/relaxationSessions';

// --- IN-MEMORY MOCK LOCALSTORAGE FOR NODE.JS TEST HARNESS ---

class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockStorage = new MockStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage as unknown as Storage;

function resetStorage(): void {
  mockStorage.clear();
}

console.log('--- STARTING PHASE S5 SLEEP PREPARATION TEST SUITE ---\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void): void {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

// =========================================================================
// TEST GROUP 1: Default Prep Activities & Ordering
// =========================================================================
console.log('Test Group 1: Default Prep Activities & Ordering');

runTest('DEFAULT_PREP_ACTIVITIES contains 4 sensible default activities', () => {
  assert.strictEqual(DEFAULT_PREP_ACTIVITIES.length, 4);

  const ids = DEFAULT_PREP_ACTIVITIES.map((a) => a.id);
  assert.deepStrictEqual(ids, [
    'prep_dim_lights',
    'prep_breathing',
    'prep_relaxation',
    'prep_sounds',
  ]);
});

runTest('Default activities have sequential ordering and are enabled by default', () => {
  DEFAULT_PREP_ACTIVITIES.forEach((act, idx) => {
    assert.strictEqual(act.order, idx);
    assert.strictEqual(act.isEnabled, true);
    assert.ok(act.durationMinutes && act.durationMinutes > 0);
  });
});

runTest('Default activity types match appropriate categories', () => {
  const dim = DEFAULT_PREP_ACTIVITIES.find((a) => a.id === 'prep_dim_lights');
  const breath = DEFAULT_PREP_ACTIVITIES.find((a) => a.id === 'prep_breathing');
  const relax = DEFAULT_PREP_ACTIVITIES.find((a) => a.id === 'prep_relaxation');
  const sounds = DEFAULT_PREP_ACTIVITIES.find((a) => a.id === 'prep_sounds');

  assert.strictEqual(dim?.activityType, 'wind_down_checklist');
  assert.strictEqual(breath?.activityType, 'breathing');
  assert.strictEqual(breath?.targetId, '4_7_8_relax');
  assert.strictEqual(relax?.activityType, 'relaxation');
  assert.strictEqual(relax?.targetId, 'session_evening_retreat');
  assert.strictEqual(sounds?.activityType, 'soundscape');
});

// =========================================================================
// TEST GROUP 2: Translation Key Completeness & Parity
// =========================================================================
console.log('\nTest Group 2: Translation Key Completeness & Parity');

runTest('All default prep activity titleKeys and descriptionKeys exist in EN and AR', () => {
  DEFAULT_PREP_ACTIVITIES.forEach((act) => {
    assert.ok(act.titleKey in en, `Missing English titleKey for ${act.titleKey}`);
    assert.ok(act.titleKey in ar, `Missing Arabic titleKey for ${act.titleKey}`);
    assert.ok(act.descriptionKey in en, `Missing English descriptionKey for ${act.descriptionKey}`);
    assert.ok(act.descriptionKey in ar, `Missing Arabic descriptionKey for ${act.descriptionKey}`);

    const enTitle = en[act.titleKey as TranslationKey];
    const arTitle = ar[act.titleKey as TranslationKey];
    assert.ok(typeof enTitle === 'string' && enTitle.trim().length > 0);
    assert.ok(typeof arTitle === 'string' && arTitle.trim().length > 0);
  });
});

runTest('All Phase S5 translation keys exist in both English and Arabic', () => {
  const s5Keys: TranslationKey[] = [
    'prepDimLightsTitle',
    'prepDimLightsDesc',
    'prepBreathingTitle',
    'prepBreathingDesc',
    'prepRelaxationTitle',
    'prepRelaxationDesc',
    'prepSoundsTitle',
    'prepSoundsDesc',
    'sleepPrepNavTitle',
    'sleepPrepNavSubtitle',
    'sleepPrepBackToDashboard',
    'sleepPrepRoutineHeading',
    'sleepPrepRoutineDesc',
    'sleepPrepProgressSummary',
    'sleepPrepSkippedSummary',
    'sleepPrepMarkComplete',
    'sleepPrepMarkPending',
    'sleepPrepSkip',
    'sleepPrepUnskip',
    'sleepPrepStatusCompleted',
    'sleepPrepStatusSkipped',
    'sleepPrepStatusPending',
    'sleepPrepActionBreathing',
    'sleepPrepActionRelaxation',
    'sleepPrepActionSleepTimer',
    'sleepPrepCustomAddPlaceholder',
    'sleepPrepCustomAddButton',
    'sleepPrepCustomDelete',
    'sleepPrepCustomizeToggle',
    'sleepPrepCloseCustomize',
    'sleepPrepMoveUp',
    'sleepPrepMoveDown',
    'sleepPrepToggleEnable',
    'sleepPrepToggleDisable',
    'sleepPrepDurationMinutes',
    'sleepPrepResetDefaults',
    'sleepPrepResetChecklist',
    'sleepPrepAllDoneMessage',
    'sleepPrepPhilosophy',
    'sleepPrepTimerNotice',
    'sleepPrepOpenRoutine',
    'sleepPrepActiveBadge',
    'sleepPrepReadyForSleep',
    'sleepPrepEmptyRoutine',
    'sleepPrepCustomTitle',
  ];

  for (const k of s5Keys) {
    assert.ok(k in en, `Missing English key ${k}`);
    assert.ok(k in ar, `Missing Arabic key ${k}`);
    assert.ok(en[k].trim().length > 0, `Empty English translation for ${k}`);
    assert.ok(ar[k].trim().length > 0, `Empty Arabic translation for ${k}`);
  }
});

runTest('Parameter substitution in sleepPrepProgressSummary and duration formats properly', () => {
  const enSummary = en.sleepPrepProgressSummary
    .replace('{completed}', '2')
    .replace('{total}', '4');
  const arSummary = ar.sleepPrepProgressSummary
    .replace('{completed}', '2')
    .replace('{total}', '4');

  assert.strictEqual(enSummary, '2 of 4 steps completed');
  assert.strictEqual(arSummary, 'تم إنجاز 2 من 4 خطوات');

  const enDuration = en.sleepPrepDurationMinutes.replace('{minutes}', '15');
  const arDuration = ar.sleepPrepDurationMinutes.replace('{minutes}', '15');

  assert.strictEqual(enDuration, '15 min');
  assert.strictEqual(arDuration, '15 دقيقة');
});

// =========================================================================
// TEST GROUP 3: Daily Checklist Progress Persistence & Anchor Date Lifecycle
// =========================================================================
console.log('\nTest Group 3: Daily Checklist Progress Persistence & Anchor Date Lifecycle');

runTest('Initial state: loadSleepPrepDailyProgress returns empty map for new anchor date', () => {
  resetStorage();
  const progress = loadSleepPrepDailyProgress('2026-11-21');
  assert.deepStrictEqual(progress, {});
});

runTest('Marking items completed and skipped persists correctly', () => {
  resetStorage();
  const date = '2026-11-21';
  const statuses: Record<string, PrepItemStatus> = {
    prep_dim_lights: 'completed',
    prep_breathing: 'completed',
    prep_relaxation: 'skipped',
    prep_sounds: 'pending',
  };

  const saved = saveSleepPrepDailyProgress(date, statuses);
  assert.strictEqual(saved, true);

  const loaded = loadSleepPrepDailyProgress(date);
  assert.strictEqual(loaded.prep_dim_lights, 'completed');
  assert.strictEqual(loaded.prep_breathing, 'completed');
  assert.strictEqual(loaded.prep_relaxation, 'skipped');
  assert.strictEqual(loaded.prep_sounds, 'pending');
});

runTest('Anchor date rollover: Daily progress auto-resets when a new night arrives', () => {
  // Saved on 2026-11-21
  const loadedNextDay = loadSleepPrepDailyProgress('2026-11-22');
  assert.deepStrictEqual(loadedNextDay, {}); // Returns clean empty slate!

  // Original anchor date still has its data if checked
  const loadedSameDay = loadSleepPrepDailyProgress('2026-11-21');
  assert.strictEqual(loadedSameDay.prep_dim_lights, 'completed');
});

runTest('clearSleepPrepDailyProgress clears the stored progress cleanly', () => {
  clearSleepPrepDailyProgress();
  const loaded = loadSleepPrepDailyProgress('2026-11-21');
  assert.deepStrictEqual(loaded, {});
});

// =========================================================================
// TEST GROUP 4: Routine Customization & Preferences Persistence
// =========================================================================
console.log('\nTest Group 4: Routine Customization & Preferences Persistence');

runTest('loadSleepPrepPreferences returns default preferences when storage is empty', () => {
  resetStorage();
  const prefs = loadSleepPrepPreferences();
  assert.strictEqual(prefs.enabled, true);
  assert.strictEqual(prefs.activities.length, 4);
});

runTest('Disabling an activity persists across reloads', () => {
  resetStorage();
  const prefs = loadSleepPrepPreferences();
  const modified: SleepPreparationPreferences = {
    ...prefs,
    activities: prefs.activities.map((a) =>
      a.id === 'prep_dim_lights' ? { ...a, isEnabled: false } : a
    ),
  };

  const saved = saveSleepPrepPreferences(modified);
  assert.strictEqual(saved, true);

  const reloaded = loadSleepPrepPreferences();
  const dim = reloaded.activities.find((a) => a.id === 'prep_dim_lights');
  assert.strictEqual(dim?.isEnabled, false);
});

runTest('Reordering activities persists custom order', () => {
  resetStorage();
  const prefs = loadSleepPrepPreferences();
  // Reverse order
  const reordered: SleepPreparationPreferences = {
    ...prefs,
    activities: [
      { ...prefs.activities[3], order: 0 },
      { ...prefs.activities[2], order: 1 },
      { ...prefs.activities[1], order: 2 },
      { ...prefs.activities[0], order: 3 },
    ],
  };

  saveSleepPrepPreferences(reordered);
  const reloaded = loadSleepPrepPreferences();
  assert.strictEqual(reloaded.activities[0].id, 'prep_sounds');
  assert.strictEqual(reloaded.activities[0].order, 0);
  assert.strictEqual(reloaded.activities[3].id, 'prep_dim_lights');
  assert.strictEqual(reloaded.activities[3].order, 3);
});

runTest('Adding, toggling, and deleting custom activities persists correctly', () => {
  resetStorage();
  const prefs = loadSleepPrepPreferences();

  // Add custom activity
  const custom1 = { id: 'custom_tea', title: 'Chamomile tea', isEnabled: true };
  const custom2 = { id: 'custom_read', title: 'Read 10 pages', isEnabled: true };

  const withCustom: SleepPreparationPreferences = {
    ...prefs,
    customActivities: [custom1, custom2],
  };

  assert.strictEqual(isValidSleepPrepPreferences(withCustom), true);
  saveSleepPrepPreferences(withCustom);

  let reloaded = loadSleepPrepPreferences();
  assert.strictEqual(reloaded.customActivities?.length, 2);
  assert.strictEqual(reloaded.customActivities?.[0].title, 'Chamomile tea');

  // Toggle custom activity
  const toggled: SleepPreparationPreferences = {
    ...reloaded,
    customActivities: [
      { ...custom1, isEnabled: false },
      custom2,
    ],
  };
  saveSleepPrepPreferences(toggled);
  reloaded = loadSleepPrepPreferences();
  assert.strictEqual(reloaded.customActivities?.[0].isEnabled, false);

  // Delete custom activity
  const deleted: SleepPreparationPreferences = {
    ...reloaded,
    customActivities: [custom2],
  };
  saveSleepPrepPreferences(deleted);
  reloaded = loadSleepPrepPreferences();
  assert.strictEqual(reloaded.customActivities?.length, 1);
  assert.strictEqual(reloaded.customActivities?.[0].id, 'custom_read');
});

runTest('resetSleepPrepPreferences restores clean default activities and clears custom items', () => {
  const reset = resetSleepPrepPreferences();
  assert.strictEqual(reset.activities.length, 4);
  assert.strictEqual(reset.customActivities, undefined);

  const loaded = loadSleepPrepPreferences();
  assert.strictEqual(loaded.activities.length, 4);
  assert.strictEqual(loaded.activities[0].id, 'prep_dim_lights');
  assert.strictEqual(loaded.activities[0].isEnabled, true);
});

// =========================================================================
// TEST GROUP 5: Breathing, Relaxation & Sleep Timer Integration Contracts
// =========================================================================
console.log('\nTest Group 5: Breathing, Relaxation & Sleep Timer Integration Contracts');

runTest('Breathing technique 4_7_8_relax is registered with sleep_prep goal', () => {
  const tech = getBreathingTechnique('4_7_8_relax');
  assert.ok(tech);
  assert.strictEqual(tech.id, '4_7_8_relax');
  assert.ok(tech.goals.includes('sleep_prep'));
  assert.ok(tech.goals.includes('evening_unwind'));
  assert.strictEqual(tech.canDisableRetention, true);
});

runTest('Relaxation session evening_retreat is registered in catalog with nature accompaniment', () => {
  const session = RELAXATION_SESSIONS.find((s) => s.id === 'session_evening_retreat');
  assert.ok(session);
  assert.strictEqual(session.id, 'session_evening_retreat');
  assert.strictEqual(session.familyId, 'music_only');
  assert.strictEqual(session.defaultDuration, 15);
  assert.ok(session.audioTracks.length >= 2);
});

// =========================================================================
// TEST GROUP 6: Non-Judgmental Checklist Philosophy & Anomaly Resilience
// =========================================================================
console.log('\nTest Group 6: Non-Judgmental Checklist Philosophy & Anomaly Resilience');

runTest('Skipping all activities is a valid state with zero error flags', () => {
  const allSkipped: Record<string, PrepItemStatus> = {
    prep_dim_lights: 'skipped',
    prep_breathing: 'skipped',
    prep_relaxation: 'skipped',
    prep_sounds: 'skipped',
  };

  const saved = saveSleepPrepDailyProgress('2026-11-21', allSkipped);
  assert.strictEqual(saved, true);
  const loaded = loadSleepPrepDailyProgress('2026-11-21');
  assert.strictEqual(loaded.prep_dim_lights, 'skipped');
});

runTest('Corrupted daily progress JSON is safely quarantined without crashing', () => {
  mockStorage.setItem(SLEEP_PREP_PROGRESS_STORAGE_KEY, 'INVALID_JSON_CORRUPT');
  const loaded = loadSleepPrepDailyProgress('2026-11-21');
  assert.deepStrictEqual(loaded, {});
});

runTest('Corrupted prep preferences JSON is safely quarantined and falls back to defaults', () => {
  mockStorage.setItem(SLEEP_PREP_STORAGE_KEY, '{ invalid: corrupt payload }');
  const loaded = loadSleepPrepPreferences();
  assert.strictEqual(loaded.enabled, true);
  assert.strictEqual(loaded.activities.length, 4);
});

console.log(`\n--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! ---`);
