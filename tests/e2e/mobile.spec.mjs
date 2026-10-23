// On phones the desktop nav is replaced by a title bar and a slide-out
// panel that main.js builds from the nav links. If the shared header or
// main.js breaks, phone visitors lose all navigation, so guard it.
import { test, expect } from './fixtures.mjs';

const PAGES = ['students.html', 'clubs.html', 'faqs.html', 'events.html'];

for (const page of PAGES) {
  test(`${page} has working phone navigation`, async ({ page: tab }) => {
    await tab.goto(page);
    await expect(tab.locator('#nav')).toBeHidden();
    const toggle = tab.locator('#titleBar .toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(tab.locator('body')).toHaveClass(/navPanel-visible/);
    const links = tab.locator('#navPanel a.link');
    expect(await links.count()).toBeGreaterThan(15);
    const teamLink = tab.locator('#navPanel a.link[href="execs.html"]');
    await expect(teamLink).toHaveText('Our Team');
  });
}

test('pages do not scroll sideways on a phone', async ({ page: tab }) => {
  for (const page of ['index.html', ...PAGES]) {
    await tab.goto(page);
    const overflow = await tab.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${page} horizontal overflow (px)`).toBeLessThanOrEqual(1);
  }
});
