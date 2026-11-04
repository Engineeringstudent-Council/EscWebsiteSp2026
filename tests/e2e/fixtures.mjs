// Shared test fixture: third-party requests (Google embeds, fonts, social
// widgets) are blocked so suites are fast, deterministic, and only exercise
// code that lives in this repo. Lighthouse covers real-world loading.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL).origin;
    await page.route(
      (url) => url.origin !== origin && url.protocol.startsWith('http'),
      (route) => route.abort('blockedbyclient'),
    );
    await use(page);
  },
});

export { expect };

/**
 * Press Tab the way a keyboard user of this browser would. Safari (WebKit)
 * only moves Tab between form controls and buttons by default; reaching links
 * takes Option+Tab unless the user turns on "Press Tab to highlight each item".
 */
export async function pressTab(page, { shift = false } = {}) {
  const engine = page.context().browser()?.browserType().name();
  const keys = [shift && 'Shift', engine === 'webkit' && 'Alt', 'Tab'].filter(Boolean);
  await page.keyboard.press(keys.join('+'));
}
