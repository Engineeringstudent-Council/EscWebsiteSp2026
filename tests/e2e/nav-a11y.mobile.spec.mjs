// Keyboard and screen-reader access to the phone menu (#titleBar toggle and
// #navPanel, built by main.js, enhanced by assets/js/site/nav-a11y.js).
import { test, expect, pressTab } from './fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
import { AXE_TAGS } from './lib/axe.mjs';

async function open(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-esc-nav-a11y', 'ready');
}

const isInert = (locator) => locator.evaluate((el) => Boolean(el.closest('[inert]')));

test('the menu toggle has a name, state, and controls the panel', async ({ page }) => {
  await open(page, 'students.html');
  const toggle = page.getByRole('button', { name: 'Menu' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-controls', 'navPanel');
  await expect(page.locator('#navPanel nav')).toHaveAttribute('aria-label', 'Site');
  // Closed panel links are off-screen: they must not be reachable.
  expect(await isInert(page.locator('#navPanel'))).toBe(true);
});

test('keyboard opens the panel, traps focus inside, and Escape returns focus', async ({ page }) => {
  await open(page, 'students.html');
  const toggle = page.getByRole('button', { name: 'Menu' });
  const panel = page.locator('#navPanel');
  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('body')).toHaveClass(/navPanel-visible/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.locator('a.link').first()).toBeFocused();
  expect(await isInert(panel)).toBe(false);
  expect(await isInert(page.locator('#page-wrapper'))).toBe(true);
  expect(await isInert(page.locator('.esc-skip-link'))).toBe(true);
  expect(await isInert(page.locator('#titleBar .title'))).toBe(true);
  expect(await isInert(toggle)).toBe(false);

  // Tab around a full lap: focus never escapes into the page behind.
  const stops = await panel.locator('a[href]').count();
  for (let i = 0; i < stops + 3; i++) {
    await pressTab(page);
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'body';
      if (el.closest('#navPanel')) return 'panel';
      if (el.closest('#titleBar .toggle')) return 'toggle';
      return 'outside:' + el.outerHTML.slice(0, 80);
    });
    expect(['panel', 'toggle', 'body']).toContain(where);
  }

  await page.locator('#navPanel a.link[href]').nth(2).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/navPanel-visible/);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await isInert(page.locator('#page-wrapper'))).toBe(false);
  expect(await isInert(panel)).toBe(true);
});

test('Space on the toggle opens and closes the panel', async ({ page }) => {
  await open(page, 'events.html');
  const toggle = page.getByRole('button', { name: 'Menu' });
  await toggle.focus();
  await page.keyboard.press(' ');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.focus();
  await page.keyboard.press(' ');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('tapping outside still closes the panel while the page is inert', async ({ page }) => {
  await open(page, 'students.html');
  await page.locator('#titleBar .toggle').click();
  await expect(page.locator('body')).toHaveClass(/navPanel-visible/);
  const { width, height } = page.viewportSize();
  await page.mouse.click(width - 10, height / 2);
  await expect(page.locator('body')).not.toHaveClass(/navPanel-visible/);
  expect(await isInert(page.locator('#page-wrapper'))).toBe(false);
});

test('group labels are text, not dead links, and the current page is marked', async ({ page }) => {
  await open(page, 'execs.html');
  const ourTeam = page.locator('#navPanel a.link', { hasText: 'Our Team' });
  await expect(ourTeam).not.toHaveAttribute('href', /.*/);
  await expect(page.locator('#navPanel a[href="#"]')).toHaveCount(0);
  await expect(page.locator('#navPanel a[aria-current="page"]')).toHaveText('Executive Board');
});

test('the skip link works on a phone', async ({ page }) => {
  await open(page, 'about.html');
  await pressTab(page);
  const skip = page.locator('.esc-skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('the open panel and title bar have no axe violations', async ({ page }) => {
  await open(page, 'students.html');
  await page.locator('#titleBar .toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveClass(/navPanel-visible/);
  await page.waitForTimeout(600); // let the slide-in finish
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include('#navPanel')
    .include('#titleBar')
    .analyze();
  expect(violations.map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
});
