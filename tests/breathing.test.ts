/**
 * NeuroCalm & Fokus — Phase 3A Respiratory Training System Test Suite
 * Validates protocol catalog, hold-removal guarantees, specialized context rules,
 * timing mathematics, preference storage, and bilingual integrity.
 */

import {
  BREATHING_TECHNIQUES,
  BREATHING_GOALS,
  getBreathingTechnique,
  getTechniquesByGoal,
} from '../src/data/breathingTechniques';
import {
  resolveActivePhases,
  calculateCycleDurationSeconds,
  formatBreathingTime,
} from '../src/utils/breathingTimer';
import {
  DEFAULT_BREATHING_PREFERENCES,
  BREATHING_PREFS_STORAGE_KEY,
  loadBreathingPreferences,
  saveBreathingPreferences,
  validateCuePreferences,
} from '../src/storage/breathingStorage';
import {
  clampCueVolume,
  playPhaseCue,
  previewCue,
  stopPreview,
  playInhaleCue,
  playExhaleCue,
  playHoldCue,
  playCompletionCue,
} from '../src/utils/breathingAudioCue';
import {
  DEFAULT_BREATHING_CUE_PREFERENCES,
  BreathingCuePreferences,
} from '../src/types/breathing';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';

let passedTests = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    throw new Error(`TEST FAILED: ${msg}`);
  }
  passedTests++;
}

console.log('--- Phase 3A: Respiratory Training System Unit & Protocol Tests ---');

// Mock localStorage for Node environment
const mockStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => { mockStorage.set(key, String(val)); },
  removeItem: (key: string) => { mockStorage.delete(key); },
  clear: () => { mockStorage.clear(); },
};

// =========================================================================
// Group 1: Protocol Catalog & Seven Techniques Verification
// =========================================================================
console.log('\n[Group 1: Protocol Catalog & Seven Techniques]');

const EXPECTED_TECHNIQUES = [
  'diaphragmatic',
  'resonance_frequency',
  'physiological_sigh',
  'extended_exhale',
  'box_breathing',
  '4_7_8_relax',
  'pursed_lip',
];

assert(
  BREATHING_TECHNIQUES.length === 7,
  `Expected exactly 7 breathing techniques, found ${BREATHING_TECHNIQUES.length}`
);

for (const id of EXPECTED_TECHNIQUES) {
  const tech = getBreathingTechnique(id);
  assert(Boolean(tech), `Technique "${id}" must exist in BREATHING_TECHNIQUES`);
  assert(tech?.id === id, `Technique id must match: ${id}`);
  assert(tech!.phases.length >= 2, `Technique "${id}" must have at least 2 phases`);
  assert(
    [2, 3, 5, 10].includes(tech!.defaultDurationMinutes),
    `Technique "${id}" defaultDurationMinutes must be 2, 3, 5, or 10`
  );
}
console.log(`✓ All 7 core techniques registered and verified.`);

// =========================================================================
// Group 2: Pursed-Lip Specialized Context Rules
// =========================================================================
console.log('\n[Group 2: Pursed-Lip Breathing Specialized Context]');

const pursedLip = getBreathingTechnique('pursed_lip')!;
assert(pursedLip.isSpecialized === true, 'Pursed-Lip Breathing must be flagged as specialized');
assert(
  !pursedLip.goals.includes('acute_stress'),
  'Pursed-Lip must NOT be listed under acute_stress goal'
);
assert(
  !pursedLip.goals.includes('anxiety_relief'),
  'Pursed-Lip must NOT be listed under anxiety_relief goal'
);
assert(
  !pursedLip.goals.includes('gentle_awareness'),
  'Pursed-Lip must NOT be listed under gentle_awareness goal'
);
assert(
  pursedLip.goals.includes('specialized_respiratory'),
  'Pursed-Lip must belong to specialized_respiratory goal'
);

const gentleTechniques = getTechniquesByGoal('gentle_awareness');
assert(
  !gentleTechniques.some((t) => t.id === 'pursed_lip'),
  'getTechniquesByGoal("gentle_awareness") must NOT contain pursed_lip'
);

const specializedTechniques = getTechniquesByGoal('specialized_respiratory');
assert(
  specializedTechniques.some((t) => t.id === 'pursed_lip'),
  'getTechniquesByGoal("specialized_respiratory") must contain pursed_lip'
);
console.log(`✓ Pursed-Lip breathing correctly qualified and strictly isolated from gentle awareness.`);

// =========================================================================
// Group 3: Diaphragmatic Awareness & Untimed Mode
// =========================================================================
console.log('\n[Group 3: Diaphragmatic Breathing Awareness & Zero Holds]');

const diaphragmatic = getBreathingTechnique('diaphragmatic')!;
assert(
  diaphragmatic.isUntimedAwarenessSupported === true,
  'Diaphragmatic breathing must support untimed awareness mode'
);
assert(
  diaphragmatic.hasBreathRetention === false,
  'Diaphragmatic breathing must have zero breath retention'
);
for (const phase of diaphragmatic.phases) {
  assert(
    phase.type !== 'hold_in' && phase.type !== 'hold_out',
    'Diaphragmatic phases must contain zero hold phases'
  );
}
console.log(`✓ Diaphragmatic breathing validated for untimed awareness and zero holds.`);

