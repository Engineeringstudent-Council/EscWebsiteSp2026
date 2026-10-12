// Search core: ranking, snippets, and highlighting. Pure functions with no
// DOM access, so the exact same code runs in the browser and in unit tests.
//
// Records come from assets/search/index.json (built by
// scripts/build-search-index.mjs). Fuse.js does the fuzzy matching; this
// module decides what a "good" result looks like for ESC's visitors.

export const MAX_QUERY_LENGTH = 96;

/** Fuse.js options, tuned against the golden queries in tests/unit. */
export const FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  ignoreFieldNorm: true,
  threshold: 0.34,
  minMatchCharLength: 2,
  keys: [
    { name: 'title', weight: 4 },
    { name: 'keywords', weight: 2.5 },
    { name: 'description', weight: 1.2 },
    { name: 'page', weight: 1 },
    { name: 'trailText', weight: 0.6 },
  ],
};

// Body text is long, and fuzzy-matching it is what makes search slow (~10x).
// Typo tolerance matters most for titles and keywords, so body text gets a
// fast exact-word pass instead. These are the scores a body match earns.
const BODY_ALL_TERMS = 0.3;
const BODY_MOST_TERMS = 0.5;

// Pages are the best answer for broad queries; sections and links win
// when they match on their own title.
const KIND_WEIGHT = { page: 1, link: 0.97, section: 0.8 };

// Beyond the first few results, weak fuzzy matches are noise ("fnding"
// loosely matching "finding" on unrelated pages), so they are dropped.
export const MIN_RESULTS = 3;
export const WEAK_SCORE = 0.6;
const SCORE_FLOOR = 0.02;

const DIACRITICS = /[̀-ͯ]/g;

/** Lowercase and strip accents so "Café" matches "cafe". */
export function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

/**
 * Trim, collapse whitespace, cap the length, and drop control characters.
 * Returns '' for queries too short to be meaningful.
 */
export function normalizeQuery(raw) {
  const query = String(raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
  return query.length >= 2 || /[^\x20-\x7e]/.test(query) ? query : '';
}

/** Distinct query words worth highlighting, longest first. */
export function queryTerms(query) {
  const words = fold(query)
    .split(/[^\p{L}\p{N}&+]+/u)
    .filter((w) => w.length >= 2);
  return [...new Set(words)].sort((a, b) => b.length - a.length);
}

/**
 * Prepare raw index records for Fuse: add a searchable breadcrumb string.
 * Records with unsafe URLs are dropped rather than ever being rendered.
 */
export function prepareRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((r) => r && typeof r.title === 'string' && r.title && isSafeUrl(r.url))
    .map((r) => ({
      ...r,
      trail: Array.isArray(r.trail) ? r.trail.filter((t) => typeof t === 'string') : [],
      trailText: Array.isArray(r.trail) ? r.trail.join(' ') : '',
      text: typeof r.text === 'string' ? r.text : '',
      body: fold(
        `${typeof r.text === 'string' ? r.text : ''} ${typeof r.description === 'string' ? r.description : ''}`,
      ),
      description: typeof r.description === 'string' ? r.description : '',
      keywords: typeof r.keywords === 'string' ? r.keywords : '',
    }));
}

/** Only http(s), mailto, and plain relative paths may ever become links. */
export function isSafeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const value = url.trim();
  if (/^(https?:|mailto:)/i.test(value)) return true;
  // Relative paths: no scheme at all (blocks javascript:, data:, vbscript:...).
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//');
}

/** Resolve a record URL against the site root for use as an href. */
export function resolveUrl(url, siteRoot) {
  if (!isSafeUrl(url)) return null;
  if (/^(https?:|mailto:)/i.test(url)) return url;
  try {
    return new URL(url, siteRoot).href;
  } catch {
    return null;
  }
}

/**
 * Split `text` into [{ text, mark }] segments, marking every occurrence of
 * any term (accent- and case-insensitive). Renderers turn marked segments
 * into <mark> elements with textContent, so nothing is ever parsed as HTML.
 */
