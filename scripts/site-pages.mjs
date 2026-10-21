// Discovers the "live" pages of the site: every local .html page reachable
// by following links from the homepage and the shared nav/footer includes.
// Orphaned legacy pages are therefore left out of tests, audits, and the
// sitemap automatically, without anyone maintaining a list by hand.
import { readFile, access } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Files whose links seed the crawl, relative to the site root. */
export const SEEDS = ['index.html', 'assets/js/top-bar.js', 'assets/js/bottom-bar.js'];

// Quoted or unquoted: browsers follow <a href=ficomm.html> just the same.
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+))/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Extract local .html link targets from markup, resolved against `fromDir`
 * (a posix path relative to the site root). External URLs, mailto:, and
 * fragment-only links are ignored; links inside HTML comments are too,
 * since commented-out nav items are not live.
 */
export function extractLocalLinks(markup, fromDir = '') {
  const out = new Set();
  const source = markup.replace(COMMENT, '');
  for (const match of source.matchAll(HREF)) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      continue;
    }
    const path = raw.split('#')[0].split('?')[0];
    if (!path.toLowerCase().endsWith('.html')) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      continue;
    }
    const joined = path.startsWith('/')
      ? posix.normalize(decoded.slice(1))
      : posix.normalize(posix.join(fromDir, decoded));
    if (joined.startsWith('..')) continue;
    out.add(joined);
  }
  return [...out];
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Breadth-first crawl from the seeds. Returns sorted, root-relative page
 * paths that exist on disk, plus any links that point at missing pages.
 */
export async function discoverPages({ root = ROOT, seeds = SEEDS } = {}) {
  const pages = new Set();
  const missing = new Map();
  const queue = [];

  for (const seed of seeds) {
    if (seed.endsWith('.html')) {
      queue.push(seed);
    } else {
      const markup = await readFile(join(root, seed), 'utf8');
      queue.push(...extractLocalLinks(markup, ''));
    }
  }

  while (queue.length) {
    const page = queue.shift();
    if (pages.has(page)) continue;
    if (!(await exists(join(root, page)))) {
      missing.set(page, (missing.get(page) || 0) + 1);
      continue;
    }
    pages.add(page);
    const markup = await readFile(join(root, page), 'utf8');
    for (const link of extractLocalLinks(
      markup,
      posix.dirname(page) === '.' ? '' : posix.dirname(page),
    )) {
      if (!pages.has(link)) queue.push(link);
    }
  }

  return { pages: [...pages].sort(), missing: [...missing.keys()].sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pages, missing } = await discoverPages();
  console.log(JSON.stringify({ count: pages.length, pages, missing }, null, 2));
}
