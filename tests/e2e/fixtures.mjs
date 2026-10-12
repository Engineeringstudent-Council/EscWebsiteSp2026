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
