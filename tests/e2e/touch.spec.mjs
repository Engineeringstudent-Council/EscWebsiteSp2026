// The whole site on touch devices: phones, iPads in portrait (phone-style
// menu) and landscape (desktop menu, but no hover), and an Android tablet.
// Each test adapts to the layout the device actually gets.
import { test, expect } from './fixtures.mjs';
import { discoverPages } from '../../scripts/site-pages.mjs';

const { pages } = await discoverPages();

/** 'phone' when the title bar menu is in use, 'desktop' when the top nav is. */
async function layoutOf(page) {
  return (await page.locator('#titleBar .toggle').isVisible()) ? 'phone' : 'desktop';
}

async function ready(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.escNavA11y === 'ready');
}

test('every live page fits the screen and offers navigation', async ({ page }) => {
  test.slow();
  const problems = [];
  for (const path of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) problems.push(`${path}: scrolls sideways by ${overflow}px`);
    const hasNav =
      (await page.locator('#titleBar .toggle').isVisible()) ||
      (await page.locator('#nav').isVisible()) ||
      path === 'index.html'; // the redesigned homepage has no nav by design
    if (!hasNav) problems.push(`${path}: no visible navigation`);
  }
  expect(problems).toEqual([]);
});

test('the menu works by touch', async ({ page }) => {
  await ready(page, 'students.html');
  if ((await layoutOf(page)) === 'phone') {
    const toggle = page.locator('#titleBar .toggle');
    const box = await toggle.boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    await toggle.tap();
    await expect(page.locator('body')).toHaveClass(/navPanel-visible/);
    const target = page.locator('#navPanel a', { hasText: 'Executive Board' });
    await target.scrollIntoViewIfNeeded();
    await target.tap();
    await expect(page).toHaveURL(/execs\.html$/);
    return;
  }
  // Desktop menu without hover: first tap opens, second tap follows.
  const about = page.locator('#nav > ul > li > a', { hasText: 'About Us' });
  const menu = page.locator(
    `[id="${await page
      .locator('#nav [aria-label="About Us submenu"]')
      .getAttribute('aria-controls')}"]`,
  );
  await about.tap();
  await expect(menu).toBeVisible();
  await expect(page).toHaveURL(/students\.html$/);
  await menu.getByRole('button', { name: 'Our Team' }).tap();
  const execs = menu.locator('a', { hasText: 'Executive Board' });
  await expect(execs).toBeVisible();
  // Tapping elsewhere closes it.
  await page.touchscreen.tap(20, (page.viewportSize().height * 3) / 4);
  await expect(menu).toBeHidden();
  // Open again and follow a link inside.
  await about.tap();
  await menu.getByRole('button', { name: 'Our Team' }).tap();
  await execs.tap();
  await expect(page).toHaveURL(/execs\.html$/);
  // A second tap on an open top-level item follows its own link.
  await ready(page, 'students.html');
  await about.tap();
  await expect(menu).toBeVisible();
  await about.tap();
  await expect(page).toHaveURL(/about\.html$/);
});

test('search works by touch and fits the screen', async ({ page }) => {
  await ready(page, 'faqs.html');
  const trigger =
    (await layoutOf(page)) === 'phone'
      ? page.locator('#titleBar .esc-search-trigger')
      : page.locator('#nav .esc-search-trigger');
  const box = await trigger.boundingBox();
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await trigger.tap();
  const dialog = page.locator('dialog.esc-search');
  await expect(dialog).toBeVisible();
  const width = await dialog.evaluate((el) => parseFloat(getComputedStyle(el).width));
  expect(width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.locator('#esc-search-input').fill('free food');
  const first = page.locator('dialog.esc-search [role="option"]').first();
  await expect(first).toContainText('Food Security');
  await first.tap();
  await expect(page).toHaveURL(/food\.html/);
});

test('the homepage hero search is tappable', async ({ page }) => {
  await page.goto('index.html');
  const hero = page.locator('.esc-hero-search');
  await expect(hero).toBeVisible();
  const box = await hero.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await hero.tap();
  await expect(page.locator('dialog.esc-search')).toBeVisible();
});

test('the offline page fits the screen', async ({ page }) => {
  await page.goto('offline.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
