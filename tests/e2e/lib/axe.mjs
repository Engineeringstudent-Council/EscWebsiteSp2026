// Shared axe-core setup for the accessibility suites. Every live page is
// held to WCAG 2.2 A and AA plus Deque's best-practice rules, with zero
// violations allowed. The rule docs linked in each failure explain the fix.
import AxeBuilder from '@axe-core/playwright';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/**
 * Wait for the template's load-in fade (body.is-preload) and any other
 * finite CSS animation to finish, so colour contrast is measured on the
 * page people actually read rather than mid-fade.
 */
export async function settle(page) {
  // main.js lifts is-preload shortly after load; pages without main.js never
  // had it, so a slow lift should not hang the suite.
  await page
    .waitForFunction(() => !document.body.classList.contains('is-preload'), null, {
      timeout: 10_000,
    })
    .catch(() => {});
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}

/**
 * Run axe on the page as it is now and return its violations in a form
 * that reads well in a failed assertion.
 */
export async function axeViolations(page, { include, exclude } = {}) {
  await settle(page);
  let builder = new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    // Third-party embeds (Google Calendar, Docs, Forms) are blocked in tests
    // and are outside our control. a11y-features.spec.mjs still checks that
    // every <iframe> has a title.
    .exclude('iframe');
  for (const selector of [include ?? []].flat()) builder = builder.include(selector);
  for (const selector of [exclude ?? []].flat()) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  return violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: `${v.help} (${v.helpUrl.split('?')[0]})`,
    count: v.nodes.length,
    examples: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}
