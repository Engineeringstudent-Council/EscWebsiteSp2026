// Phone-sized checks for site search.
import { test, expect } from './fixtures.mjs';

test('the title bar search button opens a full-screen sheet', async ({ page }) => {
  await page.goto('faqs.html');
  const button = page.locator('#titleBar .esc-search-trigger');
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44); // comfortable tap target
  await button.tap();
  const dialog = page.locator('dialog.esc-search');
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize();
  // Computed width, not the bounding box, which is scaled mid-animation.
  const width = await dialog.evaluate((el) => parseFloat(getComputedStyle(el).width));
  expect(Math.round(width)).toBe(viewport.width);
  await page.locator('#esc-search-input').fill('free food');
  await expect(page.locator('dialog.esc-search [role="option"]').first()).toContainText(
    'Food Security',
  );
});

test('the homepage hero search is visible and usable on a phone', async ({ page }) => {
  await page.goto('index.html');
  const hero = page.locator('.esc-hero-search');
  await expect(hero).toBeVisible();
  await hero.tap();
  await expect(page.locator('dialog.esc-search')).toBeVisible();
});
