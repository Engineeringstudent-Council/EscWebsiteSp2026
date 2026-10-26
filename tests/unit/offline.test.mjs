import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { shouldRegister } from '../../assets/js/site/offline.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'https://esc.studentorg.berkeley.edu';

/** Load sw.js in a sandbox and return what it exposes for testing. */
async function loadWorker() {
  const source = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const listeners = {};
  const self = {
    addEventListener: (type, fn) => (listeners[type] = fn),
    location: new URL(`${ORIGIN}/sw.js`),
  };
  vm.runInNewContext(source, { self, URL, caches: {}, fetch: () => {}, Response: {} });
  return { ...self.escServiceWorker, listeners };
}

function request(url, { method = 'GET', mode = 'no-cors', range } = {}) {
  return {
    url: new URL(url, `${ORIGIN}/`).href,
    method,
    mode,
    headers: { get: (name) => (name === 'range' ? (range ?? null) : null) },
  };
}

test('the worker listens for install, activate, and fetch', async () => {
  const { listeners } = await loadWorker();
  assert.deepEqual(Object.keys(listeners).sort(), ['activate', 'fetch', 'install']);
});

test('routeFor sends each kind of request to the right strategy', async () => {
  const { routeFor } = await loadWorker();
  const cases = [
    [request('food.html', { mode: 'navigate' }), 'page'],
    [request('/', { mode: 'navigate' }), 'page'],
    [request('assets/js/top-bar.js'), 'fresh'],
    [request('assets/css/main.css'), 'fresh'],
    [request('manifest.webmanifest'), 'fresh'],
    [request('assets/search/index.json'), 'swr'],
    [request('images/ESC_banner.jpg'), 'static'],
    [request('images/GalleryPhotos/IMG_1.JPG'), 'static'],
    [request('assets/webfonts/fa-solid-900.woff2'), 'static'],
    [request('sw.js'), null],
    [request('form.php', { method: 'POST' }), null],
    [request('video.mp4', { range: 'bytes=0-' }), null],
    [request('https://fonts.googleapis.com/css?family=x'), null],
    [request('https://forms.gle/abc', { mode: 'navigate' }), null],
  ];
  for (const [req, expected] of cases) assert.equal(routeFor(req, ORIGIN), expected, req.url);
});

test('only successful same-origin responses are cached', async () => {
  const { cacheable } = await loadWorker();
  assert.equal(cacheable({ ok: true, type: 'basic' }), true);
  assert.equal(cacheable({ ok: false, type: 'basic' }), false);
  assert.equal(cacheable({ ok: true, type: 'opaque' }), false);
  assert.equal(cacheable(undefined), false);
});

test('every precached file exists, so install can never fail', async () => {
  const { PRECACHE_URLS } = await loadWorker();
  assert.ok(PRECACHE_URLS.includes('offline.html'));
  for (const path of PRECACHE_URLS) await access(join(ROOT, path));
});

test('the worker registers only on the real site, previews, or when opted in', () => {
  const at = (hostname) => ({ hostname });
  const storage = (value) => ({ getItem: () => value });
  assert.equal(shouldRegister(at('esc.studentorg.berkeley.edu')), true);
  assert.equal(shouldRegister(at('esc.berkeley.edu')), true);
  assert.equal(shouldRegister(at('feat-x.esc-berkeley.pages.dev')), true);
  assert.equal(shouldRegister(at('localhost')), false);
  assert.equal(shouldRegister(at('localhost'), storage('on')), true);
  assert.equal(shouldRegister(at('localhost'), storage('off')), false);
  assert.equal(
    shouldRegister(at('localhost'), {
      getItem() {
        throw new Error('blocked');
      },
    }),
    false,
  );
  assert.equal(shouldRegister(at('evil-esc-berkeley.pages.dev')), false);
});

test('the manifest is installable and its icons exist', async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#002676');
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons)]) {
    await access(join(ROOT, icon.src));
  }
});
