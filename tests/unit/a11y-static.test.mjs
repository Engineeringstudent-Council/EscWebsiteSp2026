// Accessibility checks on the HTML source of every live page. They run in
// milliseconds, without a browser, so an editor gets a precise message
// ("about.html: <img src=...> has no alt") before CI's browser suites run.
// The browser suites (tests/e2e/a11y*.spec.mjs) check the rendered page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { ROOT, discoverPages } from '../../scripts/site-pages.mjs';

const { pages } = await discoverPages();
const docs = await Promise.all(
  pages.map(async (page) => {
    const html = await readFile(join(ROOT, page), 'utf8');
    return { page, $: cheerio.load(html.replace(/<!--[\s\S]*?-->/g, '')) };
  }),
);

/** Collect "page: problem" lines from a per-page check. */
function problems(check) {
  return docs.flatMap(({ page, $ }) => check($).map((p) => `${page}: ${p}`));
}

const snippet = ($, el) => $.html(el).replace(/\s+/g, ' ').slice(0, 100);

test('every page declares English', () => {
  assert.deepEqual(
    problems(($) => ($('html').attr('lang') === 'en' ? [] : ['<html> needs lang="en"'])),
    [],
  );
});

test('no page stops people zooming', () => {
  const blocked = /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i;
  assert.deepEqual(
    problems(($) =>
      $('meta[name="viewport"]')
        .toArray()
        .filter((m) => blocked.test($(m).attr('content') ?? ''))
        .map(() => 'the viewport meta blocks zooming; use width=device-width, initial-scale=1'),
    ),
    [],
  );
});

test('every page has a title, and no two pages share one', () => {
  const seen = new Map();
  const out = problems(($) => {
    const title = $('title').first().text().trim();
    return title ? [] : ['<title> is empty'];
  });
  for (const { page, $ } of docs) {
    const title = $('title').first().text().trim();
    if (!title) continue;
    if (seen.has(title)) out.push(`${page}: same <title> as ${seen.get(title)} ("${title}")`);
    else seen.set(title, page);
  }
  assert.deepEqual(out, []);
});

test('every page has one <main id="main"> and one <h1>', () => {
  assert.deepEqual(
    problems(($) => {
      const out = [];
      const mains = $('main, [role="main"]');
      if (mains.length !== 1) out.push(`expected 1 <main>, found ${mains.length}`);
      else if (mains.attr('id') !== 'main')
        out.push('<main> needs id="main" (the skip link targets it)');
      const h1 = $('h1').length;
      if (h1 !== 1) out.push(`expected 1 <h1>, found ${h1}`);
      return out;
    }),
    [],
  );
});

test('every image has alt text, and none of it is filler', () => {
  const filler = /^(image|picture|photo|img|avatar|untitled|logo)$/i;
  assert.deepEqual(
    problems(($) =>
      $('img')
        .toArray()
        .flatMap((img) => {
          const alt = $(img).attr('alt');
          if (alt === undefined) return [`${snippet($, img)} has no alt`];
          if (filler.test(alt.trim())) return [`${snippet($, img)} has filler alt "${alt}"`];
          return [];
        }),
    ),
    [],
  );
});

test('every embed has a title', () => {
  assert.deepEqual(
    problems(($) =>
      $('iframe')
        .toArray()
        .filter((f) => !($(f).attr('title') ?? '').trim())
        .map((f) => `${snippet($, f)} needs a title`),
    ),
    [],
  );
});

test('no links go nowhere', () => {
  assert.deepEqual(
    problems(($) =>
      $('a[href="#"]')
        .toArray()
        .filter((a) => !$(a).attr('role'))
        .map((a) => `${snippet($, a)} links to "#"`),
    ),
    [],
  );
});

test('no element is pushed ahead in the Tab order', () => {
  assert.deepEqual(
    problems(($) =>
      $('[tabindex]')
        .toArray()
        .filter((el) => Number($(el).attr('tabindex')) > 0)
        .map((el) => `${snippet($, el)} has a positive tabindex`),
    ),
    [],
  );
});

test('ids are unique on each page', () => {
  assert.deepEqual(
    problems(($) => {
      const counts = new Map();
      $('[id]').each((_, el) => {
        const id = $(el).attr('id');
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });
      return [...counts].filter(([, n]) => n > 1).map(([id, n]) => `id="${id}" is used ${n} times`);
    }),
    [],
  );
});

test('every live page links its footer in from the shared include', () => {
  // index.html keeps its own footer design; every other page shares one, so
  // help and contact details are always in the same place (WCAG 3.2.6).
  assert.deepEqual(
    problems(($) => {
      if ($('script[src$="bottom-bar.js"]').length) return [];
      return $('footer#footer a[href$="accessibility.html"]').length
        ? []
        : [
            'include <script src="assets/js/bottom-bar.js"></script> instead of a hard-coded footer',
          ];
    }),
    [],
  );
});
