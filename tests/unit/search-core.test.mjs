import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fuse from '../../assets/js/vendor/fuse.esm.min.js';
import {
  MAX_QUERY_LENGTH,
  createSearcher,
  fold,
  highlight,
  isSafeUrl,
  normalizeQuery,
  prepareRecords,
  queryTerms,
  rankResults,
  resolveUrl,
  snippet,
} from '../../assets/js/search/core.js';

const ROOT = 'https://esc.studentorg.berkeley.edu/';

test('fold lowercases and strips accents', () => {
  assert.equal(fold('Café ÉCOLE'), 'cafe ecole');
  assert.equal(fold(null), '');
});

test('normalizeQuery trims, collapses, caps, and strips control chars', () => {
  assert.equal(normalizeQuery('  free \n\t food  '), 'free food');
  assert.equal(normalizeQuery('a'), '');
  assert.equal(normalizeQuery(''), '');
  assert.equal(normalizeQuery(undefined), '');
  assert.equal(normalizeQuery('\u0000\u0007ab'), 'ab');
  assert.equal(normalizeQuery('x'.repeat(500)).length, MAX_QUERY_LENGTH);
  // A single non-ASCII character (e.g. CJK) can be a meaningful query.
  assert.equal(normalizeQuery('食'), '食');
});

test('queryTerms are unique, folded, at least two chars, longest first', () => {
  assert.deepEqual(queryTerms('Food food a Café B&G'), ['food', 'cafe', 'b&g']);
  assert.deepEqual(queryTerms('   '), []);
});

test('isSafeUrl allows http(s), mailto, and relative paths only', () => {
  for (const url of [
    'hear.html',
    'a/b.html#:~:text=x',
    'https://x.org',
    'http://x.org',
    'mailto:a@b.co',
  ]) {
    assert.ok(isSafeUrl(url), url);
  }
  for (const url of [
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,x',
    'vbscript:x',
    '//evil.com',
    '',
    null,
    42,
  ]) {
    assert.ok(!isSafeUrl(url), String(url));
  }
});

test('resolveUrl resolves relative paths against the site root', () => {
  assert.equal(resolveUrl('hear.html', ROOT), `${ROOT}hear.html`);
  assert.equal(resolveUrl('mailto:a@b.co', ROOT), 'mailto:a@b.co');
  assert.equal(resolveUrl('javascript:alert(1)', ROOT), null);
});

test('highlight marks every term occurrence and merges overlaps', () => {
  assert.deepEqual(highlight('Free food, FOOD!', ['food']), [
    { text: 'Free ', mark: false },
    { text: 'food', mark: true },
    { text: ', ', mark: false },
    { text: 'FOOD', mark: true },
    { text: '!', mark: false },
  ]);
  assert.deepEqual(highlight('engineering', ['engine', 'gin']), [
    { text: 'engine', mark: true },
    { text: 'ering', mark: false },
  ]);
  assert.deepEqual(highlight('Café', ['cafe']), [{ text: 'Café', mark: true }]);
  assert.deepEqual(highlight('', ['x']), []);
  assert.deepEqual(highlight('abc', []), [{ text: 'abc', mark: false }]);
});

test('highlight never interprets markup: it only splits text', () => {
  const evil = '<img src=x onerror=alert(1)> food';
  const parts = highlight(evil, ['food']);
  assert.equal(parts.map((p) => p.text).join(''), evil);
  assert.ok(parts.every((p) => typeof p.text === 'string' && typeof p.mark === 'boolean'));
});

test('snippet centres on the first match and adds ellipses', () => {
  const text = `${'lorem ipsum '.repeat(30)}the food pantry is open daily ${'dolor sit '.repeat(30)}`;
  const out = snippet(text, ['pantry'], 80);
  assert.match(out, /pantry/);
  assert.ok(out.startsWith('…') && out.endsWith('…'));
  assert.ok(out.length <= 84);
  assert.equal(snippet('short text', ['x']), 'short text');
  assert.ok(snippet('word '.repeat(100), ['nomatch'], 50).endsWith('…'));
});

