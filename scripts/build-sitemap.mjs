// Generates sitemap.xml from the live pages (see site-pages.mjs), so a new
// page shows up in Google as soon as something on the site links to it.
//
//   npm run build:sitemap          rewrite sitemap.xml
//   npm run build:sitemap -- --check   exit 1 if sitemap.xml is out of date (CI)
//
// <lastmod>, <priority>, and <changefreq> are deliberately omitted: Google
// ignores the last two, and a lastmod that is not kept accurate is worse
// than none. That also means the file only changes when pages come or go.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, discoverPages } from './site-pages.mjs';

export const SITE_ORIGIN = 'https://esc.studentorg.berkeley.edu';

/** Search Console ownership files and similar never belong in a sitemap. */
const NEVER_LIST = [/^google[0-9a-f]+\.html$/i, /(^|\/)404\.html$/i];

const NOINDEX = /<meta\s[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*noindex/i;

/** Public URL for a root-relative page path; index pages map to their directory. */
export function pageUrl(page, origin = SITE_ORIGIN) {
  const path = page.replace(/(^|\/)index\.html$/, '$1');
  return `${origin}/${encodeURI(path)}`;
}

function escapeXml(value) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
}

/** True when a page asks search engines not to index it. */
export function isNoindex(markup) {
  return NOINDEX.test(markup);
}

/** Render the sitemap XML for already-filtered page paths. */
export function renderSitemap(pages, origin = SITE_ORIGIN) {
  const urls = [...new Set(pages.map((page) => pageUrl(page, origin)))].sort((a, b) =>
    a === `${origin}/` ? -1 : b === `${origin}/` ? 1 : a.localeCompare(b),
  );
  const body = urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${body}\n</urlset>\n`
  );
}

/** Discover live pages and drop the ones that should not be listed. */
export async function sitemapPages({ root = ROOT } = {}) {
  const { pages } = await discoverPages({ root });
  const listed = [];
  for (const page of pages) {
    if (NEVER_LIST.some((pattern) => pattern.test(page))) continue;
    if (isNoindex(await readFile(join(root, page), 'utf8'))) continue;
    listed.push(page);
  }
  return listed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const target = join(ROOT, 'sitemap.xml');
  const pages = await sitemapPages();
  const xml = renderSitemap(pages);
  const current = await readFile(target, 'utf8').catch(() => '');
  if (check) {
    if (current !== xml) {
      console.error(
        'sitemap.xml is out of date (a page was added, removed, or unlinked).\n' +
          'Run `npm run build:sitemap` and commit the result.',
      );
      process.exit(1);
    }
    console.log(`sitemap.xml is up to date (${pages.length} pages).`);
  } else {
    await writeFile(target, xml);
    console.log(`Wrote sitemap.xml with ${pages.length} pages.`);
  }
}