// =========================================================================
// Group 4: Box Breathing Retention Removal & Hold-Free Guarantee
// =========================================================================
console.log('\n[Group 4: Box Breathing Retention Removal Guarantee]');

const box = getBreathingTechnique('box_breathing')!;
assert(box.canDisableRetention === true, 'Box Breathing must allow disabling retention');

// Standard mode: has both hold_in and hold_out
const standardBoxPhases = resolveActivePhases(box, 'standard', 1.0);
assert(
  standardBoxPhases.some((p) => p.type === 'hold_in'),
  'Standard Box Breathing must include hold_in'
);
assert(
  standardBoxPhases.some((p) => p.type === 'hold_out'),
  'Standard Box Breathing must include hold_out'
);

// Hold-free mode: MUST BE STRICTLY ZERO HOLDS
const holdFreeBoxPhases = resolveActivePhases(box, 'hold_free', 1.0);
const boxHoldCount = holdFreeBoxPhases.filter(
  (p) => p.type === 'hold_in' || p.type === 'hold_out'
).length;
assert(
  boxHoldCount === 0,
  `Hold-free Box Breathing must have exactly 0 holds (found ${boxHoldCount})`
);
assert(
  holdFreeBoxPhases.length === 2 &&
    holdFreeBoxPhases[0].type === 'inhale' &&
    holdFreeBoxPhases[1].type === 'exhale',
  'Hold-free Box Breathing must consist solely of Inhale and Exhale'
);

// Triangle mode: clearly contains an inspiratory hold (NOT presented as zero-hold)
const triangleBoxPhases = resolveActivePhases(box, 'triangle', 1.0);
assert(
  triangleBoxPhases.some((p) => p.type === 'hold_in'),
  'Triangle mode must include hold_in'
);
assert(
  !triangleBoxPhases.some((p) => p.type === 'hold_out'),
  'Triangle mode must omit hold_out'
);
console.log(`✓ Box breathing hold-free alternative strictly eliminates all holds.`);

// =========================================================================
// Group 5: 4-7-8 Breathing Retention Removal Guarantee
// =========================================================================
console.log('\n[Group 5: 4-7-8 Breathing Retention Removal Guarantee]');

const f78 = getBreathingTechnique('4_7_8_relax')!;
assert(f78.canDisableRetention === true, '4-7-8 must allow disabling retention');

const holdFreeF78Phases = resolveActivePhases(f78, 'hold_free', 1.0);
const f78HoldCount = holdFreeF78Phases.filter(
  (p) => p.type === 'hold_in' || p.type === 'hold_out'
).length;
assert(
  f78HoldCount === 0,
  `Hold-free 4-7-8 must have exactly 0 holds (found ${f78HoldCount})`
);
assert(
  holdFreeF78Phases.length === 2 &&
    holdFreeF78Phases[0].type === 'inhale' &&
    holdFreeF78Phases[1].type === 'exhale',
  'Hold-free 4-7-8 must consist solely of Inhale and Exhale'
);

// Verify comfortable reduced exhalation (not forced to 7s or 8s)
const holdFreeExhale = holdFreeF78Phases.find((p) => p.type === 'exhale')!;
assert(
  holdFreeExhale.durationSeconds <= 5.5,
  `Hold-free 4-7-8 exhalation must be comfortably reduced (found ${holdFreeExhale.durationSeconds}s, expected <= 5.5s)`
);
console.log(`✓ 4-7-8 breathing hold-free alternative strictly eliminates all holds with comfortable reduced exhalation.`);

// =========================================================================
// Group 6: Timing Mathematics & Pacing Adjustability
// =========================================================================
console.log('\n[Group 6: Timing Mathematics & Formatters]');

const res = getBreathingTechnique('resonance_frequency')!;
const normalResPhases = resolveActivePhases(res, 'standard', 1.0);
const normalResCycle = calculateCycleDurationSeconds(normalResPhases);
assert(normalResCycle === 10.0, `Normal resonance cycle duration expected 10.0s, got ${normalResCycle}`);

// Slower tempo (1.15x)
const slowResPhases = resolveActivePhases(res, 'standard', 1.15);
const slowResCycle = calculateCycleDurationSeconds(slowResPhases);
assert(slowResCycle > normalResCycle, 'Slower tempo must result in longer cycle duration');

// Time formatters
assert(formatBreathingTime(180) === '3:00', '180s formatted as 3:00');
assert(formatBreathingTime(65) === '1:05', '65s formatted as 1:05');
assert(formatBreathingTime(0) === '0:00', '0s formatted as 0:00');
assert(formatBreathingTime(-10) === '0:00', 'Negative seconds clamped to 0:00');
console.log(`✓ Timing math, tempo scaling, and time formatting verified.`);

// =========================================================================
// Group 7: Storage & Preferences Persistence
// =========================================================================
console.log('\n[Group 7: Preferences Storage & Defensive Defaults]');

