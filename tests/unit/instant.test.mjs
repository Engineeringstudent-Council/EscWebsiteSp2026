import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCLUDED_SELECTOR,
  isPrefetchable,
  prefersLessData,
  speculationRules,
} from '../../assets/js/site/instant.js';

const location = {
  href: 'https://esc.studentorg.berkeley.edu/students.html',
  origin: 'https://esc.studentorg.berkeley.edu',
  pathname: '/students.html',
  search: '',
};

/** Minimal stand-in for an <a> element. */
function anchor(href, { excluded = false } = {}) {
  return {
    href: new URL(href, location.href).href,
    matches: (selector) => (selector === EXCLUDED_SELECTOR ? excluded : false),
  };
}

test('speculation rules prerender same-origin pages on moderate eagerness', () => {
  const rules = speculationRules();
  assert.deepEqual(Object.keys(rules), ['prerender']);
  const [rule] = rules.prerender;
  assert.equal(rule.source, 'document');
  assert.equal(rule.eagerness, 'moderate');
  assert.deepEqual(rule.where.and[0], { href_matches: '/*' });
  assert.ok(rule.where.and[1].not.href_matches.includes('/*.pdf'));
  assert.match(rule.where.and[2].not.selector_matches, /target="_blank"/);
  // Must survive a JSON round trip unchanged, since that is how it is installed.
  assert.deepEqual(JSON.parse(JSON.stringify(rules)), rules);
});

test('prefersLessData honours Data Saver and 2G connections', () => {
  assert.equal(prefersLessData({}), false);
  assert.equal(prefersLessData(undefined), false);
  assert.equal(prefersLessData({ connection: { effectiveType: '4g' } }), false);
  assert.equal(prefersLessData({ connection: { saveData: true, effectiveType: '4g' } }), true);
  assert.equal(prefersLessData({ connection: { effectiveType: '2g' } }), true);
  assert.equal(prefersLessData({ connection: { effectiveType: 'slow-2g' } }), true);
});

test('isPrefetchable accepts other same-origin pages only', () => {
  assert.ok(isPrefetchable(anchor('food.html'), location));
  assert.ok(isPrefetchable(anchor('/'), location));
  assert.ok(isPrefetchable(anchor('food.html#pantry'), location));
  for (const href of [
    'students.html',
    'students.html#top',
    'https://example.org/page.html',
    'mailto:president@esc.studentorg.berkeley.edu',
    'report.pdf',
    'images/ESC_banner.jpg',
    'assets/js/main.js',
    'form.php',
  ]) {
    assert.equal(isPrefetchable(anchor(href), location), false, href);
  }
  assert.equal(isPrefetchable(anchor('food.html', { excluded: true }), location), false);
  assert.equal(isPrefetchable(null, location), false);
});

test('every live page loads the enhancements, via the shared nav or directly', async () => {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { ROOT, discoverPages } = await import('../../scripts/site-pages.mjs');
  const { pages } = await discoverPages();
  const missing = [];
  for (const page of pages) {
    const html = await readFile(join(ROOT, page), 'utf8');
    if (!html.includes('assets/js/top-bar.js') && !html.includes('assets/js/site/enhance.js')) {
      missing.push(page);
    }
  }
  assert.deepEqual(missing, []);
});
