// The shared nav (assets/js/top-bar.js) inserts itself where its <script> tag
// sits. From <body> that is a clean insertAdjacentHTML; from <head> it has to
// fall back to document.write, which browsers warn about and which drags any
// later <head> tags into <body>. Keep every page on the modern path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, discoverPages } from '../../scripts/site-pages.mjs';

const { pages } = await discoverPages();

test('no live page loads the shared nav from <head>', async () => {
  const offenders = [];
  for (const page of pages) {
    const html = (await readFile(join(ROOT, page), 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
    const headEnd = html.search(/<\/head>/i);
    const nav = html.search(/<script[^>]*src=["'][^"']*top-bar\.js["']/i);
    if (nav !== -1 && headEnd !== -1 && nav < headEnd) offenders.push(page);
  }
  assert.deepEqual(
    offenders,
    [],
    'move <script src="assets/js/top-bar.js"></script> to the first line inside <body>',
  );
});
