/**
 * NeuroCalm & Fokus — Phase 2D-3E Sound Benefits Knowledge Layer Test Suite
 * Validates coverage of all 17 sound modalities, 3-tier categorization, bilingual integrity,
 * localization dictionaries, and non-medical wellness phrasing.
 */

import {
  SOUND_BENEFITS_DATA,
  getSoundBenefits,
  BenefitTier,
} from '../src/data/soundBenefits';
import { en } from '../src/locales/en';
import { ar } from '../src/locales/ar';
import { SoundscapeId } from '../src/types/audio';

let passedTests = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    throw new Error(`TEST FAILED: ${msg}`);
  }
  passedTests++;
}

console.log('--- Phase 2D-3E: Sound Benefits Knowledge Layer Tests ---');

// List of all 17 evidence-based modalities currently in NeuroCalm & Fokus
const SCIENTIFIC_MODALITIES: SoundscapeId[] = [
  // Nature (3)
  'rain',
  'stream',
  'ocean_waves',
  // Environment (2)
  'fan',
  'fireplace',
  // Colored Noise (4)
  'white_noise',
  'pink_noise',
  'brown_noise',
  'violet_noise',
  // Brainwave & Tonal (8)
  'binaural_delta',
  'binaural_theta',
  'binaural_alpha',
  'binaural_beta',
  'binaural_gamma',
  'monaural_alpha',
  'isochronic_alpha',
  'isochronic_theta',
];

// List of all 4 traditional Chinese instrumental modalities (qualitative info)
const INSTRUMENTAL_MODALITIES: SoundscapeId[] = [
  'xiao',
  'dizi',
  'guqin',
  'guzheng',
];

const ALL_MODALITIES: SoundscapeId[] = [
  ...SCIENTIFIC_MODALITIES,
  ...INSTRUMENTAL_MODALITIES,
];

// Test 1: Exactly 21 modalities exist in the SOUND_BENEFITS_DATA registry
console.log('\n[Group 1: Modality Registry Completeness]');
for (const id of ALL_MODALITIES) {
  const entry = SOUND_BENEFITS_DATA[id];
  assert(Boolean(entry), `Modality ${id} must exist in SOUND_BENEFITS_DATA`);
  assert(entry?.soundId === id, `Modality entry soundId must match key: ${id}`);
}
assert(
  Object.keys(SOUND_BENEFITS_DATA).length === 21,
  `SOUND_BENEFITS_DATA must contain exactly 21 entries (found ${Object.keys(SOUND_BENEFITS_DATA).length})`
);
console.log(`✓ All 21 modalities registered (17 scientific + 4 qualitative instrumental).`);

// Test 2: Category tiers strictly enforced (Scientific vs Qualitative separation)
console.log('\n[Group 2: Strict Categorization (Scientific Evidence vs Qualitative Music)]');
const ALLOWED_SCIENTIFIC_KEYS: Set<string> = new Set(['supported', 'promising', 'potential', 'soundId']);
const ALLOWED_INSTRUMENTAL_KEYS: Set<string> = new Set(['soundCharacter', 'listeningExperience', 'suitableContexts', 'soundId']);

for (const id of SCIENTIFIC_MODALITIES) {
  const entry = SOUND_BENEFITS_DATA[id]!;
  const keys = Object.keys(entry);
  for (const k of keys) {
    assert(
      ALLOWED_SCIENTIFIC_KEYS.has(k),
      `Scientific modality ${id} contains unexpected key: ${k}`
    );
  }
  const tierCount =
    (entry.supported?.length || 0) +
    (entry.promising?.length || 0) +
    (entry.potential?.length || 0);
  assert(tierCount > 0, `Modality ${id} must have at least one scientific benefit tier populated`);
}