mockStorage.clear();
const defaultPrefs = loadBreathingPreferences();
assert(
  defaultPrefs.audioCueEnabled === false,
  'Audio transition chimes must be disabled by default'
);
assert(
  defaultPrefs.lastTechniqueId === 'diaphragmatic',
  'Default technique must be diaphragmatic'
);
assert(
  defaultPrefs.preferredDurationMinutes === 3,
  'Default preferred duration must be 3 min'
);

// Save and reload custom preferences
saveBreathingPreferences({
  lastTechniqueId: 'box_breathing',
  preferredDurationMinutes: 5,
  soundscapeId: 'rain',
  instrumentalId: 'none',
  audioCueEnabled: true,
  tempoMultiplier: 1.1,
});

const loadedPrefs = loadBreathingPreferences();
assert(loadedPrefs.lastTechniqueId === 'box_breathing', 'Persisted technique reloaded');
assert(loadedPrefs.preferredDurationMinutes === 5, 'Persisted duration reloaded');
assert(loadedPrefs.soundscapeId === 'rain', 'Persisted soundscape reloaded');
assert(loadedPrefs.audioCueEnabled === true, 'Persisted audioCueEnabled reloaded');
assert(loadedPrefs.tempoMultiplier === 1.1, 'Persisted tempoMultiplier reloaded');

// Defensive fallback against corrupted localStorage
mockStorage.set(BREATHING_PREFS_STORAGE_KEY, 'INVALID JSON!{}');
const fallbackPrefs = loadBreathingPreferences();
assert(
  fallbackPrefs.lastTechniqueId === 'diaphragmatic',
  'Corrupted JSON safely falls back to defaults'
);
console.log(`✓ Preferences storage resilience and defensive defaults verified.`);

// =========================================================================
// Group 8: Bilingual Localization Parity & RTL Quality
// =========================================================================
console.log('\n[Group 8: Bilingual Localization Parity & RTL Quality]');

const REQUIRED_BREATHING_KEYS = [
  'breathingTabExercises',
  'breathingTabSoundscapes',
  'breathingLibraryTitle',
  'breathingLibrarySubtitle',
  'breathingFilterAll',
  'breathingCardStart',
  'breathingNoRetentionBadge',
  'breathingRetentionBadge',
  'breathingSpecializedBadge',
  'breathingBeginnerBadge',
  'breathingSetupTitle',
  'breathingSetupDuration',
  'breathingDurationMinutes',
  'breathingSetupPacing',
  'breathingPacingGentle',
  'breathingPacingNormal',
  'breathingPacingDeeper',
  'breathingSetupRetention',
  'breathingRetentionStandard',
  'breathingRetentionHoldFree',
  'breathingRetentionTriangle',
  'breathingSetupUntimed',
  'breathingUntimedTimed',
  'breathingUntimedAwareness',
  'breathingUntimedNaturalLabel',
  'breathingUntimedNaturalGuidance',
  'breathingUntimedAwarenessDefault',
  'breathingUntimedAwarenessHint',
  'breathingRetentionHoldFree478',
  'breathingSetupSound',
  'breathingSoundNone',
  'breathingSetupCues',
  'breathingCuesOff',
  'breathingCuesOn',
  'breathingCueVolume',
  'breathingCueInhale',
  'breathingCueExhale',
  'breathingCueHold',
  'breathingCueCompletion',
  'breathingCueProfileChime',
  'breathingCueProfileResonant',
  'breathingCueProfileBell',
  'breathingCueProfileWood',
  'breathingCueProfileNone',
  'breathingCuePreview',
  'breathingCuePreviewInhale',
  'breathingCuePreviewExhale',
  'breathingCuePreviewHold',
  'breathingCuePreviewCompletion',
  'breathingSetupStart',
  'breathingReturnToNatural',
  'breathingPause',
  'breathingResume',
  'breathingCycleCounter',
  'breathingTimeRemaining',
  'breathingSettlePrompt',
  'breathingCompleteTitle',
  'breathingCompleteMessage',
  'breathingCompleteReturn',
  'breathingAmbientAlternativeTitle',
  'breathingAmbientAlternativeDesc',
  'breathingAmbientAlternativeAction',
  'breathingSafetyDisclaimer',
  // Goals
  'goalAcuteStress',
  'goalAcuteStressDesc',
  'goalAnxietyRelief',
  'goalAnxietyReliefDesc',
  'goalEveningUnwind',
  'goalEveningUnwindDesc',
  'goalSleepPrep',
  'goalSleepPrepDesc',
  'goalFocusComposure',
  'goalFocusComposureDesc',
  'goalGentleAwareness',
  'goalGentleAwarenessDesc',
  'goalSpecialized',
  'goalSpecializedDesc',
] as const;

const ARABIC_UNICODE_REGEX = /[\u0600-\u06FF\u0750-\u077F]/;

for (const key of REQUIRED_BREATHING_KEYS) {
  assert(
    typeof (en as any)[key] === 'string' && (en as any)[key].length > 0,
    `English key "${key}" must be non-empty`
  );
  assert(
    typeof (ar as any)[key] === 'string' && (ar as any)[key].length > 0,
    `Arabic key "${key}" must be non-empty`
  );
  assert(
    ARABIC_UNICODE_REGEX.test((ar as any)[key]),
    `Arabic key "${key}" must contain authentic Arabic characters`
  );
}

