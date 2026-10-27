// Phone-sized checks for the light/dark theme toggle.
import { test, expect } from './fixtures.mjs';

const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('the title bar bear is a full-size tap target that fits beside search and the logo', async ({
  page,
}) => {
  await page.goto('faqs.html');
  const bear = page.locator('#titleBar .esc-theme-toggle');
  await expect(bear).toBeVisible();
  const box = await bear.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const search = await page.locator('#titleBar .esc-search-trigger').boundingBox();
  const logo = await page.locator('#titleBar .title img').boundingBox();
  expect(overlaps(box, search)).toBe(false);
  expect(overlaps(box, logo)).toBe(false);

  await bear.tap();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.locator('#titleBar .title img')).toHaveAttribute('src', /\/images\/dark\//);
});

test('the homepage bear is reachable on a phone, where the header is hidden', async ({ page }) => {
  await page.goto('index.html');
  const bear = page.locator('.esc-theme-toggle--corner');
  await expect(bear).toBeVisible();
  await bear.tap();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});
