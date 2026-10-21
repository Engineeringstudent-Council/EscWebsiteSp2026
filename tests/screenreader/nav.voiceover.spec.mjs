// VoiceOver (macOS) walks the site nav the way a blind visitor would.
import { voiceOverTest as test } from '@guidepup/playwright';
import { expect } from '@playwright/test';
import { moveUntil, openPage, spokenSince, stateOf } from './helpers.mjs';

test.describe('VoiceOver', () => {
  test('announces the skip link, menu states, and the current page', async ({
    page,
    voiceOver,
  }) => {
    await openPage(page);
    await voiceOver.navigateToWebContent();
    const next = () => voiceOver.next();

    // The first thing on the page is the skip link.
    await moveUntil(voiceOver, next, /skip to main content/i, 15);

    // The current section is announced as the current page.
    await moveUntil(voiceOver, next, /students.*current page|current page.*students/i);

    // Back to the About Us disclosure button: named, a button, with a state.
    // (The reader's cursor can hover the nav and open a menu by itself, so
    // the starting state may be either.)
    const button = await moveUntil(voiceOver, () => voiceOver.previous(), /about us submenu/i);
    expect(button).toMatch(/button/i);
    expect(stateOf(button), button).not.toBeNull();

    // Activating it toggles the menu. Read the state from the page right
    // before pressing: the reader's mouse can hover the nav and open the
    // menu between hearing the button and pressing it, so the announced
    // state can already be stale. Opening also moves focus to the first
    // item, so the reader announces "expanded", the item, or both.
    const expanded = () =>
      page.evaluate(() =>
        document.querySelector('[aria-label="About Us submenu"]').getAttribute('aria-expanded'),
      );
    const wasOpen = (await expanded()) === 'true';
    const mark = (await voiceOver.spokenPhraseLog()).length;
    await voiceOver.act();
    await expect.poll(expanded).toBe(String(!wasOpen));
    if (!wasOpen) {
      await expect.poll(() => spokenSince(voiceOver, mark)).toMatch(/expanded|our team/i);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.textContent.trim()))
        .toBe('Our Team');
    } else {
      await expect.poll(() => spokenSince(voiceOver, mark)).toMatch(/collapsed/i);
    }
  });
});
