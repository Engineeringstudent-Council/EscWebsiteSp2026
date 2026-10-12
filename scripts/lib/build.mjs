// Builds the search index for the static site.
//
//   1. Read the nav + footer menus (they define the site's structure).
//   2. Crawl every page reachable from them, breadth first. Orphaned legacy
//      pages are never reached, so they never show up in search.
//   3. Turn each page into a "page" record plus one record per section.
//   4. Add hand-curated external destinations (forms, portals, ...).
//   5. Apply editorial overrides and synonym groups from data/search/.

import fs from 'node:fs';
import path from 'node:path';
import { extractPage } from './extract.mjs';
import { isExternal, parseLinks, parseMenu, renderWrittenHtml, toPagePath } from './nav.mjs';
import { clean, mergeKeywords, summarize, textFragmentUrl, truncate } from './text.mjs';

export const INDEX_VERSION = 1;

const DEFAULT_LIMITS = { sectionText: 1200, pageText: 1500, description: 180 };

/** Minimal glob support for the exclude list: "*" within a segment, "**" across segments. */
export function globToRegExp(glob) {
  const source = glob
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${source}$`);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${file}: ${error.message}`, { cause: error });
  }
}

/** Load config + editorial data from `<root>/data/search`. */
export function loadSearchData(root) {
  const dir = path.join(root, 'data', 'search');
  return {
    config: readJson(path.join(dir, 'config.json'), {}),
    pages: readJson(path.join(dir, 'pages.json'), {}),
    links: readJson(path.join(dir, 'links.json'), []),
    synonyms: readJson(path.join(dir, 'synonyms.json'), []),
  };
}

/** Expand keywords with every synonym group whose terms appear in `haystack`. */
export function expandSynonyms(haystack, groups) {
  const text = ` ${clean(haystack)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&+]+/gu, ' ')} `;
  const extra = [];
  for (const group of groups) {
    if (group.some((term) => text.includes(` ${term.toLowerCase()} `))) extra.push(...group);
  }
  return extra;
}