export function highlight(text, terms) {
  const source = String(text ?? '');
  if (!source || !terms?.length) return source ? [{ text: source, mark: false }] : [];
  const folded = fold(source);
  // fold() can change string length for some characters (e.g. ligatures);
  // only use positional highlighting when the lengths line up.
  if (folded.length !== source.length) return [{ text: source, mark: false }];

  const ranges = [];
  for (const term of terms) {
    let from = 0;
    while (from < folded.length) {
      const at = folded.indexOf(term, from);
      if (at === -1) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  if (!ranges.length) return [{ text: source, mark: false }];
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  const out = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) out.push({ text: source.slice(cursor, start), mark: false });
    out.push({ text: source.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < source.length) out.push({ text: source.slice(cursor), mark: false });
  return out;
}

/**
 * Pick a short excerpt of `text` centred on the first matching term.
 * Falls back to the start of the text when nothing matches literally
 * (a fuzzy match), so a result always has some context.
 */
export function snippet(text, terms, size = 150) {
  const source = String(text ?? '').trim();
  if (source.length <= size) return source;
  const folded = fold(source);
  let at = -1;
  for (const term of terms ?? []) {
    const i = folded.indexOf(term);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) {
    const cut = source.slice(0, size);
    const space = cut.lastIndexOf(' ');
    return `${(space > size * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
  }
  let start = Math.max(0, at - Math.floor(size / 3));
  let end = Math.min(source.length, start + size);
  start = Math.max(0, end - size);
  if (start > 0) {
    const space = source.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < source.length) {
    const space = source.lastIndexOf(' ', end);
    if (space > at) end = space;
  }
  return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
}

/**
 * Turn Fuse results into ranked, display-ready results.
 * `score` is lower-is-better, like Fuse's own score.
 */
export function rankResults(fuseResults, query, limit = 8) {
  const terms = queryTerms(query);
  const q = fold(query).trim();
  const ranked = fuseResults.map(({ item, score = 1 }) => {
    // Fuse scores near-perfect matches at ~0, where multiplying does
    // nothing; a small floor lets boosts break ties between them.
    let adjusted = score + SCORE_FLOOR;
    const title = fold(item.title);
    // Exact and prefix title matches are almost always what people meant.
    // Sections only get the prefix bonus, so a page beats a same-named
    // section elsewhere (the "Engineers Week" blurb on the events page).
    if (title === q) adjusted *= item.kind === 'section' ? 0.5 : 0.25;
    else if (title.startsWith(q)) adjusted *= 0.5;
    else if (terms.length && terms.every((t) => title.includes(t))) adjusted *= 0.7;
    const keywordList = ` ${item.keywords} `;
    if (terms.length && terms.every((t) => keywordList.includes(` ${t} `))) adjusted *= 0.75;
    adjusted /= (item.boost || 1) * (KIND_WEIGHT[item.kind] ?? 1);
    return { item, score: adjusted };
  });
  ranked.sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title));

  // One page shouldn't flood the list: keep at most two sections per page.
  const perPage = new Map();
  const seenUrls = new Set();
  const out = [];
  for (const entry of ranked) {
    const { item } = entry;
    if (seenUrls.has(item.url)) continue;
    if (out.length >= MIN_RESULTS && entry.score > WEAK_SCORE) break;
    if (item.kind === 'section') {
      const key = item.url.split('#')[0];
      const count = perPage.get(key) ?? 0;
      if (count >= 2) continue;
      perPage.set(key, count + 1);
    }
    seenUrls.add(item.url);
    out.push(toResult(entry, terms));
    if (out.length >= limit) break;
  }
  return out;
}

function toResult({ item, score }, terms) {
  const body = item.kind === 'section' ? item.text : item.description || item.text;
  const excerpt = snippet(body || item.text, terms);
  const trail = item.trail.filter((t) => fold(t) !== fold(item.title));
  return {
    id: item.id ?? item.url,
    kind: item.kind,
    url: item.url,
    external: Boolean(item.external) || /^(https?:|mailto:)/i.test(item.url),
    mail: /^mailto:/i.test(item.url),
    title: item.title,
    trail,
    score,
    titleParts: highlight(item.title, terms),
    excerptParts: highlight(excerpt, terms),
  };
}

/**
 * Build a searcher. `Fuse` is passed in (rather than imported) so tests and
 * the browser can each provide their own copy of the library.
 */
/**
 * Exact-word matches in body text. Only words of 3+ characters count, so
 * "a", "of", and "my" don't make every page match.
 * @returns {Map<object, number>} item -> score
 */
export function bodyMatches(items, terms) {
  const words = terms.filter((t) => t.length >= 3);
  const out = new Map();
  if (!words.length) return out;
  for (const item of items) {
    let hits = 0;
    for (const word of words) if (item.body.includes(word)) hits++;
    if (hits === words.length) out.set(item, BODY_ALL_TERMS);
    else if (words.length >= 3 && hits >= words.length - 1) out.set(item, BODY_MOST_TERMS);
  }
  return out;
}

export function createSearcher(Fuse, records, options = {}) {
  const items = prepareRecords(records);
  const fuse = new Fuse(items, { ...FUSE_OPTIONS, ...options });
  // Token search scores each word separately, which rescues natural phrasing
  // ("money for my club") but adds noise to short precise queries ("b&g").
  // It is only consulted when the precise search comes back thin.
  let tokenFuse = null;
  const tokenSearch = (query) => {
    if (tokenFuse === null) {
      try {
        tokenFuse = new Fuse(items, { ...FUSE_OPTIONS, ...options, useTokenSearch: true });
      } catch {
        tokenFuse = false; // basic build without token search
      }
    }
    return tokenFuse ? tokenFuse.search(query, { limit: 60 }) : [];
  };
  const featured = items.filter((r) => r.featured);

  return {
    size: items.length,
    featured,
    search(raw, limit = 8) {
      const query = normalizeQuery(raw);
      if (!query) return [];
      const terms = queryTerms(query);
      // Bitap cost grows with pattern length, and long phrases rarely match
      // a title as a whole anyway, so they go straight to token search.
      const long = query.length > 24 || terms.length > 3;
      const byItem = new Map();
      const add = (item, score) => {
        const prev = byItem.get(item);
        if (prev === undefined || score < prev) byItem.set(item, score);
      };
      if (!long) for (const r of fuse.search(query, { limit: 60 })) add(r.item, r.score ?? 1);
      for (const [item, score] of bodyMatches(items, terms)) add(item, score);
      if (byItem.size < 3 && terms.length > 1) {
        // Fallback hits rank after every precise hit.
        for (const r of tokenSearch(query))
          if (!byItem.has(r.item)) add(r.item, (long ? 0.4 : 1) + (r.score ?? 1));
      }
      const results = [...byItem].map(([item, score]) => ({ item, score }));
      return rankResults(results, query, limit);
    },
  };
}
