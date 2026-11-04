// Progressive enhancements: instant page loads and page transitions.
import { test, expect } from './fixtures.mjs';

// Chromium refuses to actually prerender while DevTools (and therefore
// Playwright) is attached, reporting PrerenderingDisabledByDevTools. What we
// can prove is that Chromium accepts the rules and lines up the right pages
// as prerender candidates, which is everything this site controls.
test('Chromium accepts the speculation rules and targets the right links', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const ruleSets = [];
  let candidates = [];
  cdp.on('Preload.ruleSetUpdated', (event) => ruleSets.push(event.ruleSet));
  cdp.on('Preload.preloadingAttemptSourcesUpdated', (event) => {
    candidates = event.preloadingAttemptSources.map((source) => new URL(source.key.url).pathname);
  });
  await cdp.send('Preload.enable');

  await page.goto('students.html');
  await expect(page.locator('html')).toHaveAttribute('data-esc-instant', 'prerender');
  await expect.poll(() => ruleSets.length).toBeGreaterThan(0);
  for (const ruleSet of ruleSets) expect(ruleSet.errorType, ruleSet.errorMessage).toBeUndefined();

  await expect.poll(() => candidates).toContain('/index.html');
  expect(candidates).toContain('/faqs.html');
  expect(candidates.every((path) => !/\.(pdf|jpe?g|png)$/i.test(path))).toBe(true);
  // Links that open in a new tab are left alone.
  const newTabPaths = await page.$$eval('a[target="_blank"][href$=".html"]', (links) =>
    links.map((a) => new URL(a.href).pathname).filter((p) => p.startsWith('/')),
  );
  for (const path of newTabPaths) {
    const alsoSameTab = await page
      .locator(`a[href$="${path.slice(1)}"]:not([target="_blank"])`)
      .count();
    if (!alsoSameTab) expect(candidates).not.toContain(path);
  }
});

// Chrome decides very early whether the incoming page takes part in a view
// transition, so the opt-in has to be inline in <head> (see main.css). This
// checks both sides: the outgoing page starts a transition (pageswap) and
// the incoming page actually runs it (pagereveal).
for (const [from, to] of [
  ['housing.html', 'food.html'],
  ['food.html', 'index.html'],
  ['index.html', 'about.html'],
]) {
  test(`navigating ${from} → ${to} animates with a view transition`, async ({ page }) => {
    await page.addInitScript(() => {
      addEventListener('pageswap', (event) => {
        sessionStorage.setItem('esc-vt-swap', String(Boolean(event.viewTransition)));
      });
      addEventListener('pagereveal', (event) => {
        window.escRevealTransition = Boolean(event.viewTransition);
      });
    });
    await page.goto(from, { waitUntil: 'load' });
    await page.evaluate((url) => (location.href = url), to);
    await page.waitForURL((url) => url.pathname.endsWith(to));
    await expect.poll(() => page.evaluate(() => window.escRevealTransition)).toBe(true);
    expect(await page.evaluate(() => sessionStorage.getItem('esc-vt-swap'))).toBe('true');
  });
}

test('visitors who prefer reduced motion get plain page loads', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(
    (url) => url.origin !== new URL(baseURL).origin,
    (route) => route.abort(),
  );
  await page.addInitScript(() =>
    addEventListener('pagereveal', (event) => {
      window.escRevealTransition = Boolean(event.viewTransition);
    }),
  );
  await page.goto('housing.html', { waitUntil: 'load' });
  await page.evaluate(() => (location.href = 'food.html'));
  await page.waitForURL(/food\.html$/);
  await expect.poll(() => page.evaluate(() => window.escRevealTransition)).toBe(false);
  await context.close();
});

test('every page with the shared nav carries the inline transition opt-in', async ({ request }) => {
  const { discoverPages } = await import('../../scripts/site-pages.mjs');
  const { pages } = await discoverPages();
  const missing = [];
  for (const path of pages) {
    const html = await (await request.get(path)).text();
    const head = html.slice(0, html.search(/<\/head>/i));
    if (!/<style>[^<]*@view-transition\s*\{\s*navigation:\s*auto/.test(head)) missing.push(path);
  }
  expect(missing).toEqual([]);
});