for (const id of INSTRUMENTAL_MODALITIES) {
  const entry = SOUND_BENEFITS_DATA[id]!;
  assert(entry.supported === undefined, `Instrument ${id} must NOT have scientific 'supported' tier`);
  assert(entry.promising === undefined, `Instrument ${id} must NOT have scientific 'promising' tier`);
  assert(entry.potential === undefined, `Instrument ${id} must NOT have scientific 'potential' tier`);

  const keys = Object.keys(entry);
  for (const k of keys) {
    assert(
      ALLOWED_INSTRUMENTAL_KEYS.has(k),
      `Instrument ${id} contains unexpected key: ${k}`
    );
  }
  assert((entry.soundCharacter?.length || 0) > 0, `Instrument ${id} must have soundCharacter populated`);
  assert((entry.listeningExperience?.length || 0) > 0, `Instrument ${id} must have listeningExperience populated`);
  assert((entry.suitableContexts?.length || 0) > 0, `Instrument ${id} must have suitableContexts populated`);
}
console.log(`✓ Scientific evidence and qualitative instrumental categories strictly segregated.`);

// Test 3: Bilingual Data Content Integrity (EN & AR non-empty, Arabic script check)
console.log('\n[Group 3: Bilingual Content & RTL Text Quality]');
const ARABIC_UNICODE_REGEX = /[\u0600-\u06FF\u0750-\u077F]/;

for (const id of ALL_MODALITIES) {
  const entry = SOUND_BENEFITS_DATA[id]!;
  const tiers: (keyof typeof entry)[] = [
    'supported', 'promising', 'potential',
    'soundCharacter', 'listeningExperience', 'suitableContexts'
  ];

  for (const tier of tiers) {
    const items = entry[tier];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        assert(typeof item.id === 'string' && item.id.length > 0, `${id}.${tier} item must have an id`);
        assert(
          typeof item.en === 'string' && item.en.trim().length >= 15,
          `${id}.${tier} item ${item.id} English description too short: "${item.en}"`
        );
        assert(
          typeof item.ar === 'string' && item.ar.trim().length >= 10,
          `${id}.${tier} item ${item.id} Arabic description too short: "${item.ar}"`
        );
        assert(
          ARABIC_UNICODE_REGEX.test(item.ar),
          `${id}.${tier} item ${item.id} Arabic description must contain authentic Arabic characters`
        );
      }
    }
  }
}
console.log(`✓ English and Arabic texts verified for completeness and proper script formatting.`);

// Test 4: Localization dictionary keys in en.ts and ar.ts
console.log('\n[Group 4: Localization Key Parity in en.ts & ar.ts]');
const REQUIRED_BENEFIT_KEYS = [
  'benefitsTitle',
  'benefitsSupported',
  'benefitsSupportedDesc',
  'benefitsPromising',
  'benefitsPromisingDesc',
  'benefitsPotential',
  'benefitsPotentialDesc',
  'benefitsToggleOpen',
  'benefitsToggleClose',
  'benefitsDisclaimer',
  'instrumentalSoundCharacter',
  'instrumentalListeningExperience',
  'instrumentalSuitableContexts',
  'instrumentalToggleOpen',
  'instrumentalToggleClose',
  'instrumentalDisclaimer',
] as const;

for (const key of REQUIRED_BENEFIT_KEYS) {
  assert(
    typeof (en as any)[key] === 'string' && (en as any)[key].length > 0,
    `English locale must include key "${key}"`
  );
  assert(
    typeof (ar as any)[key] === 'string' && (ar as any)[key].length > 0,
    `Arabic locale must include key "${key}"`
  );
  assert(
    ARABIC_UNICODE_REGEX.test((ar as any)[key]),
    `Arabic locale key "${key}" must contain authentic Arabic characters`
  );
}
console.log(`✓ All 10 benefit localization keys verified in both en.ts and ar.ts.`);

// Test 5: getSoundBenefits lookup function correctness
console.log('\n[Group 5: getSoundBenefits Helper Function]');
for (const id of ALL_MODALITIES) {
  const result = getSoundBenefits(id);
  assert(result !== null, `getSoundBenefits('${id}') must return valid entry`);
  assert(result?.soundId === id, `Returned entry soundId must match request`);
}

// Unregistered or unknown IDs must return null gracefully
// @ts-expect-error test unknown ID
const unknownResult = getSoundBenefits('unknown_sound_id');
assert(unknownResult === null, `getSoundBenefits must return null for nonexistent sound IDs`);

