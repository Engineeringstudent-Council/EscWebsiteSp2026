// Every live page must load and render its shared header. Uncaught script
// errors and requests for missing local files are compared against
// committed baselines: pre-existing breakage is tracked, new breakage fails.
import { test, expect } from './fixtures.mjs';
import { readFileSync } from 'node:fs';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { compareToBaseline, writeBaselineIfRequested } from './baseline.mjs';

const { pages } = await discoverPages();
const ASSETS = 'tests/e2e/baselines/missing-assets.json';
const ERRORS = 'tests/e2e/baselines/page-errors.json';
const knownAssets = JSON.parse(readFileSync(ASSETS, 'utf8'));
const knownErrors = JSON.parse(readFileSync(ERRORS, 'utf8'));
const observedAssets = {};
const observedErrors = {};

test.describe.configure({ mode: 'parallel' });

for (const page of pages) {
  test(`${page} loads cleanly`, async ({ page: tab, baseURL }, info) => {
    test.skip(info.project.name !== 'desktop', 'asset checks run once, on desktop');
    const errors = new Set();
    const missing = new Set();
    tab.on('pageerror', (err) => errors.add(err.message));
    tab.on('response', (res) => {
      const url = new URL(res.url());
      if (url.origin === new URL(baseURL).origin && res.status() === 404) {
        missing.add(decodeURIComponent(url.pathname));
      }
    });

    const res = await tab.goto(page, { waitUntil: 'load' });
    expect(res?.status(), 'HTTP status').toBe(200);
    await expect(tab.locator('#logo')).toBeVisible();
    await expect(tab).toHaveTitle(/\S/);

    observedErrors[page] = [...errors].sort();
    observedAssets[page] = [...missing].sort();
    expect(
      compareToBaseline(knownErrors[page] ?? [], observedErrors[page]),
      `new uncaught script errors on ${page}`,
    ).toEqual([]);
    expect(
      compareToBaseline(knownAssets[page] ?? [], observedAssets[page]),
      `new missing local files on ${page}`,
    ).toEqual([]);
  });
}

test.afterAll(() => {
  writeBaselineIfRequested(ASSETS, observedAssets);
  writeBaselineIfRequested(ERRORS, observedErrors);
});
