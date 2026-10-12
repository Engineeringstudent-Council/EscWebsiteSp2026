// End-to-end tests for the ⌘K site search palette.
import { test, expect } from './fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

const dialog = (page) => page.locator('dialog.esc-search');
const input = (page) => page.locator('#esc-search-input');
const options = (page) => page.locator('dialog.esc-search [role="option"]');

test('nothing heavy loads until someone shows intent', async ({ page }) => {
  const requested = [];
  page.on('request', (req) => requested.push(new URL(req.url()).pathname));
  await page.goto('students.html');
  await expect(page.locator('#nav .esc-search-trigger')).toBeVisible();
  expect(requested.some((p) => p.endsWith('fuse.esm.min.js'))).toBe(false);
  expect(requested.some((p) => p.endsWith('index.json'))).toBe(false);
  await page.locator('#nav .esc-search-trigger').hover();
  await expect.poll(() => requested.some((p) => p.endsWith('index.json'))).toBe(true);
});

test('nav button opens the palette, typing shows highlighted results, Enter navigates', async ({
  page,
}) => {
  await page.goto('students.html');
  await page.locator('#nav .esc-search-trigger').click();
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await input(page).fill('fnding');
  await expect(options(page).first()).toContainText('Apply for Funding');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(input(page)).toHaveAttribute('aria-activedescendant', 'esc-search-option-0');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/applyfunding\.html$/);
});

test('arrow keys move the active option and wrap around', async ({ page }) => {
  await page.goto('faqs.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('food');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
  const count = await options(page).count();
  expect(count).toBeGreaterThan(1);
  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(input(page)).toHaveAttribute('aria-activedescendant', 'esc-search-option-1');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(options(page).nth(count - 1)).toHaveAttribute('aria-selected', 'true');
  await expect(input(page)).toBeFocused();
});

test('the shortcut toggles, Escape closes, and focus returns to the trigger', async ({ page }) => {
  await page.goto('clubs.html');
  const trigger = page.locator('#nav .esc-search-trigger');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(dialog(page)).toBeHidden();
});

test('"/" opens search, but not while typing in a field', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('/');
  await expect(dialog(page)).toBeVisible();
  await input(page).fill('a/b');
  await expect(input(page)).toHaveValue('a/b');
});

test('the homepage hero opens search and the empty state offers help', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('.esc-hero-search').click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('.esc-search-greeting')).toBeVisible();
  await expect(options(page).first()).toBeVisible(); // popular pages
  await page.locator('.esc-search-chips button', { hasText: 'Free food' }).click();
  await expect(options(page).first()).toContainText('Food Security');
});

test('no results shows a friendly state with a pre-filled email', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('zzqxv');
  await expect(page.locator('.esc-search-empty')).toContainText('Nothing for “zzqxv”');
  const mail = page.locator('.esc-search-empty a[href^="mailto:"]');
  await expect(mail).toHaveAttribute('href', /president@esc\.studentorg\.berkeley\.edu\?subject=/);
  await expect(page.locator('dialog.esc-search [role="status"]')).toHaveText(/No results/);
});

test('external results open in a new tab safely', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('blue gold portal');
  const portal = options(page).filter({ hasText: 'Blue & Gold Portal' });
  await expect(portal).toHaveAttribute('target', '_blank');
  await expect(portal).toHaveAttribute('rel', 'noopener');
});

test('recently opened results are remembered and can be cleared', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('housing');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/housing\.html/);
  await expect(page.locator('#nav .esc-search-trigger')).toBeVisible(); // module ready
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.esc-search-group', { hasText: 'Recently opened' })).toBeVisible();
  await expect(options(page).first()).toContainText('Housing Help');
  await page.locator('.esc-search-group button', { hasText: 'Clear' }).click();
  await expect(page.locator('.esc-search-group', { hasText: 'Recently opened' })).toHaveCount(0);
});

test('?search= links open the palette pre-filled', async ({ page }) => {
  await page.goto('index.html?search=makerspaces');
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toHaveValue('makerspaces');
  await expect(options(page).first()).toContainText('Makerspaces');
});

test('section results deep-link with a text fragment', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('calfresh');
  const section = options(page).filter({ hasText: 'CalFresh' }).first();
  await expect(section).toHaveAttribute('href', /food\.html#:~:text=CalFresh$/);
});

test('works on legacy pages that have their own inline nav', async ({ page }) => {
  await page.goto('policies.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('treasurer');
  await expect(options(page).first()).toContainText('Treasurer Training');
});

test('the open palette has no accessibility violations', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('funding');
  await expect(options(page).first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog.esc-search').analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('shows a retry message if the index fails to load', async ({ page }) => {
  await page.route('**/assets/search/index.json', (route) => route.fulfill({ status: 500 }));
  await page.goto('index.html');
  await page.keyboard.press('ControlOrMeta+k');
  await input(page).fill('funding');
  await expect(page.locator('.esc-search-status')).toContainText('Search is having a moment');
  await page.unroute('**/assets/search/index.json');
  await page.locator('.esc-search-retry').click();
  await expect(options(page).first()).toContainText('Apply for Funding');
});
