// Every live page must pass axe-core with zero violations: WCAG 2.2 A and
// AA plus best practices. Until October 2026 this was a ratchet over a
// baseline of about 1,240 known problems; the sweep fixed them all, so the
// baseline is gone and any new problem fails CI. a11y.mobile.spec.mjs runs
// the same audit in the phone layout.
import { test, expect } from './fixtures.mjs';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { axeViolations } from './lib/axe.mjs';

const { pages } = await discoverPages();

test.describe.configure({ mode: 'parallel' });

for (const page of pages) {
  test(`${page} has no accessibility violations`, async ({ page: tab }) => {
    await tab.goto(page, { waitUntil: 'load' });
    expect(await axeViolations(tab), `axe violations on ${page}`).toEqual([]);
  });
}