// Catalog items not yet acquired (e.g. cafe, thunder) return null gracefully
// @ts-expect-error test unacquired ID
const unacquiredResult = getSoundBenefits('cafe');
assert(unacquiredResult === null, `getSoundBenefits must return null for unacquired sound IDs`);
console.log(`✓ getSoundBenefits function behaves correctly for known and unknown IDs.`);

// Test 6: Non-medical language compliance (Safety & Ethics)
console.log('\n[Group 6: Non-Medical & Wellness Language Compliance]');
const FORBIDDEN_MEDICAL_WORDS = [
  'cure',
  'cures',
  'curing',
  'heal disease',
  'treat disease',
  'medical treatment',
  'clinical diagnosis',
  'fda approved',
  'prescription',
];

for (const id of ALL_MODALITIES) {
  const entry = SOUND_BENEFITS_DATA[id]!;
  const tiers: (keyof typeof entry)[] = [
    'supported', 'promising', 'potential',
    'soundCharacter', 'listeningExperience', 'suitableContexts'
  ];
  for (const tier of tiers) {
    const items = entry[tier];
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const lowerEn = item.en.toLowerCase();
        for (const badWord of FORBIDDEN_MEDICAL_WORDS) {
          assert(
            !lowerEn.includes(badWord),
            `Violation: "${badWord}" found in modality ${id} (${tier}): "${item.en}"`
          );
        }
      }
    }
  }
}
console.log(`✓ Non-medical compliance verified. All benefits framed as wellness/focus/relaxation.`);

// Test 7: Specific Modality Tier Inclusions / Omissions
console.log('\n[Group 7: Specific Nuance Checks (Tier Selectivity & Instrumental Qualitative Isolation)]');
// Instrumental modalities strictly omit scientific tiers
for (const instId of INSTRUMENTAL_MODALITIES) {
  const instEntry = getSoundBenefits(instId)!;
  assert(instEntry.supported === undefined, `${instId} must omit supported tier`);
  assert(instEntry.promising === undefined, `${instId} must omit promising tier`);
  assert(instEntry.potential === undefined, `${instId} must omit potential tier`);
  assert((instEntry.soundCharacter?.length || 0) > 0, `${instId} must have soundCharacter`);
  assert((instEntry.listeningExperience?.length || 0) > 0, `${instId} must have listeningExperience`);
  assert((instEntry.suitableContexts?.length || 0) > 0, `${instId} must have suitableContexts`);
}

// Fireplace has no 'supported' clinical evidence, only promising/potential
const fireplaceEntry = getSoundBenefits('fireplace')!;
assert(
  fireplaceEntry.supported === undefined || fireplaceEntry.supported.length === 0,
  'Fireplace should omit "supported" tier as clinical literature is informal'
);
assert(
  (fireplaceEntry.promising?.length || 0) > 0,
  'Fireplace should include promising relaxation tier'
);

// Violet noise has no 'supported' clinical tier
const violetEntry = getSoundBenefits('violet_noise')!;
assert(
  violetEntry.supported === undefined || violetEntry.supported.length === 0,
  'Violet noise should omit "supported" tier'
);
assert(
  (violetEntry.potential?.length || 0) > 0,
  'Violet noise should include potential sensory tier'
);

// Rain, Ocean, White noise, Pink noise, and Binaural Alpha must have supported tier
assert((getSoundBenefits('rain')!.supported?.length || 0) > 0, 'Rain must have supported benefits');
assert((getSoundBenefits('ocean_waves')!.supported?.length || 0) > 0, 'Ocean Waves must have supported benefits');
assert((getSoundBenefits('white_noise')!.supported?.length || 0) > 0, 'White Noise must have supported benefits');
assert((getSoundBenefits('pink_noise')!.supported?.length || 0) > 0, 'Pink Noise must have supported benefits');
assert((getSoundBenefits('binaural_alpha')!.supported?.length || 0) > 0, 'Binaural Alpha must have supported benefits');
console.log(`✓ Specific tier selectivity and evidence fidelity validated.`);

console.log(`\n======================================================`);
console.log(`ALL SOUND BENEFITS TESTS PASSED: ${passedTests} assertions.`);
console.log(`======================================================\n`);
