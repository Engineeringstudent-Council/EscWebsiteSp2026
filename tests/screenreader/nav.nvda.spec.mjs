// NVDA (Windows) walks the site nav the way a blind visitor would.
import { nvdaTest as test } from '@guidepup/playwright';
import { expect } from '@playwright/test';
import { moveUntil, openPage, spokenSince, stateOf } from './helpers.mjs';

test.describe('NVDA', () => {
  test('announces the skip link, menu states, and the current page', async ({ page, nvda }) => {
    await openPage(page);
    await nvda.navigateToWebContent();
    const next = () => nvda.next();

    // The first thing on the page is the skip link.
    await moveUntil(nvda, next, /skip to main content/i, 15);

    // The current section is announced as the current page.
    await moveUntil(nvda, next, /current page/i);

    // Back to the About Us disclosure button: named, a button, with a state.
    // (The reader's cursor can hover the nav and open a menu by itself, so
    // the starting state may be either.)
    const button = await moveUntil(nvda, () => nvda.previous(), /about us submenu/i);
    expect(button).toMatch(/button/i);
    const before = stateOf(button);
    expect(before, button).not.toBeNull();

    // Activating it flips the announced state.
    const after = before === 'collapsed' ? 'expanded' : 'collapsed';
    const mark = (await nvda.spokenPhraseLog()).length;
    await nvda.act();
    await expect.poll(() => spokenSince(nvda, mark)).toMatch(new RegExp(after, 'i'));

    // Once open, the menu's first item is reachable right after the button.
    if (after === 'expanded') await moveUntil(nvda, next, /our team/i, 10);
  });
});
