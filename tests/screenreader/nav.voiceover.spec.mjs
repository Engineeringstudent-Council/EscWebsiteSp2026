// VoiceOver (macOS) walks the site nav the way a blind visitor would.
import { voiceOverTest as test } from '@guidepup/playwright';
import { expect } from '@playwright/test';
import { moveUntil, openPage, spokenSince } from './helpers.mjs';

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

    // Back to the About Us disclosure button: named, a button, collapsed.
    const button = await moveUntil(voiceOver, () => voiceOver.previous(), /about us submenu/i);
    expect(button).toMatch(/collapsed/i);

    // Activating it expands the menu, and its first item follows.
    const mark = (await voiceOver.spokenPhraseLog()).length;
    await voiceOver.act();
    await expect.poll(() => spokenSince(voiceOver, mark)).toMatch(/expanded/i);
    await moveUntil(voiceOver, next, /our team/i, 10);
  });
});
