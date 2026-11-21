/**
 * NeuroCalm & Fokus — Phase 4C Sleep Timer UI, Localization & Accessibility Test Suite
 * Tests UI state transitions, localization parity, RTL support, time formatting,
 * screen reader live announcements, and touch target constraints.
 */

import assert from 'node:assert';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { TranslationKey } from '../src/types/locale';
import { formatTimeDisplay } from '../src/utils/focusTimer';
import { SleepTimerState, SleepTimerStatus } from '../src/types/sleepTimer';

const SLEEP_TIMER_KEYS: TranslationKey[] = [
  'sleepTimerTitle',
  'sleepTimerSubtitle',
  'sleepTimerConfigure',
  'sleepTimerDurationLabel',
  'sleepTimerFadeLabel',
  'sleepTimerExplanation',
  'sleepTimerExample',
  'sleepTimerStart',
  'sleepTimerCancel',
  'sleepTimerExtend15',
  'sleepTimerRunningStatus',
  'sleepTimerFadingStatus',
  'sleepTimerUntilFade',
  'sleepTimerUntilSilence',
  'sleepTimerFadeDurationNotice',
  'sleepTimerCustom',
  'sleepTimerMinutesUnit',
  'sleepTimerSecondsUnit',
  'sleepTimerClose',
  'sleepTimerNoAudioWarning',
  'sleepTimerAnnounceStarted',
  'sleepTimerAnnounceFading',
  'sleepTimerAnnounceCancelled',
  'sleepTimerAnnounceExtended',
  'sleepTimerAnnounceCompleted',
];

console.log('=== Starting Phase 4C Sleep Timer UI Test Suite ===\n');

// 1. Localization Parity and Completeness
console.log('1. Testing Localization Parity & Completeness...');
for (const key of SLEEP_TIMER_KEYS) {
  assert.ok(en[key], `English string for "${key}" must exist and not be empty`);
  assert.ok(ar[key], `Arabic string for "${key}" must exist and not be empty`);

  // Verify Arabic strings are not identical to English (genuine translation check)
  if (key !== 'sleepTimerCustom' && key !== 'sleepTimerMinutesUnit') {
    assert.notStrictEqual(
      en[key],
      ar[key],
      `Key "${key}" must be translated into Arabic, not copied from English`
    );
  }

  // Check placeholder matching
  const enPlaceholders = (en[key].match(/\{([a-zA-Z0-9_]+)\}/g) || []).sort();
  const arPlaceholders = (ar[key].match(/\{([a-zA-Z0-9_]+)\}/g) || []).sort();
  assert.deepStrictEqual(
    enPlaceholders,
    arPlaceholders,
    `Placeholders for "${key}" must match between EN and AR. EN: ${enPlaceholders}, AR: ${arPlaceholders}`
  );
}
console.log(`✓ All ${SLEEP_TIMER_KEYS.length} Sleep Timer translation keys are verified in both EN and AR.`);

// 2. FormatTimeDisplay helper verification
console.log('\n2. Testing Time Formatting Display Helper...');
assert.strictEqual(formatTimeDisplay(0), '00:00');
assert.strictEqual(formatTimeDisplay(5), '00:05');
assert.strictEqual(formatTimeDisplay(59), '00:59');
assert.strictEqual(formatTimeDisplay(60), '01:00');
assert.strictEqual(formatTimeDisplay(180), '03:00');
assert.strictEqual(formatTimeDisplay(1799), '29:59');
assert.strictEqual(formatTimeDisplay(1800), '30:00');
assert.strictEqual(formatTimeDisplay(3600), '1:00:00');
assert.strictEqual(formatTimeDisplay(3665), '1:01:05');
console.log('✓ formatTimeDisplay formats seconds into calm MM:SS and H:MM:SS digital displays.');

// 3. Simulated UI Presentation Logic across States
console.log('\n3. Testing UI State Machine Presentation Logic...');

function getMixerUIRepresentation(state: SleepTimerState) {
  const isIdle = state.status === 'idle';
  const isRunning = state.status === 'running';
  const isFading = state.status === 'fading';

  return {
    showIdleTriggerButton: isIdle,
    showActiveCard: isRunning || isFading,
    statusBadgeTextKey: isFading ? 'sleepTimerFadingStatus' : 'sleepTimerRunningStatus',
    countdownPrimaryFormatted: isFading
      ? formatTimeDisplay(state.remainingSeconds)
      : formatTimeDisplay(state.remainingSecondsBeforeFade),
    countdownSilenceFormatted: formatTimeDisplay(state.remainingSeconds),
    accentColor: isFading ? 'amber' : 'teal',
    canExtend: isRunning || isFading,
    canCancel: isRunning || isFading,
  };
}