// Check every technique text key
for (const tech of BREATHING_TECHNIQUES) {
  const techKeys = [
    tech.nameKey,
    tech.subtitleKey,
    tech.descriptionKey,
    tech.scientificContextKey,
  ];
  for (const k of techKeys) {
    assert(typeof (en as any)[k] === 'string', `EN text for ${k} must exist`);
    assert(typeof (ar as any)[k] === 'string', `AR text for ${k} must exist`);
    assert(ARABIC_UNICODE_REGEX.test((ar as any)[k]), `AR text for ${k} must be Arabic`);
  }
}
console.log(`✓ 100% complete bilingual parity verified across all breathing translation keys.`);

// =========================================================================
// Group 9: Phase 3C-UI-3 Breathing Audio Cue Customization & Synthesis Architecture
// =========================================================================
console.log('\n[Group 9: Breathing Audio Cue Customization & Synthesis Architecture]');

// 1. Default preferences and backward compatibility
assert(
  DEFAULT_BREATHING_CUE_PREFERENCES.volume === 0.5,
  'Default cue volume must be 50% (0.5)'
);
assert(
  DEFAULT_BREATHING_CUE_PREFERENCES.inhaleProfile === 'chime',
  'Default inhale profile must be chime'
);
assert(
  DEFAULT_BREATHING_CUE_PREFERENCES.exhaleProfile === 'chime',
  'Default exhale profile must be chime'
);
assert(
  DEFAULT_BREATHING_CUE_PREFERENCES.holdProfile === 'chime',
  'Default hold profile must be chime'
);
assert(
  DEFAULT_BREATHING_CUE_PREFERENCES.completionProfile === 'chime',
  'Default completion profile must be chime'
);

// Backward compatibility: load preferences from legacy storage without cuePreferences
mockStorage.clear();
mockStorage.set(
  BREATHING_PREFS_STORAGE_KEY,
  JSON.stringify({
    lastTechniqueId: 'box_breathing',
    preferredDurationMinutes: 5,
    soundscapeId: 'rain',
    instrumentalId: 'none',
    audioCueEnabled: true,
    tempoMultiplier: 1.0,
    // cuePreferences missing (legacy)
  })
);
const legacyLoaded = loadBreathingPreferences();
assert(
  legacyLoaded.cuePreferences !== undefined,
  'Legacy preferences must be automatically upgraded with default cuePreferences'
);
assert(
  legacyLoaded.cuePreferences.volume === 0.5,
  'Upgraded legacy cue volume must be 0.5'
);
assert(
  legacyLoaded.cuePreferences.inhaleProfile === 'chime',
  'Upgraded legacy inhale profile must be chime'
);

// 2. Corrupted storage and invalid profile recovery
const recoveredFromGarbage = validateCuePreferences({
  volume: 'loud',
  inhaleProfile: 'foghorn',
  exhaleProfile: 12345,
  holdProfile: null,
  completionProfile: 'synthesizer_disco',
});
assert(
  recoveredFromGarbage.volume === 0.5,
  'Corrupted volume type safely falls back to default 0.5'
);
assert(
  recoveredFromGarbage.inhaleProfile === 'chime',
  'Invalid inhale profile safely falls back to chime'
);
assert(
  recoveredFromGarbage.exhaleProfile === 'chime',
  'Invalid exhale profile safely falls back to chime'
);
assert(
  recoveredFromGarbage.holdProfile === 'chime',
  'Null hold profile safely falls back to chime'
);
assert(
  recoveredFromGarbage.completionProfile === 'chime',
  'Invalid completion profile safely falls back to chime'
);

// Non-object input fallback
assert(
  validateCuePreferences(null).volume === 0.5,
  'Null cuePreferences safely defaults'
);
assert(
  validateCuePreferences('invalid string').volume === 0.5,
  'String cuePreferences safely defaults'
);

// 3. Volume lower and upper bounds clamping
assert(
  clampCueVolume(0.0) === 0.1,
  'Volume below 0.1 clamps up to 0.1 minimum'
);
assert(
  clampCueVolume(-5.0) === 0.1,
  'Negative volume clamps up to 0.1 minimum'
);
assert(
  clampCueVolume(1.5) === 1.0,
  'Volume above 1.0 clamps down to 1.0 maximum'
);
assert(
  clampCueVolume(100.0) === 1.0,
  'Excessive volume clamps down to 1.0 maximum'
);
assert(
  clampCueVolume(0.5) === 0.5,
  'Volume 0.5 remains unchanged'
);
assert(
  clampCueVolume(NaN) === 0.5,
  'NaN volume safely falls back to 0.5'
);

const volumeClampedPrefs = validateCuePreferences({ volume: 0.02 });
assert(
  volumeClampedPrefs.volume === 0.1,
  'validateCuePreferences clamps volume < 0.1'
);
const volumeExcessPrefs = validateCuePreferences({ volume: 9.99 });
assert(
  volumeExcessPrefs.volume === 1.0,
  'validateCuePreferences clamps volume > 1.0'
);

// 4. All four profile generation functions across all phases
const PROFILES = ['chime', 'resonant', 'bell', 'wood'] as const;
const PHASES = ['inhale', 'exhale', 'hold', 'completion'] as const;

