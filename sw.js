/* ESC service worker: offline support and faster repeat visits.
 *
 * Strategy, chosen so nobody ever sees a stale page or nav:
 *   - Pages, scripts, and stylesheets: network first. The cache is only a
 *     fallback when the network is down or very slow.
 *   - Images and fonts: cache first, since they almost never change in
 *     place, refreshed in the background.
 *   - The search index: stale-while-revalidate, so search works offline.
 *   - Anything cross-origin, non-GET, or partial (Range) is left alone.
 * Offline navigations to a page that was never visited get offline.html.
 *
 * Emergency off switch: set ENABLED = false in assets/js/site/offline.js
 * (pages then unregister this worker), or replace this file with one that
 * calls self.registration.unregister().
 */
'use strict';

const VERSION = 'v1';
const PRECACHE = `esc-precache-${VERSION}`;
const PAGES = `esc-pages-${VERSION}`;
const ASSETS = `esc-assets-${VERSION}`;
const CACHES = [PRECACHE, PAGES, ASSETS];

const OFFLINE_URL = 'offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  'images/icons/icon-192.png',
  'images/main_nobckgnd.png',
  'assets/css/main.css',
  'assets/css/fontawesome-all.min.css',
  'assets/js/top-bar.js',
  'assets/js/bottom-bar.js',
];

const NETWORK_TIMEOUT_MS = 4000;
const MAX_PAGES = 40;
const MAX_ASSETS = 200;

/** Decide how a request is handled: 'page', 'fresh', 'static', 'swr', or null. */
function routeFor(request, scopeOrigin) {
  if (request.method !== 'GET' || request.headers.get('range')) return null;
  const url = new URL(request.url);
  if (url.origin !== scopeOrigin) return null;
  if (request.mode === 'navigate') return 'page';
  const path = url.pathname.toLowerCase();
  if (path.endsWith('/sw.js')) return null;
  if (path.endsWith('/assets/search/index.json')) return 'swr';
  if (/\.(?:js|mjs|css|json|webmanifest)$/.test(path)) return 'fresh';
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf)$/.test(path)) return 'static';
  return null;
}

function cacheable(response) {
  return Boolean(response && response.ok && response.type === 'basic');
}

/** Keep a cache from growing forever by dropping its oldest entries. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function put(cacheName, request, response, max) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  await trim(cacheName, max);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function networkFirst(event, cacheName, max, fallbackToOffline) {
  const { request } = event;
  // For pages, navigation preload starts the request while the worker boots.
  const preload = request.mode === 'navigate' ? Promise.resolve(event.preloadResponse) : null;
  const network = (preload ? preload.then((r) => r || fetch(request)) : fetch(request)).then(
    (response) => {
      if (cacheable(response)) {
        event.waitUntil(put(cacheName, request, response.clone(), max));
      }
      return response;
    },
  );
  network.catch(() => {}); // handled below; avoid unhandled-rejection noise
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    // Slow but alive: keep waiting for the network rather than give up.
    try {
      return await network;
    } catch {
      if (fallbackToOffline) {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return Response.error();
    }
  }
}

async function cacheFirst(event, cacheName, max) {
  const { request } = event;
  const cached = await caches.match(request);
  const refresh = fetch(request).then((response) => {
    if (cacheable(response)) return put(cacheName, request, response.clone(), max);
    return undefined;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  const response = await fetch(request);
  if (cacheable(response)) event.waitUntil(put(cacheName, request, response.clone(), max));
  return response;
}

async function staleWhileRevalidate(event, cacheName, max) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request).then((response) => {
    if (cacheable(response)) event.waitUntil(put(cacheName, request, response.clone(), max));
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('esc-') && !CACHES.includes(name)) await caches.delete(name);
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const route = routeFor(event.request, self.location.origin);
  if (!route) return;
  if (route === 'page') {
    event.respondWith(
      networkFirst(event, PAGES, MAX_PAGES, true).catch(() => caches.match(OFFLINE_URL)),
    );
  } else if (route === 'fresh') {
    event.respondWith(networkFirst(event, ASSETS, MAX_ASSETS, false));
  } else if (route === 'static') {
    event.respondWith(cacheFirst(event, ASSETS, MAX_ASSETS));
  } else {
    event.respondWith(staleWhileRevalidate(event, ASSETS, MAX_ASSETS));
  }
});

// Exposed for unit tests; harmless in the browser.
self.escServiceWorker = { routeFor, cacheable, VERSION, PRECACHE_URLS };
