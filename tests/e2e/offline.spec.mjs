// Offline support, end to end: the service worker registers, saves pages
// as they are visited, and keeps the site usable without a connection.
import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ page }) => {
  // The worker only registers on the real site unless opted in like this.
  await page.addInitScript(() => localStorage.setItem('esc-sw', 'on'));
});

async function waitForWorker(page) {
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active && navigator.serviceWorker.controller);
  });
}

test('visited pages keep working offline, and unvisited ones get a friendly page', async ({
  page,
  context,
}) => {
  await page.goto('housing.html');
  await expect(page.locator('html')).toHaveAttribute('data-esc-offline', 'registered');
  await waitForWorker(page);
  // Visit a couple of pages while online so the worker saves them.
  await page.goto('food.html');
  await page.goto('housing.html');
  await expect(page.locator('h2, h1').filter({ hasText: 'Housing Help' }).first()).toBeVisible();

  await context.setOffline(true);

  await page.goto('food.html');
  await expect(page.locator('#header')).toBeVisible();
  await expect(page.getByText('Food Security').first()).toBeVisible();

  await page.goto('makerspaces.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're offline.");
  const saved = page.locator('#saved-list a');
  await expect(saved.filter({ hasText: 'Food Security' })).toHaveCount(1);
  await expect(saved.filter({ hasText: 'Housing' })).toHaveCount(1);

  // Saved links work offline. (This once failed: the browser fired a
  // spurious 'online' event mid-navigation and the offline page reloaded
  // itself over the click. It now checks the network really answers.)
  await saved.filter({ hasText: 'Food Security' }).click();
  await expect(page).toHaveURL(/food\.html$/);
  await expect(page.getByText('Food Security').first()).toBeVisible();

  await context.setOffline(false);
});

test('a status message appears when the connection drops and returns', async ({
  page,
  context,
}) => {
  await page.goto('housing.html');
  await waitForWorker(page);
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'offline' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'Back online' })).toBeVisible();
});

test('pages stay network-first: an edited page is never served stale', async ({ page }) => {
  // A real file on disk, edited between visits, exactly like a deploy.
  const { writeFile, rm } = await import('node:fs/promises');
  const file = new URL(`../../sw-freshness-${test.info().workerIndex}.tmp.html`, import.meta.url);
  const name = file.pathname.split('/').pop();
  const html = (text) =>
    `<!doctype html><title>${text}</title><script type="module" src="assets/js/site/enhance.js"></script><h1>${text}</h1>`;
  try {
    await writeFile(file, html('First version'));
    await page.goto(name);
    await waitForWorker(page);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('First version');
    await writeFile(file, html('Second version'));
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Second version');
  } finally {
    await rm(file, { force: true });
  }
});

test('the site is installable: manifest and icons are linked', async ({ page }) => {
  await page.goto('housing.html');
  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute('href', /manifest\.webmanifest$/);
  const response = await page.request.get(await manifest.getAttribute('href'));
  expect(response.ok()).toBe(true);
  expect((await response.json()).short_name).toBe('ESC Berkeley');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test('nothing registers on localhost unless opted in', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('housing.html');
  await expect(page.locator('html')).toHaveAttribute('data-esc-offline', 'off');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations())).toHaveLength(0);
  await context.close();
});