function getGlobalAudioBarUIRepresentation(state: SleepTimerState) {
  const isActive = state.status !== 'idle';
  return {
    showSleepIndicator: isActive,
    badgeCountdown: state.isFading
      ? formatTimeDisplay(state.remainingSeconds)
      : formatTimeDisplay(state.remainingSecondsBeforeFade),
    isFadingPulsing: state.isFading,
  };
}

// Test Idle State
const idleState: SleepTimerState = {
  status: 'idle',
  durationMinutes: 30,
  fadeDurationSeconds: 300,
  fadeStartWallTime: null,
  deadlineWallTime: null,
  remainingSeconds: 0,
  remainingSecondsBeforeFade: 0,
  isFading: false,
};

const idleMixerUI = getMixerUIRepresentation(idleState);
assert.strictEqual(idleMixerUI.showIdleTriggerButton, true, 'Mixer must show idle trigger button when idle');
assert.strictEqual(idleMixerUI.showActiveCard, false, 'Mixer must not show active card when idle');

const idleBarUI = getGlobalAudioBarUIRepresentation(idleState);
assert.strictEqual(idleBarUI.showSleepIndicator, false, 'GlobalAudioBar must not show sleep indicator when idle');
console.log('✓ Idle state presentation verified.');

// Test Running State (e.g. 20 minutes remaining before fade)
const runningState: SleepTimerState = {
  status: 'running',
  durationMinutes: 30,
  fadeDurationSeconds: 300,
  fadeStartWallTime: Date.now() + 1200_000,
  deadlineWallTime: Date.now() + 1500_000,
  remainingSeconds: 1500, // 25 mins total
  remainingSecondsBeforeFade: 1200, // 20 mins before fade
  isFading: false,
};

const runningMixerUI = getMixerUIRepresentation(runningState);
assert.strictEqual(runningMixerUI.showIdleTriggerButton, false, 'Idle trigger button must be hidden when running');
assert.strictEqual(runningMixerUI.showActiveCard, true, 'Active card must be displayed when running');
assert.strictEqual(runningMixerUI.statusBadgeTextKey, 'sleepTimerRunningStatus');
assert.strictEqual(runningMixerUI.countdownPrimaryFormatted, '20:00');
assert.strictEqual(runningMixerUI.countdownSilenceFormatted, '25:00');
assert.strictEqual(runningMixerUI.accentColor, 'teal');
assert.strictEqual(runningMixerUI.canExtend, true);
assert.strictEqual(runningMixerUI.canCancel, true);

const runningBarUI = getGlobalAudioBarUIRepresentation(runningState);
assert.strictEqual(runningBarUI.showSleepIndicator, true);
assert.strictEqual(runningBarUI.badgeCountdown, '20:00');
assert.strictEqual(runningBarUI.isFadingPulsing, false);
console.log('✓ Running (listening) state presentation verified.');

// Test Fading State (e.g. 2 minutes remaining before complete silence)
const fadingState: SleepTimerState = {
  status: 'fading',
  durationMinutes: 30,
  fadeDurationSeconds: 300,
  fadeStartWallTime: Date.now() - 180_000,
  deadlineWallTime: Date.now() + 120_000,
  remainingSeconds: 120, // 2 mins total left
  remainingSecondsBeforeFade: 0,
  isFading: true,
};

const fadingMixerUI = getMixerUIRepresentation(fadingState);
assert.strictEqual(fadingMixerUI.showActiveCard, true);
assert.strictEqual(fadingMixerUI.statusBadgeTextKey, 'sleepTimerFadingStatus');
assert.strictEqual(fadingMixerUI.countdownPrimaryFormatted, '02:00');
assert.strictEqual(fadingMixerUI.countdownSilenceFormatted, '02:00');
assert.strictEqual(fadingMixerUI.accentColor, 'amber');
assert.strictEqual(fadingMixerUI.canExtend, true);
assert.strictEqual(fadingMixerUI.canCancel, true);

const fadingBarUI = getGlobalAudioBarUIRepresentation(fadingState);
assert.strictEqual(fadingBarUI.showSleepIndicator, true);
assert.strictEqual(fadingBarUI.badgeCountdown, '02:00');
assert.strictEqual(fadingBarUI.isFadingPulsing, true);
console.log('✓ Fading state presentation verified.');

// 4. Screen Reader Polite Live Region Transitions
console.log('\n4. Testing Screen Reader Live Region Transitions...');

class ScreenReaderAnnouncer {
  private prevStatus: SleepTimerStatus = 'idle';
  private currentAnnouncement = '';

