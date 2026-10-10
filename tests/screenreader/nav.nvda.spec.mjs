// NVDA (Windows) walks the site nav the way a blind visitor would.
import { nvdaTest as test } from '@guidepup/playwright';
import { expect } from '@playwright/test';
import { moveUntil, openPage, spokenSince } from './helpers.mjs';

test.describe('NVDA', () => {
  test('announces the skip link, menu states, and the current page', async ({ page, nvda }) => {
    await openPage(page);
    await nvda.navigateToWebContent();
    const next = () => nvda.next();

    // The first thing on the page is the skip link.
    await moveUntil(nvda, next, /skip to main content/i, 15);

    // The current section is announced as the current page.
    await moveUntil(nvda, next, /current page/i);

    // Back to the About Us disclosure button: named, a button, collapsed.
    const button = await moveUntil(nvda, () => nvda.previous(), /about us submenu/i);
    expect(button).toMatch(/collapsed/i);

    // Activating it expands the menu, and its first item follows.
    const mark = (await nvda.spokenPhraseLog()).length;
    await nvda.act();
    await expect.poll(() => spokenSince(nvda, mark)).toMatch(/expanded/i);
    await moveUntil(nvda, next, /our team/i, 10);
  });
});
