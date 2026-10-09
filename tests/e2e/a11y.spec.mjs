// Accessibility ratchet. axe-core audits every live page against WCAG 2.1
// A/AA. Legacy pages have known violations, so the committed baseline
// records the count of affected elements per rule per page; CI fails if
// a page gains a new rule violation or more failing elements for a rule.
import { test, expect } from './fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { writeBaselineIfRequested } from './baseline.mjs';

const { pages } = await discoverPages();
const BASELINE = 'tests/e2e/baselines/a11y.json';
const known = JSON.parse(readFileSync(BASELINE, 'utf8'));
const observed = {};

/** Parse "rule-id:count" entries into a map. */
const toCounts = (entries = []) =>
  Object.fromEntries(
    entries.map((e) => [e.slice(0, e.lastIndexOf(':')), Number(e.split(':').pop())]),
  );

for (const page of pages) {
  test(`${page} has no new accessibility violations`, async ({ page: tab }) => {
    await tab.goto(page, { waitUntil: 'load' });
    const { violations } = await new AxeBuilder({ page: tab })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Third-party embeds (Google Calendar/Docs/Forms) are outside our control.
      .exclude('iframe')
      .analyze();

    const entries = violations.map((v) => `${v.id}:${v.nodes.length}`).sort();
    observed[page] = entries;

    const before = toCounts(known[page]);
    const regressions = violations
      .filter((v) => v.nodes.length > (before[v.id] ?? 0))
      .map((v) => ({
        rule: v.id,
        impact: v.impact,
        help: v.help,
        was: before[v.id] ?? 0,
        now: v.nodes.length,
        example: v.nodes[0]?.target?.join(' '),
      }));
    expect(
      regressions,
      `accessibility regressions on ${page} (rule docs: https://dequeuniversity.com/rules/axe/)`,
    ).toEqual([]);
  });
}

test.afterAll(() => writeBaselineIfRequested(BASELINE, observed));