function validateHttpUrl(url, where) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${where}: "${url}" is not a valid absolute URL`);
  }
  if (!/^(https?|mailto):$/.test(parsed.protocol)) {
    throw new Error(`${where}: only http(s) and mailto links are allowed (got "${url}")`);
  }
}

/**
 * @param {string} root  Site root on disk.
 * @param {object} [data] Pre-loaded search data (defaults to data/search/*).
 * @returns {{ index: object, report: { pages: string[], missing: {from: string, href: string}[], skipped: string[] } }}
 */
export function buildIndex(root, data = loadSearchData(root)) {
  const { config = {}, pages: overrides = {}, links: curated = [], synonyms = [] } = data;
  const limits = { ...DEFAULT_LIMITS, ...config.limits };
  const exclude = (config.exclude ?? []).map(globToRegExp);
  const isExcluded = (file) => exclude.some((re) => re.test(file));

  // 1. Menus -------------------------------------------------------------
  const navByPage = new Map();
  const externalNav = [];
  const seeds = [...(config.seeds ?? ['index.html'])];
  for (const menu of config.menus ?? []) {
    const file = path.join(root, menu.script);
    if (!fs.existsSync(file)) throw new Error(`Menu script not found: ${menu.script}`);
    const html = renderWrittenHtml(fs.readFileSync(file, 'utf8'));
    const entries = menu.selector
      ? parseMenu(html, menu.selector)
      : parseLinks(html).map((link) => ({ ...link, trail: [] }));
    for (const entry of entries) {
      if (isExternal(entry.href)) {
        if (/^https?:/i.test(entry.href) && menu.selector) externalNav.push(entry);
        continue;
      }
      const page = toPagePath(entry.href);
      if (!page) continue;
      seeds.push(page);
      // Prefer the deepest menu entry: it carries the most specific breadcrumb.
      const known = navByPage.get(page);
      if (menu.selector && (!known || entry.trail.length > known.trail.length))
        navByPage.set(page, entry);
    }
  }

  // 2. Crawl --------------------------------------------------------------
  const queue = seeds.map((page) => ({ page, from: null }));
  const parentOf = new Map();
  const extracted = new Map();
  const missing = [];
  const skipped = [];
  const visited = new Set();
  while (queue.length) {
    const { page, from } = queue.shift();
    if (visited.has(page)) continue;
    visited.add(page);
    if (!/\.html?$/i.test(page)) continue;
    const file = path.join(root, page);
    if (!path.resolve(file).startsWith(path.resolve(root) + path.sep)) continue;
    if (!fs.existsSync(file)) {
      missing.push({ from: from ?? '(menu)', href: page });
      continue;
    }
    if (isExcluded(page)) {
      skipped.push(page);
      continue;
    }
    const content = extractPage(fs.readFileSync(file, 'utf8'));
    if (content.robotsNoindex || overrides[page]?.exclude) {
      skipped.push(page);
      continue;
    }
    extracted.set(page, content);
    if (from && !parentOf.has(page)) parentOf.set(page, from);
    for (const link of content.links) {
      if (isExternal(link.href)) continue;
      const target = toPagePath(path.posix.join(path.posix.dirname(page), toPagePath(link.href)));
      if (target && !visited.has(target)) queue.push({ page: target, from: page });
    }
  }

  // 3. Pages + sections ---------------------------------------------------
  const titleOf = new Map();
  for (const [page, content] of extracted) {
    const override = overrides[page] ?? {};
    titleOf.set(
      page,
      clean(override.title) ||
        navByPage.get(page)?.label ||
        content.firstHeading ||
        content.htmlTitle ||
        page.replace(/\.html?$/, ''),
    );
  }
  const trailOf = (page, seen = new Set()) => {
    const override = overrides[page];
    if (override?.trail) return override.trail;
    const nav = navByPage.get(page);
    if (nav) return nav.trail;
    const parent = parentOf.get(page);
    if (!parent || parent === 'index.html' || seen.has(parent)) return [];
    seen.add(page);
    // Inherit from the page that linked here, capped at two levels so deep
    // link chains don't produce absurd breadcrumbs.
    return [...trailOf(parent, seen).slice(0, 1), titleOf.get(parent)];
  };

  const records = [];
  const ordered = [...extracted.keys()].sort((a, b) =>
    a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b),
  );
  for (const page of ordered) {
    const content = extracted.get(page);
    const override = overrides[page] ?? {};
    const title = titleOf.get(page);
    const trail = trailOf(page);

    const sections = [];
    const seenSections = new Set();
    const ignored = new Set((config.ignoreHeadings ?? []).map((h) => h.toLowerCase()));
    let pageText = content.intro;
    for (const section of content.sections) {
      const key = `${section.heading}\u0000${section.text}`.toLowerCase();
      // Several pages repeat blocks for desktop/mobile layouts.
      if (seenSections.has(key) || ignored.has(section.heading.toLowerCase().replace(/:$/, '')))
        continue;
      seenSections.add(key);
      const target = section.href && !isExternal(section.href) ? toPagePath(section.href) : null;
      // "Teaser" headings that just link to another indexed page would only
      // duplicate that page's own result.
      if (target && target !== page && extracted.has(target)) continue;
      if (section.heading.toLowerCase() === title.toLowerCase()) {
        pageText = clean(`${pageText} ${section.text}`);
        continue;
      }
      if (!section.text && !section.href) {
        // A heading with nothing under it (e.g. above an embedded form) still
        // describes the page.
        pageText = clean(
          `${pageText} ${section.heading}${/[.!?:]$/.test(section.heading) ? '' : '.'}`,
        );
        continue;
      }
      sections.push(section);
    }
    if (!pageText && sections.length) pageText = sections[0].text;

    const headingWords = sections.map((s) => s.heading).join(' ');
    const keywords = mergeKeywords(
      override.keywords,
      content.metaKeywords,
      expandSynonyms(`${title} ${override.keywords ?? ''} ${headingWords}`, synonyms),
    );
    records.push({
      id: page,
      kind: 'page',
      url: page,
      title,
      trail,
      description: truncate(
        override.description || content.metaDescription || summarize(pageText, limits.description),
        limits.description,
      ),
      keywords,
      text: truncate(pageText, limits.pageText),
      ...(override.boost ? { boost: override.boost } : {}),
      ...(override.featured ? { featured: true } : {}),
    });

    sections.forEach((section, i) => {
      const external = section.href && isExternal(section.href) && /^https?:/i.test(section.href);
      records.push({
        id: `${page}#${i + 1}`,
        kind: 'section',
        url: section.id ? `${page}#${section.id}` : textFragmentUrl(page, section.heading),
        title: section.heading,
        page: title,
        trail: [...trail, title],
        text: truncate(section.text, limits.sectionText),
        keywords: mergeKeywords(expandSynonyms(section.heading, synonyms)),
        ...(external ? { link: section.href } : {}),
      });
    });
  }

  // 4. External destinations ---------------------------------------------
  const seenLinks = new Set();
  const addLink = (link, where) => {
    validateHttpUrl(link.url, where);
    const key = link.url.replace(/\/+$/, '');
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    const title = clean(link.title);
    if (!title) throw new Error(`${where}: link "${link.url}" needs a title`);
    records.push({
      id: `link:${key}`,
      kind: 'link',
      url: link.url,
      external: true,
      title,
      trail: link.trail ?? (link.category ? [link.category] : []),
      description: truncate(link.description ?? '', limits.description),
      keywords: mergeKeywords(
        link.keywords,
        expandSynonyms(`${title} ${link.keywords ?? ''}`, synonyms),
      ),
      text: '',
      ...(link.boost ? { boost: link.boost } : {}),
      ...(link.featured ? { featured: true } : {}),
    });
  };
  curated.forEach((link, i) => {
    if (!isExternal(link.url ?? '')) {
      throw new Error(
        `data/search/links.json[${i}]: "${link.url}" is internal; describe internal pages in pages.json instead`,
      );
    }
    addLink(link, `data/search/links.json[${i}]`);
  });
  for (const entry of externalNav) {
    addLink(
      { url: entry.href, title: entry.label, trail: entry.trail },
      `menu link "${entry.label}"`,
    );
  }

  // 5. Sanity checks ------------------------------------------------------
  for (const key of Object.keys(overrides)) {
    if (!extracted.has(key) && !overrides[key].exclude && !skipped.includes(key)) {
      throw new Error(
        `data/search/pages.json has an entry for "${key}", which is not a reachable page`,
      );
    }
  }
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate search record id: ${record.id}`);
    ids.add(record.id);
  }

  return {
    index: { version: INDEX_VERSION, site: config.site ?? null, count: records.length, records },
    report: { pages: ordered, missing, skipped: [...new Set(skipped)].sort() },
  };
}

/** Stable serialisation: one record per line keeps git diffs readable. */
export function serializeIndex(index) {
  const { records, ...meta } = index;
  const head = JSON.stringify(meta).slice(0, -1);
  const body = records.map((record) => `    ${JSON.stringify(record)}`).join(',\n');
  return `${head},\n  "records": [\n${body}\n  ]\n}\n`;
}