test('prepareRecords drops malformed and unsafe records', () => {
  const records = prepareRecords([
    { title: 'Good', url: 'a.html' },
    { title: 'Evil', url: 'javascript:alert(1)' },
    { title: '', url: 'b.html' },
    null,
    { url: 'c.html' },
    { title: 'Trail', url: 'd.html', trail: ['A', 7, 'B'] },
  ]);
  assert.deepEqual(
    records.map((r) => r.title),
    ['Good', 'Trail'],
  );
  assert.deepEqual(records[1].trail, ['A', 'B']);
  assert.equal(records[1].trailText, 'A 7 B');
  assert.deepEqual(prepareRecords('nope'), []);
});

function item(over) {
  return {
    id: over.url,
    kind: 'page',
    title: 'x',
    url: 'x.html',
    trail: [],
    text: '',
    description: '',
    keywords: '',
    ...over,
  };
}

test('rankResults caps sections per page and dedupes URLs', () => {
  const results = [
    { item: item({ kind: 'section', url: 'a.html#1', title: 's1' }), score: 0.01 },
    { item: item({ kind: 'section', url: 'a.html#2', title: 's2' }), score: 0.02 },
    { item: item({ kind: 'section', url: 'a.html#3', title: 's3' }), score: 0.03 },
    { item: item({ url: 'b.html', title: 'b' }), score: 0.04 },
    { item: item({ url: 'b.html', title: 'b again' }), score: 0.05 },
  ];
  assert.deepEqual(
    rankResults(results, 'zz').map((r) => r.url),
    ['a.html#1', 'a.html#2', 'b.html'],
  );
});

test('rankResults prefers exact title matches and boosted records', () => {
  const results = [
    { item: item({ url: 'a.html', title: 'Funding databases' }), score: 0.1 },
    { item: item({ url: 'b.html', title: 'Funding' }), score: 0.12 },
    { item: item({ url: 'c.html', title: 'Other', boost: 3 }), score: 0.12 },
  ];
  assert.deepEqual(
    rankResults(results, 'funding').map((r) => r.url),
    ['b.html', 'c.html', 'a.html'],
  );
});

test('rankResults keeps the top three but drops weak matches after that', () => {
  const results = [0.1, 0.7, 0.8, 0.9, 0.95].map((score, i) => ({
    item: item({ url: `${i}.html`, title: `t${i}` }),
    score,
  }));
  assert.equal(rankResults(results, 'zz').length, 3);
});

test('results flag external and mailto links and drop redundant trail entries', () => {
  const [mail] = rankResults(
    [{ item: item({ url: 'mailto:a@b.co', kind: 'link', title: 'Email' }), score: 0 }],
    'em',
  );
  assert.ok(mail.external && mail.mail);
  const [page] = rankResults(
    [{ item: item({ title: 'About Us', trail: ['About Us', 'Team'] }), score: 0 }],
    'ab',
  );
  assert.deepEqual(page.trail, ['Team']);
});

test('createSearcher searches end to end and handles empty input', () => {
  const searcher = createSearcher(Fuse, [
    {
      title: 'Apply for Funding',
      url: 'applyfunding.html',
      kind: 'page',
      keywords: 'money grant',
      featured: true,
    },
    { title: 'Food Security', url: 'food.html', kind: 'page', keywords: 'pantry' },
    { title: 'Makerspaces', url: 'makerspaces.html', kind: 'page', keywords: 'laser' },
  ]);
  assert.equal(searcher.size, 3);
  assert.deepEqual(
    searcher.featured.map((r) => r.url),
    ['applyfunding.html'],
  );
  assert.equal(searcher.search('fnding')[0].url, 'applyfunding.html');
  assert.equal(searcher.search('pantry')[0].url, 'food.html');
  assert.deepEqual(searcher.search(''), []);
  assert.deepEqual(searcher.search(' '), []);
  assert.ok(searcher.search('food', 1).length <= 1);
});

test('createSearcher falls back to token search for natural phrasing', () => {
  const searcher = createSearcher(Fuse, [
    { title: 'Apply for Funding', url: 'f.html', kind: 'page', keywords: 'money clubs' },
    { title: 'Housing Help', url: 'h.html', kind: 'page' },
  ]);
  assert.equal(searcher.search('money for my club')[0]?.url, 'f.html');
});
