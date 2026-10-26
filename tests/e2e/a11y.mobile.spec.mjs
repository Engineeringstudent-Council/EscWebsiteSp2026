// The phone layout has its own title bar, slide-out menu, and footer
// stacking, so every live page is audited again at phone size, with the
// menu closed and then open.
import { test, expect } from './fixtures.mjs';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { axeViolations } from './lib/axe.mjs';

const { pages } = await discoverPages();

test.describe.configure({ mode: 'parallel' });

for (const page of pages) {
  test(`${page} has no accessibility violations on a phone`, async ({ page: tab }) => {
    await tab.goto(page, { waitUntil: 'load' });
    expect(await axeViolations(tab), `axe violations on ${page}`).toEqual([]);
  });
}

// While the menu is open the rest of the page is inert, as in a dialog, so
// only the menu and title bar are audited.
test('the open phone menu has no accessibility violations', async ({ page }) => {
  await page.goto('about.html', { waitUntil: 'load' });
  await page.locator('#titleBar .toggle').click();
  await expect(page.locator('body')).toHaveClass(/navPanel-visible/);
  await page.waitForTimeout(600); // the panel slides in over 0.5s
  expect(
    await axeViolations(page, { include: ['#navPanel', '#titleBar'] }),
    'axe violations with the menu open',
  ).toEqual([]);
});