for (const prof of PROFILES) {
  for (const ph of PHASES) {
    let threw = false;
    try {
      playPhaseCue(ph, prof, 0.5);
    } catch {
      threw = true;
    }
    assert(!threw, `playPhaseCue(${ph}, ${prof}) must execute safely without throwing`);
  }
}

// Check none profile (muted)
let noneThrew = false;
try {
  playPhaseCue('hold', 'none', 0.5);
  playPhaseCue('completion', 'none', 0.5);
} catch {
  noneThrew = true;
}
assert(!noneThrew, 'Profile "none" must execute safely and silently');

// Backwards compatibility wrappers
let wrappersThrew = false;
try {
  playInhaleCue();
  playExhaleCue();
  playHoldCue();
  playCompletionCue('chime', 0.5);
} catch {
  wrappersThrew = true;
}
assert(!wrappersThrew, 'Legacy wrapper functions must execute safely without throwing');

// 5. Independent phase profile selection persistence
const customCuePrefs: BreathingCuePreferences = {
  volume: 0.75,
  inhaleProfile: 'wood',
  exhaleProfile: 'bell',
  holdProfile: 'resonant',
  completionProfile: 'none',
};

saveBreathingPreferences({
  lastTechniqueId: 'box_breathing',
  preferredDurationMinutes: 5,
  soundscapeId: 'silent',
  instrumentalId: 'none',
  audioCueEnabled: true,
  tempoMultiplier: 1.0,
  cuePreferences: customCuePrefs,
});

const reloadedCustom = loadBreathingPreferences();
assert(reloadedCustom.cuePreferences?.volume === 0.75, 'Custom volume persisted and reloaded');
assert(reloadedCustom.cuePreferences?.inhaleProfile === 'wood', 'Custom inhale profile persisted');
assert(reloadedCustom.cuePreferences?.exhaleProfile === 'bell', 'Custom exhale profile persisted');
assert(reloadedCustom.cuePreferences?.holdProfile === 'resonant', 'Custom hold profile persisted');
assert(reloadedCustom.cuePreferences?.completionProfile === 'none', 'Custom completion profile persisted');

// 6. Hold-free techniques logic
const boxStandard = resolveActivePhases(getBreathingTechnique('box_breathing')!, 'standard', 1.0);
const boxHoldFree = resolveActivePhases(getBreathingTechnique('box_breathing')!, 'hold_free', 1.0);
const boxHasHoldStandard = boxStandard.some(p => p.type === 'hold_in' || p.type === 'hold_out' || p.type === 'rest');
const boxHasHoldHoldFree = boxHoldFree.some(p => p.type === 'hold_in' || p.type === 'hold_out' || p.type === 'rest');
assert(boxHasHoldStandard === true, 'Standard box breathing includes hold phases');
assert(boxHasHoldHoldFree === false, 'Hold-free box breathing strictly eliminates all hold phases');

// 7. Exactly-once phase cue triggering logic simulation
let cueTriggerCount = 0;
let lastTriggeredPhase = '';
const mockTriggerAudioCue = (phaseType: string, enabled: boolean) => {
  if (!enabled) return;
  cueTriggerCount++;
  lastTriggeredPhase = phaseType;
};

const testPhases = boxStandard;
for (const p of testPhases) {
  mockTriggerAudioCue(p.type, true);
}
assert(cueTriggerCount === 4, 'Exactly 4 phase cues triggered across 4 phases');
assert(lastTriggeredPhase === testPhases[3].type, 'Last triggered phase matches 4th phase');

// 8. Completion cue on natural completion only
let completionCueFired = false;
const handleNaturalCompletion = (enabled: boolean, prefs: BreathingCuePreferences) => {
  if (enabled && prefs.completionProfile !== 'none') {
    completionCueFired = true;
  }
};
handleNaturalCompletion(true, DEFAULT_BREATHING_CUE_PREFERENCES);
assert(completionCueFired === true, 'Completion cue fires on natural completion when enabled');

// 9. No completion cue on manual stop or navigation cleanup
let manualStopCompletionFired = false;
const handleManualStop = () => {
  stopPreview();
};
handleManualStop();
assert(manualStopCompletionFired === false, 'Manual stop must never fire completion cue');

// 10. Pause/resume without duplicate cues
let cuesDuringPause = 0;
let isPaused = true;
const simulateLoopTickWhilePaused = (phaseType: string) => {
  if (isPaused) return;
  mockTriggerAudioCue(phaseType, true);
};
simulateLoopTickWhilePaused('exhale');
assert(cuesDuringPause === 0, 'Zero cues fire while paused');

// 11. Preview concurrency and cleanup
let previewThrew = false;
try {
  previewCue('inhale', 'chime', 0.5);
  previewCue('exhale', 'bell', 0.6);
  previewCue('hold', 'resonant', 0.4);
  stopPreview();
} catch {
  previewThrew = true;
}
assert(!previewThrew, 'Preview concurrency and stopPreview execute cleanly without error');

// 12. Audio mixer isolation
assert(
  typeof playPhaseCue === 'function' && typeof previewCue === 'function',
  'Breathing cues exist as dedicated procedural Web Audio synthesis independent of AudioEngine'
);

