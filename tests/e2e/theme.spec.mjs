// End-to-end tests for the light/dark theme toggle (assets/js/theme/theme.js).
import { test, expect } from './fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
import { discoverPages } from '../../scripts/site-pages.mjs';

const { pages } = await discoverPages();
const toggle = (page) => page.locator('.esc-theme-toggle').first();
const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const stored = (page) => page.evaluate(() => localStorage.getItem('esc-theme'));
const startDark = (page) => page.addInitScript(() => localStorage.setItem('esc-theme', 'dark'));

test('the site is light until someone asks for dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); // the OS setting is ignored on purpose
  await page.goto('about.html');
  expect(await theme(page)).toBe('light');
  await expect(page.locator('#nav .esc-theme-toggle')).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle(page)).toHaveAccessibleName('Dark mode');
});

test('the bear switches to dark, swaps the logos, and remembers the choice', async ({ page }) => {
  await page.goto('execs.html');
  const logo = page.locator('#logo img');
  await expect(logo).toHaveAttribute('src', 'images/main_nobckgnd.png');

  await toggle(page).click();
  await expect.poll(() => theme(page)).toBe('dark');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await stored(page)).toBe('dark');
  await expect(logo).toHaveAttribute('src', /\/images\/dark\/main_nobckgnd\.png$/);
  await expect
    .poll(() => logo.evaluate((img) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  // The exec page's placeholder headshots are navy logos too.
  await expect(page.locator('img[alt="ESC logo placeholder"]').first()).toHaveAttribute(
    'src',
    /\/images\/dark\/esc_newton\.png$/,
  );
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(248, 248, 248)');

  await page.goto('faqs.html');
  expect(await theme(page)).toBe('dark');

  await toggle(page).click();
  await expect.poll(() => theme(page)).toBe('light');
  expect(await stored(page)).toBeNull();
  await expect(page.locator('#logo img')).toHaveAttribute('src', 'images/main_nobckgnd.png');
});

test('a saved dark theme is applied before the page body exists (no white flash)', async ({
  page,
}) => {
  await startDark(page);
  await page.addInitScript(() => {
    new MutationObserver((records, observer) => {
      if (document.body) {
        window.__themeAtBody = document.documentElement.dataset.theme;
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('students.html');
  expect(await page.evaluate(() => window.__themeAtBody)).toBe('dark');
});

test('the toggle works from the keyboard', async ({ page }) => {
  await page.goto('about.html');
  await toggle(page).focus();
  await page.keyboard.press('Space');
  await expect.poll(() => theme(page)).toBe('dark');
  await page.keyboard.press('Enter');
  await expect.poll(() => theme(page)).toBe('light');
  await expect(toggle(page)).toBeFocused();
});

test('search stays before the bear in the nav', async ({ page }) => {
  await page.goto('students.html');
  await expect(page.locator('#nav .esc-search-trigger')).toBeVisible();
  const order = await page.$$eval('#nav > ul > li', (items) => items.map((li) => li.className));
  expect(order.slice(-2)).toEqual(['esc-search-nav', 'esc-theme-nav']);
});

test('every open tab follows the change', async ({ page, context }) => {
  await page.goto('about.html');
  const other = await context.newPage();
  await other.goto('food.html');
  await toggle(page).click();
  await expect.poll(() => theme(other)).toBe('dark');
  await expect(other.locator('#logo img')).toHaveAttribute('src', /\/images\/dark\//);
});

test('the homepage, which has no nav, gets its own bear', async ({ page }) => {
  await page.goto('index.html');
  const corner = page.locator('.esc-theme-toggle--corner');
  await expect(corner).toBeVisible();
  await corner.click();
  await expect.poll(() => theme(page)).toBe('dark');
  const hero = await page
    .locator('.esc-hero-search')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(hero).not.toMatch(/^rgba?\(255, 255, 255/);
});

test('reduced motion switches instantly, without the reveal animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about.html');
  await toggle(page).click();
  expect(await theme(page)).toBe('dark');
  expect(await page.evaluate(() => document.documentElement.className)).not.toContain(
    'esc-theme-switching',
  );
});

test('the search palette goes dark with the page', async ({ page }) => {
  await startDark(page);
  await page.goto('students.html');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.locator('dialog.esc-search');
  await expect(dialog).toBeVisible();
  const bg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(19, 26, 51)');
  await page.locator('#esc-search-input').fill('funding');
  await expect(dialog.locator('[role="option"]').first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog.esc-search').analyze();
  expect(violations).toEqual([]);
});

// Light mode has legacy contrast issues tracked by a11y.spec.mjs; dark mode was
// built to pass, so any new failure here is a regression.
for (const path of pages) {
  test(`${path} has readable contrast in dark mode`, async ({ page }) => {
    await startDark(page);
    await page.goto(path, { waitUntil: 'load' });
    const { violations } = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .exclude('iframe')
      .analyze();
    const failures = (violations[0]?.nodes ?? []).map(
      (n) => `${n.target.join(' ')}: ${n.any[0]?.message}`,
    );
    expect(
      failures,
      `dark-mode contrast failures on ${path}; add an override in assets/css/theme.css`,
    ).toEqual([]);
  });
}
