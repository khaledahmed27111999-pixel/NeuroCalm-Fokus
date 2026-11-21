import assert from 'node:assert';
import { WISDOM_MESSAGES } from '../src/data/wisdom';
import { WisdomCategory, WisdomMessage } from '../src/types/wisdom';
import { selectRandomWisdom, getWisdomById, getDefaultWisdom } from '../src/utils/wisdom';

console.log('--- Starting Phase 1D Wisdom Library & Selection Tests ---');

// 1. Library Content & Integrity Check
{
  assert(WISDOM_MESSAGES.length >= 60, `Library must have at least 60 messages, found ${WISDOM_MESSAGES.length}`);
  console.log(`✓ Library contains ${WISDOM_MESSAGES.length} messages (>= 60 requirement satisfied)`);

  const requiredCategories: WisdomCategory[] = [
    'perseverance',
    'starting',
    'recovery',
    'rest',
    'patience',
    'small_steps',
  ];

  const seenIds = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  for (const msg of WISDOM_MESSAGES) {
    // Unique ID
    assert(!seenIds.has(msg.id), `Duplicate message id found: ${msg.id}`);
    seenIds.add(msg.id);

    // Valid Category
    assert(requiredCategories.includes(msg.category), `Invalid category on message ${msg.id}: ${msg.category}`);
    categoryCounts[msg.category] = (categoryCounts[msg.category] || 0) + 1;

    // Bilingual text integrity
    assert(typeof msg.text.ar === 'string' && msg.text.ar.trim().length > 0, `Missing Arabic text in ${msg.id}`);
    assert(typeof msg.text.en === 'string' && msg.text.en.trim().length > 0, `Missing English text in ${msg.id}`);

    // Optional Author integrity if present
    if (msg.author) {
      assert(typeof msg.author.ar === 'string' && msg.author.ar.trim().length > 0, `Invalid author.ar in ${msg.id}`);
      assert(typeof msg.author.en === 'string' && msg.author.en.trim().length > 0, `Invalid author.en in ${msg.id}`);
    }
  }

  for (const cat of requiredCategories) {
    assert(categoryCounts[cat] > 0, `Category ${cat} must have at least one message`);
    console.log(`  - Category [${cat}]: ${categoryCounts[cat]} messages`);
  }
  console.log('✓ All categories, IDs, and bilingual texts validated successfully');
}

// 2. Selection & Repetition Avoidance
{
  // Running 100 consecutive random selections to guarantee never picking the same message consecutively
  let current = selectRandomWisdom(WISDOM_MESSAGES);
  for (let i = 0; i < 100; i++) {
    const next = selectRandomWisdom(WISDOM_MESSAGES, current.id);
    assert.notStrictEqual(next.id, current.id, `Consecutive repetition detected at iteration ${i}: ${next.id}`);
    current = next;
  }
  console.log('✓ 100 consecutive random selections executed: zero consecutive duplicates');

  // Small-library edge case: 1 message
  const singleLib: WisdomMessage[] = [WISDOM_MESSAGES[0]];
  const singleResult = selectRandomWisdom(singleLib, singleLib[0].id);
  assert.strictEqual(singleResult.id, singleLib[0].id, 'Single-message library must safely return its only item');
  console.log('✓ Single-message library edge case passed');

  // Small-library edge case: 2 messages must strictly alternate
  const dualLib: WisdomMessage[] = [WISDOM_MESSAGES[0], WISDOM_MESSAGES[1]];
  const alt1 = selectRandomWisdom(dualLib, dualLib[0].id);
  assert.strictEqual(alt1.id, dualLib[1].id, 'Two-message library must alternate to second item');
  const alt2 = selectRandomWisdom(dualLib, dualLib[1].id);
  assert.strictEqual(alt2.id, dualLib[0].id, 'Two-message library must alternate back to first item');
  console.log('✓ Two-message library strict alternation passed');
}

// 3. Helpers: getWisdomById & getDefaultWisdom
{
  const first = getDefaultWisdom(WISDOM_MESSAGES);
  assert.strictEqual(first.id, WISDOM_MESSAGES[0].id);

  const found = getWisdomById(WISDOM_MESSAGES, 'perseverance-01');
  assert(found !== undefined);
  assert.strictEqual(found?.id, 'perseverance-01');

  const notFound = getWisdomById(WISDOM_MESSAGES, 'non-existent-id');
  assert.strictEqual(notFound, undefined);
  console.log('✓ Helper retrieval functions verified');
}

console.log('ALL PHASE 1D UNIT TESTS PASSED!');