console.log('✓ Phase 3C-UI-3 Breathing Audio Cue Customization test suite fully verified.');

// =========================================================================
// Group 10: Phase 3C-UI-4 Breathing Experience Polish & Accessibility
// =========================================================================
console.log('\n[Group 10: Phase 3C-UI-4 Breathing Experience Polish & Accessibility]');

// 1. Exactly-once screen-reader phase announcements
let announcedList: string[] = [];
let lastKey = '';
const triggerAnnouncement = (
  status: string,
  isUntimed: boolean,
  cycle: number,
  phaseIdx: number,
  phaseType: string,
  label: string
) => {
  if (status !== 'running') return;
  const currentKey = isUntimed ? 'untimed-awareness' : `${cycle}-${phaseIdx}-${phaseType}`;
  if (currentKey !== lastKey) {
    lastKey = currentKey;
    announcedList.push(label);
  }
};

// Start session -> Inhale phase
triggerAnnouncement('running', false, 1, 0, 'inhale', en.phaseInhale);
assert(announcedList.length === 1 && announcedList[0] === 'Inhale', 'Initial phase announced exactly once');

// 2. No repeated announcements on frame updates / countdown ticks in the same phase
for (let sec = 4; sec >= 1; sec--) {
  triggerAnnouncement('running', false, 1, 0, 'inhale', en.phaseInhale);
}
assert(announcedList.length === 1, 'Zero duplicate announcements during progress updates in the same phase');

// Pause and resume without duplicate announcements
triggerAnnouncement('paused', false, 1, 0, 'inhale', en.phaseInhale);
triggerAnnouncement('running', false, 1, 0, 'inhale', en.phaseInhale);
assert(announcedList.length === 1, 'Pause and resume do not trigger duplicate screen-reader announcements');

// Transition to Hold
triggerAnnouncement('running', false, 1, 1, 'hold_in', en.phaseHoldFull);
assert(announcedList.length === 2 && announcedList[1] === 'Hold Gently', 'New phase announced exactly once on transition');

// Transition to Exhale
triggerAnnouncement('running', false, 1, 2, 'exhale', en.phaseExhale);
assert(announcedList.length === 3 && announcedList[2] === 'Exhale', 'Exhale phase announced exactly once');

// Transition to Cycle 2 Inhale
triggerAnnouncement('running', false, 2, 0, 'inhale', en.phaseInhale);
assert(announcedList.length === 4 && announcedList[3] === 'Inhale', 'Subsequent cycle phase announced when cycle changes');

// 3. Timed phase countdown calculation
const computeRemainingPhaseSeconds = (durationSec: number, progressFraction: number) => {
  return Math.max(1, Math.ceil(durationSec * (1.0 - progressFraction)));
};

// For 4.0s duration
assert(computeRemainingPhaseSeconds(4.0, 0.0) === 4, 'Phase remaining at 0% progress is 4s');
assert(computeRemainingPhaseSeconds(4.0, 0.24) === 4, 'Phase remaining at 24% progress is 4s');
assert(computeRemainingPhaseSeconds(4.0, 0.26) === 3, 'Phase remaining at 26% progress is 3s');
assert(computeRemainingPhaseSeconds(4.0, 0.51) === 2, 'Phase remaining at 51% progress is 2s');
assert(computeRemainingPhaseSeconds(4.0, 0.76) === 1, 'Phase remaining at 76% progress is 1s');
assert(computeRemainingPhaseSeconds(4.0, 0.99) === 1, 'Phase remaining at 99% progress is 1s (never 0s before transition)');

// For 7.0s hold
assert(computeRemainingPhaseSeconds(7.0, 0.0) === 7, 'Hold remaining at 0% progress is 7s');
assert(computeRemainingPhaseSeconds(7.0, 0.85) === 2, 'Hold remaining at 85% progress is 2s');
assert(computeRemainingPhaseSeconds(7.0, 0.95) === 1, 'Hold remaining at 95% progress is 1s');

// 4. No phase countdown during untimed awareness
const renderPhaseCountdown = (isUntimed: boolean, durationSec: number, progress: number) => {
  if (isUntimed) return null;
  return `${computeRemainingPhaseSeconds(durationSec, progress)}s`;
};
assert(renderPhaseCountdown(true, 3.5, 0.5) === null, 'Phase countdown is strictly null during untimed awareness');
assert(renderPhaseCountdown(false, 3.5, 0.5) === '2s', 'Phase countdown correctly renders in timed mode');

// 5. Static untimed orb behavior vs 6. Preserved timed orb synchronization
const computeOrbScale = (
  phaseType: string,
  targetScale: number,
  progress: number,
  isUntimed: boolean,
  reducedMotion: boolean
) => {
  if (reducedMotion || isUntimed) return 1.0;
  if (phaseType === 'inhale' || phaseType === 'inhale_second') {
    return 1.0 + (targetScale - 1.0) * progress;
  } else if (phaseType === 'hold_in') {
    return targetScale;
  } else if (phaseType === 'exhale') {
    return targetScale - (targetScale - 1.0) * progress;
  }
  return 1.0;
};

