// The "Can we buy this?" box on ficomm.html. It must flag the purchases
// treasurers see rejected most often, avoid false alarms on ordinary
// engineering supplies, and stay in sync with the official list on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../../scripts/site-pages.mjs';
import {
  OFFICIAL_COUNT,
  RULES,
  checkPurchase,
  normalize,
} from '../../assets/js/site/ficomm-rules.js';

const ids = (query) => checkPurchase(query).matches.map((rule) => rule.id);

test('empty or one-letter queries ask for nothing', () => {
  for (const query of ['', ' ', 'a', null, undefined]) {
    assert.deepEqual(checkPurchase(query), { status: 'empty', matches: [] });
  }
});

test('common rejected purchases are flagged as restricted', () => {
  const cases = [
    ['Pizza for our info session', 'food'],
    ['boba for general meeting', 'food'],
    ['Bottled water for the hackathon', 'food'],
    ['catering', 'food'],
    ['IM soccer team registration (intramurals)', 'intramurals'],
    ['flights to nationals', 'travel'],
    ['Hotel rooms in Los Angeles', 'travel'],
    ['Airbnb for the competition', 'travel'],
    ['raffle prizes', 'prizes'],
    ['$25 gift cards for speakers', 'prizes'],
    ['beer', 'alcohol'],
    ['Officer retreat cabin', 'retreats'],
    ['balloons for the booth', 'latex'],
    ['styrofoam cups', 'styrofoam'],
    ['event insurance', 'insurance'],
    ['bowling night in Oakland', 'off-campus'],
  ];
  for (const [query, id] of cases) {
    const result = checkPurchase(query);
    assert.equal(result.status, 'restricted', query);
    assert.ok(ids(query).includes(id), `${query} → ${id}, got ${ids(query)}`);
  }
});

test('flyers and stationery are allowed with conditions, not banned', () => {
  for (const query of ['Posters for our hackathon', 'flyers', 'business cards']) {
    assert.equal(checkPurchase(query).status, 'conditional', query);
  }
});

test('a banned item outranks a conditional one in the same query', () => {
  const result = checkPurchase('pizza and posters');
  assert.equal(result.status, 'restricted');
  assert.deepEqual(ids('pizza and posters').sort(), ['flyers', 'food']);
});

test('ordinary engineering supplies are not false alarms', () => {
  const clear = [
    'Aluminum stock for the chassis',
    'Arduino boards and sensors',
    '3D printing filament',
    'Soldering iron',
    'Lab safety goggles',
    'Water pump for the rover',
    'Microchips',
    'Wheelchair accessible venue on campus',
    'Gas springs for the suspension',
    'Social media management software',
  ];
  for (const query of clear) {
    assert.equal(checkPurchase(query).status, 'clear', `${query} matched ${ids(query)}`);
  }
});

test('matching is whole-word, case-insensitive, and plural-tolerant', () => {
  assert.ok(ids('PIZZAS').includes('food'));
  assert.ok(ids('Gift Cards').includes('prizes'));
  assert.ok(ids('parties? no — just donuts').includes('food'));
  // "ad" is not a trigger, so words containing it are safe.
  assert.equal(checkPurchase('adhesive and adapters').status, 'clear');
  // "tea" must not fire inside "team" or "steam".
  assert.equal(checkPurchase('team jerseys, steam cleaner').status, 'clear');
});

test('normalize strips accents, apostrophes, and punctuation', () => {
  assert.equal(normalize('  Café’s   BOBA!! '), 'cafes boba');
  assert.equal(normalize("Trader Joe's"), 'trader joes');
  assert.equal(normalize('off-campus'), 'off-campus');
});

test('rules are well-formed: unique ids, lower-case triggers, real rule numbers', () => {
  const seen = new Set();
  for (const rule of RULES) {
    assert.ok(!seen.has(rule.id), `duplicate id ${rule.id}`);
    seen.add(rule.id);
    assert.ok(['banned', 'conditional'].includes(rule.kind), rule.id);
    assert.ok(rule.title && rule.fix, rule.id);
    assert.ok(rule.words.length > 0, rule.id);
    for (const word of rule.words) {
      assert.equal(
        normalize(word),
        word.replace(/[’']/g, ''),
        `${rule.id}: "${word}" is not normalized`,
      );
    }
    for (const n of rule.official) {
      assert.ok(Number.isInteger(n) && n >= 1 && n <= OFFICIAL_COUNT, `${rule.id}: #${n}`);
    }
  }
});

test('ficomm.html lists exactly the official rules the checker cites', async () => {
  const html = await readFile(join(ROOT, 'ficomm.html'), 'utf8');
  const onPage = [...html.matchAll(/data-rule="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(
    onPage,
    Array.from({ length: OFFICIAL_COUNT }, (_, i) => i + 1),
    'the official list on ficomm.html should be items 1..14 in order',
  );
  assert.match(html, new RegExp(`full ASUC list \\(${OFFICIAL_COUNT} items\\)`));
  for (const rule of RULES) {
    for (const n of rule.official) assert.ok(onPage.includes(n), `${rule.id} cites #${n}`);
  }
});
