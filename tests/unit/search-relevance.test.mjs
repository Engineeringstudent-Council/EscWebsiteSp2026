// Golden relevance tests against the real, committed search index.
// Each query lists the URL a visitor almost certainly wants and how high it
// must rank. If a content or tuning change breaks one of these, the search
// got worse for real people; fix the ranking (or data/search/*.json) rather
// than loosening the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Fuse from '../../assets/js/vendor/fuse.esm.min.js';
import { createSearcher } from '../../assets/js/search/core.js';

const { records } = JSON.parse(
  readFileSync(new URL('../../assets/search/index.json', import.meta.url)),
);
const searcher = createSearcher(Fuse, records);

/** [query, expected URL (prefix match), must appear within top N] */
const GOLDEN = [
  ['funding', 'applyfunding.html', 1],
  ['fnding', 'applyfunding.html', 1],
  ['fundng for clubs', 'applyfunding.html', 3],
  ['money for my club', 'applyfunding.html', 1],
  ['blue gold', 'blueandgold.html', 1],
  ['blue and gold', 'blueandgold.html', 1],
  ['b&g', 'blueandgold.html', 1],
  ['blue gold portal', 'https://sites.google.com/berkeley.edu/blue-and-gold-portal', 2],
  ['mental health', 'hear.html', 1],
  ['hear tool', 'hear.html', 1],
  ['eweek', 'eweek_overview.html', 2],
  ['e-week', 'eweek_overview.html', 1],
  ['engineers week', 'eweek_overview.html', 1],
  ['free food', 'food.html', 1],
  ['calfresh', 'food.html', 3],
  ['housing', 'housing.html', 1],
  ['apartment', 'housing.html', 3],
  ['makerspace', 'makerspaces.html', 1],
  ['laser cutter', 'makerspaces.html', 2],
  ['decal', 'engin_decals.html', 1],
  ['exec board', 'execs.html', 1],
  ['committees', 'execs.html', 1],
  ['treasurer training', 'treasurertrain.html', 1],
  ['tutoring', 'academics.html', 1],
  ['start a club', 'howtoguide.html', 1],
  ['certified clubs', 'clubs.html', 2],
  ['faq', 'faqs.html', 1],
  ['period products', 'fmpi.html', 1],
  ['harassment', 'https://ophd.berkeley.edu/report', 1],
  ['contact', 'mailto:president@esc.studentorg.berkeley.edu', 1],
  ['join', 'https://forms.gle/', 2],
  ['instagram', 'https://www.instagram.com/berkeleyesc', 1],
  ['ficomm', 'ficomm.html', 1],
  ['sponsors', 'sponsors.html', 1],
  ['startups', 'startups.html', 1],
  ['upcoming events', 'events.html', 1],
  ['past events', 'past-events.html', 1],
];

for (const [query, expected, within] of GOLDEN) {
  test(`"${query}" finds ${expected} in the top ${within}`, () => {
    const urls = searcher.search(query, 8).map((r) => r.url);
    const rank = urls.findIndex((url) => url.startsWith(expected));
    assert.ok(rank !== -1 && rank < within, `got: ${urls.slice(0, 5).join(', ') || '(nothing)'}`);
  });
}

test('gibberish returns nothing rather than random pages', () => {
  for (const query of ['zzqxv', 'qwrtplk', 'xxxxxxxxxx']) {
    assert.deepEqual(searcher.search(query), [], query);
  }
});

test('every query returns at most the requested number of results', () => {
  for (const [query] of GOLDEN) assert.ok(searcher.search(query, 5).length <= 5);
});
