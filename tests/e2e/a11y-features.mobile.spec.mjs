// The phone layout swaps the header for a fixed title bar and a slide-out
// menu, so keyboard focus is checked again at phone size: every stop shows a
// ring and none hides under the title bar (WCAG 2.4.7 and 2.4.11). Phones
// with keyboards, switch control, and screen readers all move focus this way.
import { test, expect } from './fixtures.mjs';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { settle } from './lib/axe.mjs';
import { walkFocus } from './lib/focus.mjs';

const { pages } = await discoverPages();

test.describe.configure({ mode: 'parallel' });

for (const path of pages) {
  test(`${path}: every keyboard stop is visible on a phone`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'load' });
    await expect(page.locator('html')).toHaveAttribute('data-esc-a11y', 'ready');
    await settle(page);
    const { problems, stops } = await walkFocus(page);
    expect(stops, 'keyboard stops reached').toBeGreaterThan(2);
    expect(problems).toEqual([]);
  });
}
