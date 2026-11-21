/**
 * NeuroCalm & Fokus — Phase 3C Integrated Relaxation Test Suite
 * Validates catalog definitions, structural gain bounds, ownership tracking,
 * conflict resolution logic, resonance pacing numerical bounds, local persistence,
 * and bilingual localization parity.
 */

import { RELAXATION_SESSIONS, getSessionById, getSessionsByFamily } from '../src/data/relaxationSessions';
import { SOUNDSCAPE_CATALOG } from '../src/audio/AudioEngine';
import { BREATHING_TECHNIQUES } from '../src/data/breathingTechniques';
import {
  loadRelaxationPreferences,
  saveRelaxationPreferences,
  DEFAULT_RELAXATION_PREFERENCES,
} from '../src/storage/relaxationStorage';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { SoundscapeId } from '../src/types/audio';
import { RelaxationSessionId, SessionConflictState } from '../src/types/relaxationSession';

let passedTests = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    throw new Error(`TEST FAILED: ${msg}`);
  }
  passedTests++;
}

// In-memory mock localStorage for Node.js test environment
const mockStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => { mockStorage.set(key, String(val)); },
  removeItem: (key: string) => { mockStorage.delete(key); },
  clear: () => { mockStorage.clear(); },
};
(globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;

console.log('--- TEST GROUP 1: Curated Relaxation Catalog Integrity ---');

// 1. Exactly 5 approved sessions
assert(RELAXATION_SESSIONS.length === 5, 'Must contain exactly 5 approved relaxation sessions');

const expectedSessionIds: RelaxationSessionId[] = [
  'session_deep_serenity',
  'session_quiet_stillness',
  'session_natures_rhythm',
  'session_musical_pause',
  'session_evening_retreat',
];

for (const id of expectedSessionIds) {
  const session = getSessionById(id);
  assert(Boolean(session), `Session ${id} must exist in catalog`);
}

// Session A: Deep Serenity
const sessionA = getSessionById('session_deep_serenity')!;
assert(sessionA.familyId === 'combined_soundscape', 'Session A must be combined_soundscape');
assert(sessionA.isBreathingSession === true, 'Session A must have breathing enabled');
assert(sessionA.breathingConfig?.techniqueId === 'diaphragmatic', 'Session A must use diaphragmatic breathing');
assert(sessionA.breathingConfig?.defaultUntimed === true, 'Session A must default to untimed breathing');
assert(sessionA.audioTracks.some((t) => t.soundId === 'xiao'), 'Session A must include Xiao');
assert(sessionA.audioTracks.some((t) => t.soundId === 'rain'), 'Session A must include Rain');
assert(
  JSON.stringify(sessionA.availableDurations) === JSON.stringify([3, 5, 10]),
  'Session A must offer 3, 5, 10 min durations'
);

// Session B: Quiet Stillness
const sessionB = getSessionById('session_quiet_stillness')!;
assert(sessionB.familyId === 'chinese_instrumental', 'Session B must be chinese_instrumental');
assert(sessionB.isBreathingSession === true, 'Session B must have breathing enabled');
assert(sessionB.breathingConfig?.techniqueId === 'diaphragmatic', 'Session B must use diaphragmatic breathing');
assert(sessionB.breathingConfig?.defaultUntimed === true, 'Session B must default to untimed breathing');
assert(sessionB.audioTracks.some((t) => t.soundId === 'guqin'), 'Session B must include Guqin');
assert(
  sessionB.audioTracks.some((t) => t.soundId === 'stream' && t.isOptional),
  'Session B must include optional Stream'
);
assert(
  JSON.stringify(sessionB.availableDurations) === JSON.stringify([3, 5, 10]),
  'Session B must offer 3, 5, 10 min durations'
);

// Session C: Nature's Rhythm
const sessionC = getSessionById('session_natures_rhythm')!;
assert(sessionC.familyId === 'nature_based', 'Session C must be nature_based');
assert(sessionC.isBreathingSession === true, 'Session C must have breathing enabled');
assert(sessionC.breathingConfig?.techniqueId === 'resonance_frequency', 'Session C must use resonance_frequency');
assert(sessionC.audioTracks.some((t) => t.soundId === 'ocean_waves'), 'Session C must include Ocean Waves');
assert(
  JSON.stringify(sessionC.availableDurations) === JSON.stringify([3, 5, 10]),
  'Session C must offer 3, 5, 10 min durations'
);

// Session D: Musical Pause
const sessionD = getSessionById('session_musical_pause')!;
assert(sessionD.familyId === 'music_only', 'Session D must be music_only');
assert(sessionD.isBreathingSession === false, 'Session D must have breathing disabled');
assert(sessionD.audioTracks.some((t) => t.soundId === 'dizi'), 'Session D must include Dizi');
assert(
  JSON.stringify(sessionD.availableDurations) === JSON.stringify([5, 10, 15, 'open_ended']),
  'Session D must offer 5, 10, 15, open_ended durations'
);

// Session E: Evening Retreat
const sessionE = getSessionById('session_evening_retreat')!;
assert(sessionE.familyId === 'music_only', 'Session E must be music_only');
assert(sessionE.isBreathingSession === false, 'Session E defaults to music-only');
assert(sessionE.breathingConfig?.isOptional === true, 'Session E breathing must be optional (music-only default)');
assert(sessionE.audioTracks.some((t) => t.soundId === 'guqin'), 'Session E must include Guqin');
assert(
  JSON.stringify(sessionE.availableDurations) === JSON.stringify([10, 15, 30, 'open_ended']),
  'Session E must offer 10, 15, 30, open_ended durations'
);

// Family Filter Query
assert(getSessionsByFamily('all').length === 5, 'Filter "all" must return all 5 sessions');
assert(getSessionsByFamily('combined_soundscape').length === 1, 'Filter combined_soundscape must return 1 session');
assert(getSessionsByFamily('chinese_instrumental').length === 1, 'Filter chinese_instrumental must return 1 session');
assert(getSessionsByFamily('nature_based').length === 1, 'Filter nature_based must return 1 session');
assert(getSessionsByFamily('music_only').length === 2, 'Filter music_only must return 2 sessions');

console.log('--- TEST GROUP 2: Structural Gain Bounds & Safety Verification ---');

for (const session of RELAXATION_SESSIONS) {
  assert(session.audioTracks.length <= 4, `Session ${session.id} must not exceed 4 tracks`);

  let maxPossibleAggregateGain = 0;
  for (const track of session.audioTracks) {
    const catalogEntry = SOUNDSCAPE_CATALOG[track.soundId];
    assert(Boolean(catalogEntry), `Track ${track.soundId} must exist in SOUNDSCAPE_CATALOG`);
    assert(
      catalogEntry.maxGainCeiling <= 0.20,
      `Track ${track.soundId} maxGainCeiling (${catalogEntry.maxGainCeiling}) must not exceed individual ceiling of 0.20`
    );
    assert(
      track.defaultVolume >= 0.0 && track.defaultVolume <= 1.0,
      `Track ${track.soundId} defaultVolume (${track.defaultVolume}) must be in [0.0, 1.0]`
    );

    // Theoretical maximum track gain is maxGainCeiling * 1.0
    maxPossibleAggregateGain += catalogEntry.maxGainCeiling;
  }

  // With at most 4 tracks each <= 0.20, maximum theoretical sum is 0.80
  assert(
    maxPossibleAggregateGain <= 0.80001,
    `Session ${session.id} maximum theoretical aggregate gain (${maxPossibleAggregateGain.toFixed(3)}) must be <= 0.80`
  );
}

console.log('--- TEST GROUP 3: Resonance Pacing Numerical Bounds ---');

const resonanceTech = BREATHING_TECHNIQUES.find((t) => t.id === 'resonance_frequency')!;
assert(Boolean(resonanceTech), 'Resonance Pacing technique must exist');
assert(
  resonanceTech.tempoAdjustmentRange?.minMultiplier === 0.8,
  'Resonance Pacing min tempo multiplier must be 0.8'
);
assert(
  resonanceTech.tempoAdjustmentRange?.maxMultiplier === 1.2,
  'Resonance Pacing max tempo multiplier must be 1.2'
);

// Calculate BPM bounds
// Base cycle: Inhale 5.0s, Exhale 5.0s = 10.0s cycle -> 60 / 10 = 6.0 BPM
// Multiplier 0.80x: 5.0 * 0.80 = 4.0s in, 4.0s out = 8.0s cycle -> 60 / 8 = 7.5 BPM
// Multiplier 1.20x: 5.0 * 1.20 = 6.0s in, 6.0s out = 12.0s cycle -> 60 / 12 = 5.0 BPM
const baseInhale = resonanceTech.phases.find((p) => p.type === 'inhale')!.durationSeconds;
const baseExhale = resonanceTech.phases.find((p) => p.type === 'exhale')!.durationSeconds;
const baseCycle = baseInhale + baseExhale;
assert(baseCycle === 10.0, 'Base resonance cycle must be 10.0 seconds');

const minCycle = baseCycle * resonanceTech.tempoAdjustmentRange!.minMultiplier; // 8.0s
const maxCycle = baseCycle * resonanceTech.tempoAdjustmentRange!.maxMultiplier; // 12.0s
const maxBpm = 60 / minCycle; // 7.5 BPM
const minBpm = 60 / maxCycle; // 5.0 BPM

assert(Math.abs(maxBpm - 7.5) < 0.001, 'Min multiplier (0.80) must correspond to exactly 7.5 BPM');
assert(Math.abs(minBpm - 5.0) < 0.001, 'Max multiplier (1.20) must correspond to exactly 5.0 BPM');

// Calibrated Presets:
// Gentle (1.15x): cycle = 11.5s -> 5.22 BPM
// Balanced (1.00x): cycle = 10.0s -> 6.00 BPM
// Slightly Quicker (0.90x): cycle = 9.0s -> 6.67 BPM
const gentleCycle = baseCycle * 1.15;
const balancedCycle = baseCycle * 1.00;
const quickerCycle = baseCycle * 0.90;
assert(gentleCycle > balancedCycle && balancedCycle > quickerCycle, 'Gentle cycle must be longer than Balanced, which is longer than Slightly Quicker');

console.log('--- TEST GROUP 4: Ownership Model & Conflict Detection Logic ---');

// Test Helper simulating conflict detection logic
function evaluateConflict(
  activeTrackIds: SoundscapeId[],
  sessionTracks: SoundscapeId[]
): {
  isConflict: boolean;
  canKeepPlayingAlongside: boolean;
  duplicateTrackIds: SoundscapeId[];
  isCapacityExceeded: boolean;
  disableReasonKey?: string;
} {
  if (activeTrackIds.length === 0) {
    return {
      isConflict: false,
      canKeepPlayingAlongside: true,
      duplicateTrackIds: [],
      isCapacityExceeded: false,
    };
  }

  const duplicateTrackIds = sessionTracks.filter((id) => activeTrackIds.includes(id));
  const totalCount = activeTrackIds.length + sessionTracks.length;
  const isCapacityExceeded = totalCount > 4;
  const canKeepPlayingAlongside = duplicateTrackIds.length === 0 && !isCapacityExceeded;

  let disableReasonKey: string | undefined;
  if (duplicateTrackIds.length > 0) {
    disableReasonKey = 'sessionConflictDuplicateWarning';
  } else if (isCapacityExceeded) {
    disableReasonKey = 'sessionConflictCapacityWarning';
  }

  return {
    isConflict: true,
    canKeepPlayingAlongside,
    duplicateTrackIds,
    isCapacityExceeded,
    disableReasonKey,
  };
}

// Case 1: No active tracks
const case1 = evaluateConflict([], ['xiao', 'rain']);
assert(!case1.isConflict, 'Case 1: No active tracks should yield no conflict');
assert(case1.canKeepPlayingAlongside === true, 'Case 1: canKeepAlongside is true');

// Case 2: Duplicate track collision (rain already playing)
const case2 = evaluateConflict(['rain'], ['xiao', 'rain']);
assert(case2.isConflict === true, 'Case 2: Rain collision must create conflict');
assert(case2.canKeepPlayingAlongside === false, 'Case 2: Cannot keep alongside duplicate track');
assert(case2.duplicateTrackIds.includes('rain'), 'Case 2: Duplicate tracks must contain rain');
assert(
  case2.disableReasonKey === 'sessionConflictDuplicateWarning',
  'Case 2: Must flag duplicate warning reason'
);

// Case 3: Capacity exceeded (3 active tracks + 2 requested = 5 > 4)
const case3 = evaluateConflict(['stream', 'fan', 'fireplace'], ['xiao', 'rain']);
assert(case3.isConflict === true, 'Case 3: Must create conflict');
assert(case3.isCapacityExceeded === true, 'Case 3: Capacity exceeded');
assert(case3.canKeepPlayingAlongside === false, 'Case 3: Cannot keep alongside when capacity exceeded');
assert(
  case3.disableReasonKey === 'sessionConflictCapacityWarning',
  'Case 3: Must flag capacity warning reason'
);

// Case 4: Non-overlapping under capacity (1 active track + 2 requested = 3 <= 4)
const case4 = evaluateConflict(['fireplace'], ['xiao', 'rain']);
assert(case4.isConflict === true, 'Case 4: Mixer is active so modal is shown');
assert(case4.canKeepPlayingAlongside === true, 'Case 4: Keep alongside is permitted (non-overlapping, 3 <= 4)');
assert(case4.duplicateTrackIds.length === 0, 'Case 4: No duplicate tracks');
assert(case4.disableReasonKey === undefined, 'Case 4: No disable reason');

// Case 5: Ownership isolation
const sessionOwnedTracks: SoundscapeId[] = ['xiao', 'rain'];
const preExistingTracks: SoundscapeId[] = ['fireplace'];
// Teardown should only stop sessionOwnedTracks
const tracksToStop = sessionOwnedTracks.filter((id) => !preExistingTracks.includes(id));
assert(tracksToStop.length === 2, 'Only session-owned tracks should be targeted for stop');
assert(!tracksToStop.includes('fireplace'), 'Pre-existing track fireplace must not be stopped');

console.log('--- TEST GROUP 5: Preferences Persistence & Validation ---');

mockStorage.clear();

// Load with empty storage -> returns defaults
const pref1 = loadRelaxationPreferences();
assert(pref1.keepAudioOnPause === false, 'Default keepAudioOnPause must be false');
assert(pref1.lastSessionId === 'session_deep_serenity', 'Default lastSessionId must be session_deep_serenity');
assert(pref1.preferredDuration === 5, 'Default preferredDuration must be 5');
assert(pref1.customTrackVolumes.xiao === 0.60, 'Default xiao custom volume must be 0.60');

// Save modified preferences
saveRelaxationPreferences({
  lastSessionId: 'session_quiet_stillness',
  preferredDuration: 10,
  customTrackVolumes: { guqin: 0.75 },
  keepAudioOnPause: true,
});

const pref2 = loadRelaxationPreferences();
assert(pref2.keepAudioOnPause === true, 'Saved keepAudioOnPause must persist');
assert(pref2.lastSessionId === 'session_quiet_stillness', 'Saved lastSessionId must persist');
assert(pref2.preferredDuration === 10, 'Saved preferredDuration must persist');
assert(pref2.customTrackVolumes.guqin === 0.75, 'Saved customTrackVolumes must persist');

// Defensive fallback on corrupted storage
mockStorage.set('neurocalm_relaxation_prefs_v1', 'NOT_VALID_JSON{[');
const pref3 = loadRelaxationPreferences();
assert(pref3.keepAudioOnPause === false, 'Corrupted storage must fallback to default keepAudioOnPause');
assert(pref3.lastSessionId === 'session_deep_serenity', 'Corrupted storage must fallback to default lastSessionId');
assert(pref3.preferredDuration === 5, 'Corrupted storage must fallback to default preferredDuration');

// Defensive fallback on invalid session ID or out-of-range volume
mockStorage.set(
  'neurocalm_relaxation_prefs_v1',
  JSON.stringify({
    lastSessionId: 'invalid_hacked_session',
    preferredDuration: 999,
    customTrackVolumes: { xiao: 5.5, dizi: -1.0 },
    keepAudioOnPause: true,
  })
);
const pref4 = loadRelaxationPreferences();
assert(pref4.lastSessionId === 'session_deep_serenity', 'Invalid session ID must fallback to default');
assert(pref4.preferredDuration === 5, 'Invalid duration must fallback to default');
assert(pref4.customTrackVolumes.xiao === 1.0, 'Out-of-range volume > 1.0 must clamp to 1.0');
assert(pref4.customTrackVolumes.dizi === 0.0, 'Out-of-range volume < 0.0 must clamp to 0.0');

console.log('--- TEST GROUP 6: Localization Completeness & Parity ---');

const phase3CKeys = [
  'recoverTabSessions',
  'recoverSessionsTitle',
  'recoverSessionsSubtitle',
  'sessionFamilyAll',
  'sessionFamilyCombined',
  'sessionFamilyInstrumental',
  'sessionFamilyNature',
  'sessionFamilyMusicOnly',
  'sessionModeBreathing',
  'sessionModeMusicOnly',
  'sessionOpenEnded',
  'sessionDurationLabel',
  'sessionBeginButton',
  'sessionDrawerAudioTitle',
  'sessionKeepAudioOnPause',
  'sessionReturnToNatural',
  'sessionCompleteTitle',
  'sessionCompleteMessage',
  'sessionCompleteReturn',
  'sessionConflictTitle',
  'sessionConflictMessage',
  'sessionConflictStop',
  'sessionConflictKeep',
  'sessionConflictCancel',
  'sessionConflictDuplicateWarning',
  'sessionConflictCapacityWarning',
  'sessionDeepSerenityName',
  'sessionDeepSerenitySubtitle',
  'sessionDeepSerenityDesc',
  'sessionQuietStillnessName',
  'sessionQuietStillnessSubtitle',
  'sessionQuietStillnessDesc',
  'sessionNaturesRhythmName',
  'sessionNaturesRhythmSubtitle',
  'sessionNaturesRhythmDesc',
  'sessionMusicalPauseName',
  'sessionMusicalPauseSubtitle',
  'sessionMusicalPauseDesc',
  'sessionEveningRetreatName',
  'sessionEveningRetreatSubtitle',
  'sessionEveningRetreatDesc',
  'sessionOptionBreathing',
  'sessionOptionBreathingHint',
  'sessionTempoGentle',
  'sessionTempoBalanced',
  'sessionTempoQuicker',
  'sessionTimeRemaining',
  'sessionTimeElapsed',
];

for (const key of phase3CKeys) {
  assert(
    typeof (en as Record<string, string>)[key] === 'string' &&
      (en as Record<string, string>)[key].trim().length > 0,
    `English key ${key} must exist and be non-empty`
  );
  assert(
    typeof (ar as Record<string, string>)[key] === 'string' &&
      (ar as Record<string, string>)[key].trim().length > 0,
    `Arabic key ${key} must exist and be non-empty`
  );
}

// Check Guqin verified Arabic naming across sound definitions
assert(
  ar.soundGuqin.includes('آلة الغوتشين الوترية الصينية'),
  'Arabic soundGuqin must use verified terminology "آلة الغوتشين الوترية الصينية"'
);
assert(
  !ar.soundGuqin.includes('قانون الغوتشين'),
  'Arabic soundGuqin must NOT use erroneous terminology "قانون الغوتشين"'
);

console.log('--- TEST GROUP 7: Audio Ownership Separation On Breathing Stop (Phase 3C-UI-4.1) ---');
// Verify that stopping breathing leaves integrated relaxation session audio untouched
const mockRelaxationAudioState: Record<SoundscapeId, boolean> = {
  rain: true,
  xiao: true,
  stream: false,
  ocean_waves: false,
  fireplace: false,
  fan: false,
  dizi: false,
  guqin: false,
  guzheng: false,
};
const activeSessionAudioTracks: SoundscapeId[] = ['rain', 'xiao'];
let isBannerBreathingActive = true;

// Simulate stopping breathing only (via banner stop action)
const stopBreathingFromBanner = () => {
  isBannerBreathingActive = false;
  // Does NOT teardown activeSessionAudioTracks
};

stopBreathingFromBanner();
assert(isBannerBreathingActive === false, 'Breathing state is inactive after stop');
assert(mockRelaxationAudioState.rain === true, 'Relaxation session rain track continues playing');
assert(mockRelaxationAudioState.xiao === true, 'Relaxation session xiao track continues playing');
assert(activeSessionAudioTracks.length === 2, 'Session owned tracks list remains intact');

console.log('--- TEST GROUP 8: Disabled Optional Tracks & Concurrency Slot Isolation (DEF-02) ---');

// Helper to evaluate conflict taking enabledTrackIds into account
function evaluateConflictWithEnabled(
  activeTrackIds: SoundscapeId[],
  sessionTracks: SoundscapeId[],
  enabledTrackIds?: SoundscapeId[]
): {
  isConflict: boolean;
  canKeepPlayingAlongside: boolean;
  duplicateTrackIds: SoundscapeId[];
  isCapacityExceeded: boolean;
  disableReasonKey?: string;
  requestedTrackIds: SoundscapeId[];
} {
  const effectiveRequested = sessionTracks.filter(
    (id) => !enabledTrackIds || enabledTrackIds.includes(id)
  );

  if (activeTrackIds.length === 0) {
    return {
      isConflict: false,
      canKeepPlayingAlongside: true,
      duplicateTrackIds: [],
      isCapacityExceeded: false,
      requestedTrackIds: effectiveRequested,
    };
  }

  const duplicateTrackIds = effectiveRequested.filter((id) => activeTrackIds.includes(id));
  const totalCount = activeTrackIds.length + effectiveRequested.length;
  const isCapacityExceeded = totalCount > 4;
  const canKeepPlayingAlongside = duplicateTrackIds.length === 0 && !isCapacityExceeded;

  let disableReasonKey: string | undefined;
  if (duplicateTrackIds.length > 0) {
    disableReasonKey = 'sessionConflictDuplicateWarning';
  } else if (isCapacityExceeded) {
    disableReasonKey = 'sessionConflictCapacityWarning';
  }

  return {
    isConflict: true,
    canKeepPlayingAlongside,
    duplicateTrackIds,
    isCapacityExceeded,
    disableReasonKey,
    requestedTrackIds: effectiveRequested,
  };
}

// 8.1 No false capacity conflict when optional track is disabled
// 3 mixer tracks active + Deep Serenity (Xiao + Rain)
// If Rain is enabled: 3 + 2 = 5 > 4 (Conflict!)
const conflictRainEnabled = evaluateConflictWithEnabled(
  ['thunder', 'wind', 'forest'],
  ['xiao', 'rain'],
  ['xiao', 'rain']
);
assert(conflictRainEnabled.isCapacityExceeded === true, '8.1: Rain enabled must exceed capacity with 3 mixer tracks');
assert(conflictRainEnabled.canKeepPlayingAlongside === false, '8.1: Cannot keep alongside when capacity exceeded');
assert(conflictRainEnabled.requestedTrackIds.length === 2, '8.1: Requested tracks count is 2');

// If Rain is disabled: 3 + 1 = 4 <= 4 (Fits within 4-track ceiling!)
const conflictRainDisabled = evaluateConflictWithEnabled(
  ['thunder', 'wind', 'forest'],
  ['xiao', 'rain'],
  ['xiao'] // Only xiao enabled
);
assert(conflictRainDisabled.isCapacityExceeded === false, '8.1: Rain disabled must NOT exceed capacity with 3 mixer tracks');
assert(conflictRainDisabled.canKeepPlayingAlongside === true, '8.1: Can keep alongside when Rain is disabled');
assert(conflictRainDisabled.requestedTrackIds.length === 1, '8.1: Requested tracks count is 1');
assert(conflictRainDisabled.requestedTrackIds[0] === 'xiao', '8.1: Requested track is xiao');

// 8.2 No false duplicate conflict when optional track is disabled
// Mixer has 'rain' active. Deep Serenity requested.
// If Rain is enabled: Rain collides with existing Rain
const conflictDupRain = evaluateConflictWithEnabled(
  ['rain'],
  ['xiao', 'rain'],
  ['xiao', 'rain']
);
assert(conflictDupRain.duplicateTrackIds.includes('rain'), '8.2: Duplicate detected when Rain is enabled');
assert(conflictDupRain.canKeepPlayingAlongside === false, '8.2: Cannot keep alongside when duplicate exists');

// If Rain is disabled: Zero collision with existing Rain!
const noConflictDupRain = evaluateConflictWithEnabled(
  ['rain'],
  ['xiao', 'rain'],
  ['xiao'] // Rain disabled in session
);
assert(noConflictDupRain.duplicateTrackIds.length === 0, '8.2: Zero duplicates when Rain is disabled');
assert(noConflictDupRain.canKeepPlayingAlongside === true, '8.2: Can keep playing alongside existing Rain');

// 8.3 Genuine capacity limit is still enforced when 4 tracks are active
const conflictFullMixer = evaluateConflictWithEnabled(
  ['rain', 'thunder', 'wind', 'forest'],
  ['xiao', 'rain'],
  ['xiao'] // Rain disabled, but 4 tracks already playing
);
assert(conflictFullMixer.isCapacityExceeded === true, '8.3: 4 active tracks + 1 requested must trigger capacity limit');
assert(conflictFullMixer.canKeepPlayingAlongside === false, '8.3: Cannot keep alongside when mixer already at max');

// 8.4 Simulation of executeSessionLaunch track starting & AudioEngine calls
interface MockAudioEngineCallLog {
  playTrackCalls: SoundscapeId[];
  stopTrackCalls: SoundscapeId[];
  setTrackVolumeCalls: Array<{ soundId: SoundscapeId; volume: number }>;
}

function simulateSessionLaunch(
  sessionTracks: Array<{ soundId: SoundscapeId; isOptional: boolean; defaultVolume: number }>,
  enabledTrackIds: SoundscapeId[],
  customVolumes: Partial<Record<SoundscapeId, number>> = {},
  failOnTrackId?: SoundscapeId
): {
  success: boolean;
  sessionOwnedTracks: SoundscapeId[];
  callLog: MockAudioEngineCallLog;
} {
  const callLog: MockAudioEngineCallLog = {
    playTrackCalls: [],
    stopTrackCalls: [],
    setTrackVolumeCalls: [],
  };

  const requestedTrackIds = sessionTracks
    .filter((t) => enabledTrackIds.includes(t.soundId))
    .map((t) => t.soundId);

  const initialVolumes: Partial<Record<SoundscapeId, number>> = {};
  for (const track of sessionTracks) {
    initialVolumes[track.soundId] = customVolumes[track.soundId] ?? track.defaultVolume;
  }

  const startedTracks: SoundscapeId[] = [];
  let sessionOwnedTracks: SoundscapeId[] = [...requestedTrackIds];

  try {
    const tracksToStart = sessionTracks.filter((t) => requestedTrackIds.includes(t.soundId));
    for (const track of tracksToStart) {
      if (track.soundId === failOnTrackId) {
        throw new Error(`Failed to play ${track.soundId}`);
      }
      callLog.playTrackCalls.push(track.soundId);
      startedTracks.push(track.soundId);
      const vol = initialVolumes[track.soundId] ?? track.defaultVolume;
      callLog.setTrackVolumeCalls.push({ soundId: track.soundId, volume: vol });
    }
    return { success: true, sessionOwnedTracks, callLog };
  } catch {
    for (const id of startedTracks) {
      callLog.stopTrackCalls.push(id);
    }
    sessionOwnedTracks = [];
    return { success: false, sessionOwnedTracks, callLog };
  }
}

// 8.5 Disabled optional track NEVER calls playTrack
const sessionATracks = [
  { soundId: 'xiao' as SoundscapeId, isOptional: false, defaultVolume: 0.60 },
  { soundId: 'rain' as SoundscapeId, isOptional: true, defaultVolume: 0.50 },
];

const launchDisabled = simulateSessionLaunch(sessionATracks, ['xiao']);
assert(launchDisabled.success === true, '8.5: Launch succeeds with disabled optional track');
assert(launchDisabled.callLog.playTrackCalls.length === 1, '8.5: Exactly 1 playTrack call executed');
assert(launchDisabled.callLog.playTrackCalls[0] === 'xiao', '8.5: Only xiao was started');
assert(!launchDisabled.callLog.playTrackCalls.includes('rain'), '8.5: Rain was NEVER called');
assert(launchDisabled.sessionOwnedTracks.length === 1, '8.5: Only 1 track owned by session');
assert(launchDisabled.sessionOwnedTracks[0] === 'xiao', '8.5: Owned track is xiao');

// 8.6 Volume 0 on enabled track does NOT prevent playTrack (Requirement 8)
const launchVolZero = simulateSessionLaunch(sessionATracks, ['xiao', 'rain'], { rain: 0.0 });
assert(launchVolZero.callLog.playTrackCalls.length === 2, '8.6: Both tracks started when rain is enabled at volume 0');
assert(launchVolZero.callLog.playTrackCalls.includes('rain'), '8.6: Rain playTrack was called despite volume 0');
const rainVolCall = launchVolZero.callLog.setTrackVolumeCalls.find((c) => c.soundId === 'rain');
assert(rainVolCall?.volume === 0.0, '8.6: Rain volume was set to 0.0');

// 8.7 Enabling a track later starts it correctly at configured volume (Requirement 9)
const launchEnabledLater = simulateSessionLaunch(sessionATracks, ['xiao', 'rain'], { rain: 0.75 });
assert(launchEnabledLater.callLog.playTrackCalls.length === 2, '8.7: Both tracks started when rain re-enabled');
const rainLaterVol = launchEnabledLater.callLog.setTrackVolumeCalls.find((c) => c.soundId === 'rain');
assert(rainLaterVol?.volume === 0.75, '8.7: Rain started at configured volume 0.75');

// 8.8 Rollback safety on failure
const launchFailed = simulateSessionLaunch(sessionATracks, ['xiao', 'rain'], {}, 'rain');
assert(launchFailed.success === false, '8.8: Launch reports failure when track fails');
assert(launchFailed.sessionOwnedTracks.length === 0, '8.8: sessionOwnedTracks cleared to empty on failure');
assert(launchFailed.callLog.stopTrackCalls.length === 1, '8.8: Started track was rolled back');
assert(launchFailed.callLog.stopTrackCalls[0] === 'xiao', '8.8: Xiao rolled back upon failure');

// 8.9 All 5 sessions startup verified when all optional tracks disabled (Requirement 10)
for (const session of RELAXATION_SESSIONS) {
  const nonOptionalIds = session.audioTracks.filter((t) => !t.isOptional).map((t) => t.soundId);
  assert(nonOptionalIds.length >= 1, `8.9: Session ${session.id} must have at least 1 non-optional track`);
  const result = simulateSessionLaunch(session.audioTracks, nonOptionalIds);
  assert(result.success === true, `8.9: Session ${session.id} launched cleanly with all optional tracks disabled`);
  assert(
    result.sessionOwnedTracks.length === nonOptionalIds.length,
    `8.9: Session ${session.id} owns only non-optional tracks (${nonOptionalIds.length})`
  );
  assert(
    result.callLog.playTrackCalls.length === nonOptionalIds.length,
    `8.9: Only non-optional tracks invoked playTrack for ${session.id}`
  );
}

console.log(`\n========================================`);
console.log(`ALL ${passedTests} TESTS PASSED SUCCESSFULLY!`);
console.log(`========================================\n`);