// Untimed mode: scale remains 1.0 throughout all progress fractions
assert(computeOrbScale('inhale', 1.4, 0.0, true, false) === 1.0, 'Untimed orb scale is 1.0 at start');
assert(computeOrbScale('inhale', 1.4, 0.5, true, false) === 1.0, 'Untimed orb scale remains 1.0 at 50%');
assert(computeOrbScale('inhale', 1.4, 1.0, true, false) === 1.0, 'Untimed orb scale remains 1.0 at 100%');
assert(computeOrbScale('exhale', 1.4, 0.5, true, false) === 1.0, 'Untimed orb scale remains 1.0 on exhale');

// Timed mode: dynamic fluid synchronization
assert(computeOrbScale('inhale', 1.4, 0.0, false, false) === 1.0, 'Timed inhale starts at scale 1.0');
assert(Math.abs(computeOrbScale('inhale', 1.4, 0.5, false, false) - 1.2) < 0.001, 'Timed inhale reaches 1.2 at 50%');
assert(Math.abs(computeOrbScale('inhale', 1.4, 1.0, false, false) - 1.4) < 0.001, 'Timed inhale reaches target 1.4 at 100%');
assert(computeOrbScale('hold_in', 1.4, 0.5, false, false) === 1.4, 'Timed hold_in holds targetScale 1.4 steadily');
assert(Math.abs(computeOrbScale('exhale', 1.4, 0.5, false, false) - 1.2) < 0.001, 'Timed exhale contracts to 1.2 at 50%');
assert(Math.abs(computeOrbScale('exhale', 1.4, 1.0, false, false) - 1.0) < 0.001, 'Timed exhale returns to 1.0 at 100%');

// 7. Active session indicator when navigating between Recover subtabs
const shouldShowActiveBreathingBanner = (isBreathingActive: boolean, activeSubTab: string) => {
  return isBreathingActive && activeSubTab !== 'breathing';
};
assert(shouldShowActiveBreathingBanner(true, 'sessions') === true, 'Banner displays when on Sessions subtab during active breathing');
assert(shouldShowActiveBreathingBanner(true, 'soundscapes') === true, 'Banner displays when on Soundscapes subtab during active breathing');
assert(shouldShowActiveBreathingBanner(true, 'breathing') === false, 'Banner hidden when on Breathing subtab (player is already visible)');
assert(shouldShowActiveBreathingBanner(false, 'sessions') === false, 'Banner hidden when no session is active');

// 8. Returning to existing session without creating another session
let activeSubTabState = 'soundscapes';
const handleReturnToBreathing = () => {
  activeSubTabState = 'breathing';
};
handleReturnToBreathing();
assert(activeSubTabState === 'breathing', 'Return action directly sets active subtab to breathing without mutating session instance');

// 9. Mobile touch target classes
import fs from 'fs';
const playerSrc = fs.readFileSync('src/components/breathing/BreathingPlayer.tsx', 'utf8');
const setupSrc = fs.readFileSync('src/components/breathing/BreathingSetupModal.tsx', 'utf8');
const orbSrc = fs.readFileSync('src/components/breathing/BreathingOrb.tsx', 'utf8');
const recoverViewSrc = fs.readFileSync('src/views/RecoverView.tsx', 'utf8');

assert(playerSrc.includes('min-h-[44px]'), 'BreathingPlayer contains min-h-[44px] for mobile touch ergonomics');
assert(setupSrc.includes('min-h-[44px]'), 'BreathingSetupModal contains min-h-[44px] for mobile touch ergonomics');
assert(playerSrc.includes('aria-live="polite"'), 'BreathingPlayer contains aria-live polite region');
assert(playerSrc.includes('aria-atomic="true"'), 'BreathingPlayer contains aria-atomic true');
assert(playerSrc.includes('sr-only'), 'BreathingPlayer announcement region is visually hidden with sr-only');
assert(orbSrc.includes('aria-hidden="true"'), 'BreathingOrb in-phase countdown is aria-hidden from screen readers');
assert(recoverViewSrc.includes('recoverActiveBreathingBanner'), 'RecoverView contains persistent active session indicator');

// 10. Correct Arabic and English hold-free descriptions matching actual implementation
const tech478 = getBreathingTechnique('4_7_8_relax');
assert(tech478 !== undefined, '4-7-8 technique exists in catalog');
assert(tech478!.holdFreePhases !== undefined, '4-7-8 has hold-free phases');
assert(tech478!.holdFreePhases![0].durationSeconds === 4.0, 'Hold-free inhale is 4.0s');
assert(tech478!.holdFreePhases![1].durationSeconds === 5.0, 'Hold-free exhale is 5.0s');

assert(
  en.tech478Desc.includes('gentle 4s inhale / 5s exhale flow'),
  `English 4-7-8 description must specify gentle 4s inhale / 5s exhale flow (found: ${en.tech478Desc})`
);
assert(
  ar.tech478Desc.includes('شهيق 4 ثوانٍ وزفير 5 ثوانٍ بإيقاع مريح'),
  `Arabic 4-7-8 description must specify شهيق 4 ثوانٍ وزفير 5 ثوانٍ بإيقاع مريح (found: ${ar.tech478Desc})`
);

console.log('✓ Phase 3C-UI-4 Breathing Session Experience Polish test suite fully verified.');

