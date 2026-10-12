// Small, dependency-free text helpers shared by the indexer.

/** Collapse whitespace (incl. nbsp) and trim. */
export function clean(value) {
  return String(value ?? '')
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
}

/** Truncate on a word boundary and add an ellipsis when something was cut. */
export function truncate(value, max) {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : text.slice(0, max);
  return base.replace(/[\s,.;:–—-]+$/, '') + '…';
}

/**
 * Percent-encode a string for use inside a URL text fragment
 * (https://wicg.github.io/scroll-to-text-fragment/). On top of
 * encodeURIComponent, the spec reserves "-", "," and "&" as syntax.
 */
export function encodeTextDirective(value) {
  return encodeURIComponent(value).replace(/-/g, '%2D').replace(/,/g, '%2C');
}

/** Build a `page.html#:~:text=...` link that scrolls to (and highlights) `phrase`. */
export function textFragmentUrl(url, phrase) {
  const text = clean(phrase);
  if (!text) return url;
  // Long headings are matched by their first and last few words.
  const words = text.split(' ');
  const directive =
    words.length > 10
      ? `${encodeTextDirective(words.slice(0, 4).join(' '))},${encodeTextDirective(words.slice(-3).join(' '))}`
      : encodeTextDirective(text);
  return `${url}#:~:text=${directive}`;
}

/** First sentence-ish chunk of `text` that is at least `min` characters long. */
export function summarize(text, max = 180) {
  const value = clean(text);
  if (!value) return '';
  // A sentence ends at . ! or ? followed by whitespace, so "berkeley.edu" survives.
  const sentences = value.match(/.+?[.!?]+(?=\s|$)\s*|.+$/g) ?? [value];
  let out = '';
  for (const sentence of sentences) {
    if ((out + sentence).length > max && out) break;
    out += sentence;
    if (out.length >= 80) break;
  }
  return truncate(out, max);
}

/** Unique, lowercased, space-separated keyword string. */
export function mergeKeywords(...lists) {
  const seen = new Set();
  for (const list of lists) {
    for (const word of clean(Array.isArray(list) ? list.join(' ') : list)
      .toLowerCase()
      .split(' ')) {
      if (word) seen.add(word);
    }
  }
  return [...seen].join(' ');
}
