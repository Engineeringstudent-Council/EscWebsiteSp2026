import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_ORIGIN,
  isNoindex,
  pageUrl,
  renderSitemap,
  sitemapPages,
} from '../../scripts/build-sitemap.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('pageUrl maps index pages to their directory and encodes paths', () => {
  assert.equal(pageUrl('index.html'), `${SITE_ORIGIN}/`);
  assert.equal(pageUrl('about.html'), `${SITE_ORIGIN}/about.html`);
  assert.equal(pageUrl('sub/index.html'), `${SITE_ORIGIN}/sub/`);
  assert.equal(pageUrl('My Page.html'), `${SITE_ORIGIN}/My%20Page.html`);
});

test('isNoindex detects robots noindex meta tags only', () => {
  assert.ok(isNoindex('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(isNoindex("<meta name='robots' content='NOINDEX'>"));
  assert.ok(!isNoindex('<meta name="robots" content="index, follow">'));
  assert.ok(!isNoindex('<meta name="description" content="noindex is a word">'));
});

test('renderSitemap is valid, sorted, deduped, escaped, with the homepage first', () => {
  const xml = renderSitemap(['b.html', 'index.html', 'a&b.html', 'b.html']);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset'));
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/a&amp;b.html`,
    `${SITE_ORIGIN}/b.html`,
  ]);
});

test('sitemapPages skips verification files, noindex pages, and orphans', async () => {
  const root = await mkdtemp(join(tmpdir(), 'esc-sitemap-'));
  try {
    await mkdir(join(root, 'assets/js'), { recursive: true });
    await writeFile(join(root, 'assets/js/top-bar.js'), 'document.write(\'<a href="a.html">\');');
    await writeFile(join(root, 'assets/js/bottom-bar.js'), '');
    await writeFile(
      join(root, 'index.html'),
      '<a href="a.html"></a><a href="hidden.html"></a><a href="google1234abcd.html"></a>',
    );
    await writeFile(join(root, 'a.html'), '<h1>A</h1>');
    await writeFile(join(root, 'hidden.html'), '<meta name="robots" content="noindex">');
    await writeFile(join(root, 'google1234abcd.html'), 'google-site-verification');
    await writeFile(join(root, 'orphan.html'), '<h1>nobody links here</h1>');
    assert.deepEqual(await sitemapPages({ root }), ['a.html', 'index.html']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the committed sitemap.xml matches the live pages', async () => {
  const committed = await readFile(join(ROOT, 'sitemap.xml'), 'utf8');
  assert.equal(
    committed,
    renderSitemap(await sitemapPages()),
    'run `npm run build:sitemap` and commit sitemap.xml',
  );
});

test('robots.txt allows crawling and advertises the sitemap', async () => {
  const robots = await readFile(join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m, 'robots.txt must not block the whole site');
  assert.match(robots, new RegExp(`^Sitemap: ${SITE_ORIGIN}/sitemap\\.xml$`, 'm'));
});