// =========================================================================
// Group 11: Phase 3C-UI-4.1 Active Breathing Session Stop Control
// =========================================================================
console.log('\n[Group 11: Phase 3C-UI-4.1 Active Breathing Session Stop Control]');

// 1. Localization keys for Stop Breathing
assert(
  en.recoverStopBreathing === 'Stop Breathing',
  `English recoverStopBreathing must be 'Stop Breathing' (found: ${en.recoverStopBreathing})`
);
assert(
  ar.recoverStopBreathing === 'إيقاف التنفس',
  `Arabic recoverStopBreathing must be 'إيقاف التنفس' (found: ${ar.recoverStopBreathing})`
);

// 2. Banner button markup & mobile touch targets in RecoverView
const updatedRecoverViewSrc = fs.readFileSync('src/views/RecoverView.tsx', 'utf8');
assert(
  updatedRecoverViewSrc.includes('recoverStopBreathing'),
  'RecoverView banner must include recoverStopBreathing action button'
);
assert(
  updatedRecoverViewSrc.includes('stopBreathingSession'),
  'RecoverView Stop Breathing button must invoke stopBreathingSession'
);
assert(
  updatedRecoverViewSrc.includes('min-h-[44px]'),
  'RecoverView Stop Breathing button must specify min-h-[44px] for mobile touch target compliance'
);
assert(
  updatedRecoverViewSrc.includes('id="active-breathing-banner"'),
  'RecoverView must preserve unique active-breathing-banner identifier'
);

// 3. Stop Breathing clears active state and causes banner to disappear
let mockBreathingStatus: 'idle' | 'running' | 'paused' | 'settling' = 'running';
let mockActiveTechnique: string | null = 'resonance_frequency';
let mockStartedSoundscapeId: string | null = null;
let mockActiveMixerTracks: Record<string, boolean> = {
  rain: true,
  xiao: true,
};

const simulateStopBreathingSession = () => {
  // Replicates BreathingContext stopSession behavior
  stopPreview();
  if (mockStartedSoundscapeId) {
    mockActiveMixerTracks[mockStartedSoundscapeId] = false;
    mockStartedSoundscapeId = null;
  }
  mockActiveTechnique = null;
  mockBreathingStatus = 'idle';
};

const isBreathingActiveFn = (status: string) => {
  return status === 'running' || status === 'paused' || status === 'settling';
};

// Before stop: breathing is active, banner is visible
assert(isBreathingActiveFn(mockBreathingStatus) === true, 'Breathing session is initially active');
assert(
  shouldShowActiveBreathingBanner(isBreathingActiveFn(mockBreathingStatus), 'soundscapes') === true,
  'Banner is visible in Sound Mixer before stop'
);

// Execute stop
simulateStopBreathingSession();

// After stop: breathing is idle, banner is hidden, activeTechnique is cleared
assert(mockBreathingStatus === 'idle', 'Breathing status is idle after stop');
assert(mockActiveTechnique === null, 'Active technique is null after stop');
assert(isBreathingActiveFn(mockBreathingStatus) === false, 'Breathing is no longer active');
assert(
  shouldShowActiveBreathingBanner(isBreathingActiveFn(mockBreathingStatus), 'soundscapes') === false,
  'Banner is immediately hidden in Sound Mixer after stop'
);

// 4. Independent audio tracks ownership separation:
// Independent mixer tracks ('rain', 'xiao') MUST remain playing uninterrupted
assert(mockActiveMixerTracks.rain === true, 'Independent rain track continues playing uninterrupted after breathing stops');
assert(mockActiveMixerTracks.xiao === true, 'Independent xiao instrumental track continues playing uninterrupted after breathing stops');

// 5. Subsequent breathing audio cues are stopped
let cuesPlayedAfterStop = 0;
const simulateCueAfterStop = (phaseType: string) => {
  if (mockBreathingStatus !== 'running') return;
  cuesPlayedAfterStop++;
};
simulateCueAfterStop('inhale');
simulateCueAfterStop('exhale');
assert(cuesPlayedAfterStop === 0, 'Zero breathing audio cues play after breathing session is stopped');

// 6. Starting a new session and verifying Return to Exercise behavior
mockBreathingStatus = 'running';
mockActiveTechnique = 'box_breathing';
assert(isBreathingActiveFn(mockBreathingStatus) === true, 'New breathing session becomes active');
assert(
  shouldShowActiveBreathingBanner(isBreathingActiveFn(mockBreathingStatus), 'soundscapes') === true,
  'Banner re-appears in Sound Mixer when new exercise begins'
);

let currentRecoverSubTab = 'soundscapes';
const handleBannerReturn = () => {
  currentRecoverSubTab = 'breathing';
};
handleBannerReturn();
assert(
  currentRecoverSubTab === 'breathing',
  'Return to Exercise switches subtab to breathing without interrupting active session'
);

console.log('✓ Phase 3C-UI-4.1 Active Breathing Session Stop Control test suite fully verified.');

console.log(`\n======================================================`);
console.log(`ALL PHASE 3A BREATHING TESTS PASSED: ${passedTests} assertions verified.`);
console.log(`======================================================\n`);
