// Instant page loads.
//
// Browsers that support the Speculation Rules API (Chromium) quietly
// prerender a page when the visitor shows intent: hovering a link for a
// moment, or pressing on it. By the time the click lands, the page is
// already rendered, so the navigation feels instant.
//
// Everywhere else, a lighter fallback adds <link rel="prefetch"> on hover or
// touch, so at least the HTML is in the cache before the click.
//
// Both respect Data Saver and very slow connections.

/** Paths that are never worth prerendering: files, tooling, and forms. */
export const EXCLUDED_PATHS = [
  '/*.pdf',
  '/*.jpg',
  '/*.jpeg',
  '/*.JPG',
  '/*.png',
  '/*.zip',
  '/*.php',
  '/assets/*',
  '/images/*',
];

/** Links that open elsewhere, download, or opt out explicitly. */
export const EXCLUDED_SELECTOR =
  '[target="_blank"], [download], [rel~="nofollow"], [data-no-prerender], [data-no-prerender] a';

/** Speculation rules: prerender same-origin pages on hover or press. */
export function speculationRules() {
  return {
    prerender: [
      {
        source: 'document',
        where: {
          and: [
            { href_matches: '/*' },
            { not: { href_matches: EXCLUDED_PATHS } },
            { not: { selector_matches: EXCLUDED_SELECTOR } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
  };
}

/** True when the visitor has asked to save data or is on a very slow link. */
export function prefersLessData(nav = globalThis.navigator) {
  const connection = nav && nav.connection;
  if (!connection) return false;
  return Boolean(connection.saveData) || /(^|-)2g$/.test(connection.effectiveType || '');
}

/** Whether a link is a same-origin page worth prefetching. */
export function isPrefetchable(anchor, location = globalThis.location) {
  if (!anchor || !anchor.href || anchor.matches(EXCLUDED_SELECTOR)) return false;
  let url;
  try {
    url = new URL(anchor.href, location.href);
  } catch {
    return false;
  }
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false;
  const path = url.pathname.toLowerCase();
  if (/\.(pdf|jpe?g|png|zip|php)$/.test(path)) return false;
  return !path.startsWith('/assets/') && !path.startsWith('/images/');
}

function installFallbackPrefetch(doc) {
  const done = new Set();
  let timer = 0;

  const prefetch = (anchor) => {
    if (!isPrefetchable(anchor)) return;
    const url = new URL(anchor.href, location.href);
    url.hash = '';
    if (done.has(url.href)) return;
    done.add(url.href);
    const link = doc.createElement('link');
    link.rel = 'prefetch';
    link.href = url.href;
    doc.head.append(link);
  };

  const anchorFrom = (event) =>
    event.target instanceof Element ? event.target.closest('a[href]') : null;

  // A short delay filters out the mouse merely passing over a link.
  doc.addEventListener(
    'pointerover',
    (event) => {
      const anchor = anchorFrom(event);
      clearTimeout(timer);
      if (anchor) timer = setTimeout(() => prefetch(anchor), 80);
    },
    { passive: true },
  );
  doc.addEventListener('pointerout', () => clearTimeout(timer), { passive: true });
  // Touch and keyboard users have no hover; their intent is the press or focus.
  doc.addEventListener('touchstart', (event) => prefetch(anchorFrom(event)), {
    passive: true,
  });
  doc.addEventListener('focusin', (event) => prefetch(anchorFrom(event)));
}

/** Install the best available strategy. Returns which one was used. */
export function installInstantNavigation(doc = document) {
  if (prefersLessData()) return 'off';
  if (globalThis.HTMLScriptElement?.supports?.('speculationrules')) {
    const script = doc.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify(speculationRules());
    doc.head.append(script);
    return 'prerender';
  }
  installFallbackPrefetch(doc);
  return 'prefetch';
}
