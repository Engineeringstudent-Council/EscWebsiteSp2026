// Static guarantees for the light/dark theme that are cheaper to check here
// than in a browser: every page wires it up correctly, and every logo the
// toggle swaps has a dark twin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, discoverPages } from '../../scripts/site-pages.mjs';
import { LOGOS } from '../../scripts/build-dark-logos.mjs';

const { pages } = await discoverPages();
const themeJs = await readFile(join(ROOT, 'assets/js/theme/theme.js'), 'utf8');

/** Width and height from a PNG's IHDR chunk. */
async function pngSize(path) {
  const buf = await readFile(path);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('every live page loads the theme in <head>, before any other script', async () => {
  const problems = [];
  for (const page of pages) {
    const html = await readFile(join(ROOT, page), 'utf8');
    const head = html.slice(0, html.search(/<\/head>/i));
    const css = head.indexOf('href="assets/css/theme.css"');
    const script = head.match(/<script\b[^>]*src="assets\/js\/theme\/theme\.js"[^>]*>/);
    if (css < 0) problems.push(`${page}: missing assets/css/theme.css in <head>`);
    if (!script) {
      problems.push(`${page}: missing assets/js/theme/theme.js in <head>`);
      continue;
    }
    // It has to block rendering, or a saved dark theme would flash white first.
    if (/\b(async|defer|type="module")/.test(script[0])) {
      problems.push(`${page}: theme.js must be a plain <script>, not async/defer/module`);
    }
    // top-bar.js document.writes the header, which starts <body>; the theme
    // must already be applied by then.
    const firstScript = head.search(/<script\b/i);
    if (firstScript !== script.index) {
      problems.push(`${page}: theme.js must be the first <script> in <head>`);
    }
    if (css > script.index) problems.push(`${page}: put theme.css just before theme.js`);
  }
  assert.deepEqual(problems, []);
});

test('every logo the toggle swaps has a same-sized dark twin', async () => {
  const swapped = themeJs.match(/\/images\\\/\(([^)]+)\)\\\.png/)[1].split('|');
  const aliases = Object.fromEntries(
    [...themeJs.matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]),
  );
  for (const name of swapped) {
    const dark = `${aliases[name] || name}.png`;
    await access(join(ROOT, 'images', `${name}.png`));
    assert.ok(LOGOS.includes(dark), `${dark} is not built by scripts/build-dark-logos.mjs`);
    assert.deepEqual(
      await pngSize(join(ROOT, 'images/dark', dark)),
      await pngSize(join(ROOT, 'images', dark)),
      `images/dark/${dark} should match the original's dimensions`,
    );
  }
});

test('the theme never follows the OS colour scheme on its own', () => {
  // The brief: a toggle, not the desktop's brightness preference.
  assert.doesNotMatch(themeJs, /prefers-color-scheme/);
});
