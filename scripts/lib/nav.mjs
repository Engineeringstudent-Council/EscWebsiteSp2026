// Turns the site's legacy document.write() nav/footer scripts into data.
//
// The menu in assets/js/top-bar.js is the one place the site's information
// architecture is written down, so the indexer reads it instead of keeping a
// second copy: every link inside it becomes a crawl seed, and the menu labels
// above a link become that page's breadcrumb trail ("Students › Life Resources").

import vm from 'node:vm';
import * as cheerio from 'cheerio';
import { clean } from './text.mjs';

/**
 * Run a script that builds markup with document.write() and return that markup.
 * Also supports document.currentScript.insertAdjacentHTML(), in case the
 * scripts are modernised later.
 */
export function renderWrittenHtml(source) {
  let html = '';
  const write = (...chunks) => {
    html += chunks.join('');
  };
  // Inert stand-ins for the few DOM calls the includes make besides writing
  // markup (e.g. top-bar.js appending the search <script>).
  const head = { appendChild() {} };
  const document = {
    head,
    write,
    writeln: (...chunks) => write(...chunks, '\n'),
    createElement: () => ({}),
    currentScript: {
      src: 'http://localhost/assets/js/include.js',
      parentNode: {},
      insertAdjacentHTML: (_where, chunk) => write(chunk),
    },
  };
  vm.runInNewContext(source, { document, window: {}, URL }, { timeout: 1000 });
  return html;
}

/** True when `href` points at another site (or another protocol entirely). */
export function isExternal(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

/** Strip query/hash and a leading "./" or "/"; returns '' for in-page anchors. */
export function toPagePath(href) {
  const path = String(href ?? '')
    .trim()
    .split('#')[0]
    .split('?')[0];
  return path.replace(/^\.?\//, '');
}

/**
 * Walk a nested <ul><li><a/><ul>…</ul></li></ul> menu.
 * @returns {{href: string, label: string, trail: string[]}[]} in document order.
 */
export function parseMenu(html, rootSelector = '#nav > ul') {
  const $ = cheerio.load(html);
  const entries = [];
  const walk = (ul, trail) => {
    $(ul)
      .children('li')
      .each((_, li) => {
        const anchor = $(li).children('a').first();
        const label = clean(anchor.text());
        const href = (anchor.attr('href') ?? '').trim();
        if (label && href && href !== '#') entries.push({ href, label, trail });
        const sub = $(li).children('ul');
        if (sub.length) walk(sub, label ? [...trail, label] : trail);
      });
  };
  $(rootSelector).each((_, ul) => walk(ul, []));
  return entries;
}

/** Every <a href> in a chunk of markup, with its visible label. */
export function parseLinks(html) {
  const $ = cheerio.load(html);
  return $('a[href]')
    .map((_, a) => ({ href: ($(a).attr('href') ?? '').trim(), label: clean($(a).text()) }))
    .get()
    .filter((link) => link.href && link.href !== '#');
}
