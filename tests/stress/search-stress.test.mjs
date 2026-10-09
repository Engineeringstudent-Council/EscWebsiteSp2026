// Stress and fuzz tests for the search core. Run with `npm run test:stress`.
// Deterministic (seeded) so a failure always reproduces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Fuse from '../../assets/js/vendor/fuse.esm.min.js';
import {
  createSearcher,
  highlight,
  isSafeUrl,
  MAX_QUERY_LENGTH,
} from '../../assets/js/search/core.js';

const { records } = JSON.parse(
  readFileSync(new URL('../../assets/search/index.json', import.meta.url)),
);

/** Mulberry32: tiny seeded PRNG. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABETS = [
  'abcdefghijklmnopqrstuvwxyz     ',
  '.*+?^${}()|[]\\/-&<>"\'`',
  'éüñçøåß食物🐻💛🔵​‮\u0000\u0007﻿',
  '0123456789',
];

function randomQuery(next) {
  const length = Math.floor(next() * 40);
  let out = '';
  for (let i = 0; i < length; i++) {
    const alphabet = ALPHABETS[Math.floor(next() * ALPHABETS.length)];
    out += [...alphabet][Math.floor(next() * [...alphabet].length)];
  }
  return out;
}

function assertWellFormed(results, limit) {
  assert.ok(Array.isArray(results));
  assert.ok(results.length <= limit);
  const urls = new Set();
  for (const r of results) {
    assert.equal(typeof r.title, 'string');
    assert.ok(isSafeUrl(r.url), r.url);
    assert.ok(!urls.has(r.url), `duplicate ${r.url}`);
    urls.add(r.url);
    assert.ok(Number.isFinite(r.score));
    assert.equal(r.titleParts.map((p) => p.text).join(''), r.title);
  }
}

test('5,000 random queries (unicode, regex metacharacters, control chars) never throw', () => {
  const searcher = createSearcher(Fuse, records);
  const next = rng(20261008);
  for (let i = 0; i < 5000; i++) {
    const query = randomQuery(next);
    assertWellFormed(searcher.search(query, 8), 8);
  }
});

test('pathological queries are handled', () => {
  const searcher = createSearcher(Fuse, records);
  const cases = [
    'a'.repeat(10_000),
    'food '.repeat(2_000),
    '((((((((((',
    '\\'.repeat(100),
    '%00%0d%0a',
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    ' '.repeat(1000),
    '🐻'.repeat(500),
    'null',
    'undefined',
    '__proto__',
    'constructor',
  ];
  for (const query of cases) assertWellFormed(searcher.search(query, 8), 8);
  // Long queries are capped before they reach Fuse.
  const started = performance.now();
  searcher.search('x'.repeat(100_000));
  assert.ok(performance.now() - started < 200);
  assert.ok(MAX_QUERY_LENGTH <= 128);
});

test('hostile records cannot inject markup or unsafe links', () => {
  const searcher = createSearcher(Fuse, [
    { title: '<img src=x onerror=alert(1)> Funding', url: 'a.html', kind: 'page' },
    { title: 'Click me', url: 'javascript:alert(1)', kind: 'link' },
    { title: 'Data', url: 'data:text/html,<script>x</script>', kind: 'link' },
    { title: 'Proto', url: '//evil.example', kind: 'link' },
    { title: { toString: () => 'object title' }, url: 'b.html' },
  ]);
  const results = searcher.search('funding');
  assert.equal(results.length, 1);
  assert.equal(results[0].title, '<img src=x onerror=alert(1)> Funding');
  // Rendering uses textContent on these parts, so the tag stays inert text.
  assert.ok(highlight(results[0].title, ['funding']).some((p) => p.text.includes('<img')));
  assert.deepEqual(searcher.search('click'), []);
  assert.deepEqual(searcher.search('data'), []);
  assert.deepEqual(searcher.search('proto'), []);
});

function syntheticRecords(count, next) {
  const words =
    'engineering funding club food housing blue gold maker laser decal exec week student council pantry tutoring research startup design robotics'.split(
      ' ',
    );
  const pick = () => words[Math.floor(next() * words.length)];
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    kind: i % 3 === 0 ? 'section' : 'page',
    url: `page-${i}.html`,
    title: `${pick()} ${pick()} ${i}`,
    trail: [pick(), pick()],
    description: Array.from({ length: 20 }, pick).join(' '),
    keywords: Array.from({ length: 6 }, pick).join(' '),
    text: Array.from({ length: 150 }, pick).join(' '),
  }));
}

test('10,000-record index: builds quickly and answers within the latency budget', () => {
  const next = rng(42);
  const big = syntheticRecords(10_000, next);
  const buildStart = performance.now();
  const searcher = createSearcher(Fuse, big);
  const buildMs = performance.now() - buildStart;

  const queries = [
    'funding',
    'fnding',
    'blue gold',
    'robotics design',
    'pantry',
    'zzqx',
    'student council week',
    'lsaer',
  ];
  const timings = [];
  for (let round = 0; round < 3; round++) {
    for (const q of queries) {
      const started = performance.now();
      assertWellFormed(searcher.search(q, 8), 8);
      timings.push(performance.now() - started);
    }
  }
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.floor(timings.length * 0.95) - 1];
  // The real index has ~150 records; 10k is ~70x headroom. Budgets are
  // generous so slow CI machines don't flake, but catch accidental O(n^2).
  console.log(
    `  build ${buildMs.toFixed(0)} ms, p95 query ${p95.toFixed(0)} ms over ${timings.length} queries`,
  );
  assert.ok(buildMs < 3000, `build took ${buildMs} ms`);
  assert.ok(p95 < 1500, `p95 query took ${p95} ms`);
});

test('real index: p95 latency well under one animation frame', () => {
  const searcher = createSearcher(Fuse, records);
  const next = rng(7);
  const timings = [];
  for (let i = 0; i < 500; i++) {
    const q = randomQuery(next).slice(0, 12) || 'food';
    const started = performance.now();
    searcher.search(q, 8);
    timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.floor(timings.length * 0.95)];
  console.log(`  real index p95 ${p95.toFixed(2)} ms`);
  assert.ok(p95 < 16, `p95 ${p95} ms`);
});