  onStateChange(status: SleepTimerStatus, duration: number, fadeSeconds: number, action?: string) {
    if (action === 'extended') {
      this.currentAnnouncement = en.sleepTimerAnnounceExtended;
      return;
    }

    if (this.prevStatus === 'idle' && status === 'running') {
      this.currentAnnouncement = en.sleepTimerAnnounceStarted
        .replace('{timer}', String(duration))
        .replace('{fade}', String(Math.round(fadeSeconds / 60)));
    } else if (this.prevStatus === 'running' && status === 'fading') {
      this.currentAnnouncement = en.sleepTimerAnnounceFading;
    } else if ((this.prevStatus === 'running' || this.prevStatus === 'fading') && status === 'idle') {
      this.currentAnnouncement = en.sleepTimerAnnounceCancelled;
    } else if (status === 'completed' && this.prevStatus !== 'completed') {
      this.currentAnnouncement = en.sleepTimerAnnounceCompleted;
    }

    this.prevStatus = status;
  }

  getAnnouncement() {
    return this.currentAnnouncement;
  }
}

const announcer = new ScreenReaderAnnouncer();

// Transition: idle -> running (30m duration, 5m fade)
announcer.onStateChange('running', 30, 300);
assert.strictEqual(
  announcer.getAnnouncement(),
  'Sleep timer started. 30 minutes until fade, 5 minutes fade-out.'
);

// Countdown ticks while running (status remains 'running') - announcement MUST NOT change
const announcementDuringTick = announcer.getAnnouncement();
announcer.onStateChange('running', 30, 300);
assert.strictEqual(announcer.getAnnouncement(), announcementDuringTick, 'Announcement must not update on countdown ticks');

// Extend action
announcer.onStateChange('running', 45, 300, 'extended');
assert.strictEqual(announcer.getAnnouncement(), 'Sleep timer extended by 15 minutes.');

// Transition: running -> fading
announcer.onStateChange('fading', 45, 300);
assert.strictEqual(announcer.getAnnouncement(), 'Audio fade-out has started.');

// Transition: fading -> cancelled
announcer.onStateChange('idle', 30, 300);
assert.strictEqual(announcer.getAnnouncement(), 'Sleep timer cancelled. Normal audio restored.');

// Transition: idle -> running -> fading -> completed
announcer.onStateChange('running', 15, 60);
announcer.onStateChange('fading', 15, 60);
announcer.onStateChange('completed', 15, 60);
assert.strictEqual(announcer.getAnnouncement(), 'Sleep timer completed. Audio stopped.');
console.log('✓ Screen reader announcement state transitions verified (no per-second spam).');

// 5. Verification of Touch Target & Accessibility Attributes in Source
console.log('\n5. Testing Touch Target and Accessibility Source Conformance...');
import * as fs from 'node:fs';

const modalSource = fs.readFileSync('src/components/audio/SleepTimerModal.tsx', 'utf-8');
const mixerSource = fs.readFileSync('src/components/audio/SoundscapeMixer.tsx', 'utf-8');
const barSource = fs.readFileSync('src/components/audio/GlobalAudioBar.tsx', 'utf-8');

// Verify WCAG 2.5.5 min-h-[44px]
assert.ok(modalSource.includes('min-h-[44px]'), 'SleepTimerModal must use min-h-[44px] for interactive buttons');
assert.ok(mixerSource.includes('min-h-[44px]'), 'SoundscapeMixer must use min-h-[44px] for sleep timer buttons');
assert.ok(barSource.includes('min-h-[44px]'), 'GlobalAudioBar must use min-h-[44px] for sleep controls');

// Verify accessible attributes
assert.ok(modalSource.includes('role="dialog"'), 'SleepTimerModal must have role="dialog"');
assert.ok(modalSource.includes('aria-modal="true"'), 'SleepTimerModal must have aria-modal="true"');
assert.ok(modalSource.includes('aria-labelledby'), 'SleepTimerModal must have aria-labelledby');
assert.ok(modalSource.includes('aria-describedby'), 'SleepTimerModal must have aria-describedby');

assert.ok(mixerSource.includes('aria-live="polite"'), 'SoundscapeMixer must have polite aria-live region');
assert.ok(mixerSource.includes('aria-atomic="true"'), 'SoundscapeMixer must have aria-atomic="true"');

assert.ok(barSource.includes('aria-live="polite"'), 'GlobalAudioBar must have polite aria-live region');
assert.ok(barSource.includes('aria-haspopup="dialog"'), 'GlobalAudioBar toggle must have aria-haspopup="dialog"');
assert.ok(barSource.includes('aria-expanded'), 'GlobalAudioBar toggle must have aria-expanded');

console.log('✓ Touch targets and accessible ARIA attributes verified in source code.');

console.log('\n=== All Phase 4C Sleep Timer UI Tests Passed Successfully! ===');
process.exit(0);
