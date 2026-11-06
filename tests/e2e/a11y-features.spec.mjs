// Accessibility that axe can't see on its own. Each test names the WCAG 2.2
// success criterion it guards. a11y.spec.mjs covers everything axe can
// check; this file covers how the site behaves for keyboard users, people
// who zoom or space out text, people who turn off motion, and people using
// Windows High Contrast.
import { test, expect, pressTab } from './fixtures.mjs';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { settle } from './lib/axe.mjs';
import { walkFocus } from './lib/focus.mjs';
import { NEW_TAB_TEXT } from '../../assets/js/site/a11y.js';

const { pages } = await discoverPages();

test.describe.configure({ mode: 'parallel' });

async function open(page, path) {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-esc-a11y', 'ready');
  await settle(page);
}

/** Facts about the page's structure, gathered in one round trip. */
const structure = (page) =>
  page.evaluate(() => {
    const footer = document.querySelector('#footer');
    const main = document.querySelectorAll('main, [role="main"]');
    const name = (a) => (a.getAttribute('aria-label') ?? a.textContent).replace(/\s+/g, ' ');
    return {
      lang: document.documentElement.lang,
      viewport: document.querySelector('meta[name="viewport"]')?.content ?? '',
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      mains: main.length,
      footerInsideMain: !!(footer && main[0]?.contains(footer)),
      untitledFrames: [...document.querySelectorAll('iframe')]
        .filter((f) => !f.title.trim())
        .map((f) => f.src),
      unannouncedNewTabs: [...document.querySelectorAll('a[target="_blank"]')]
        .filter((a) => !/new tab|new window/i.test(name(a)) || !/noopener/.test(a.rel))
        .map((a) => a.outerHTML.slice(0, 120)),
      footerLinksToStatement: !!footer?.querySelector('a[href$="accessibility.html"]'),
    };
  });

for (const path of pages) {
  test(`${path}: language, zoom, landmarks, headings, frames, and new-tab links`, async ({
    page,
  }) => {
    await open(page, path);
    const s = await structure(page);
    // 3.1.1 Language of Page.
    expect(s.lang, 'html lang').toBe('en');
    // 1.4.4 Resize Text: pinch zoom must never be switched off.
    expect(s.viewport, 'viewport meta').not.toMatch(
      /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/,
    );
    // 1.3.1 and 2.4.1: one main landmark, with the footer outside it.
    expect(s.mains, 'main landmarks').toBe(1);
    expect(s.footerInsideMain, 'footer inside main').toBe(false);
    // 2.4.6: exactly one top-level heading, and it says something.
    expect(s.h1, 'h1 headings').toHaveLength(1);
    expect(s.h1[0], 'h1 text').toMatch(/\w/);
    // 4.1.2: every embed is named.
    expect(s.untitledFrames, 'iframes without a title').toEqual([]);
    // 3.2.5: links that open a new tab say so.
    expect(s.unannouncedNewTabs, 'new-tab links that do not say so').toEqual([]);
    expect(s.footerLinksToStatement, 'footer links to the accessibility statement').toBe(true);
  });

  // 2.4.7 Focus Visible and 2.4.11 Focus Not Obscured: Tab through the page;
  // every stop must show a focus ring and must not sit under the fixed header.
  test(`${path}: every keyboard stop is visible and not hidden by the header`, async ({ page }) => {
    await open(page, path);
    const { problems, stops } = await walkFocus(page);
    expect(stops, 'keyboard stops reached').toBeGreaterThan(3);
    expect(problems).toEqual([]);
  });

  // 1.4.12 Text Spacing: with the spacing WCAG asks pages to survive, no text
  // is cut off and the page doesn't scroll sideways.
  test(`${path}: survives increased text spacing`, async ({ page }) => {
    await open(page, path);
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`,
    });
    const clipped = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (!/hidden|clip/.test(cs.overflowX + cs.overflowY)) continue;
        if (el.closest('.visually-hidden, .dropotron, #navPanel, [aria-hidden="true"], iframe'))
          continue;
        if (el.matches('.icon > .label, .esc-nav-toggle, .esc-skip-link')) continue;
        if (el.offsetWidth <= 2 || el.offsetHeight <= 2) continue;
        // Icon links that push their text out of view on purpose (the
        // template's "Next" arrows) are named for screen readers, not clipped.
        if (Math.abs(parseFloat(cs.textIndent)) >= 100) continue;
        const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!text) continue;
        if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
          out.push(el.outerHTML.slice(0, 120));
        }
      }
      return out;
    });
    expect(clipped, 'text cut off by increased spacing').toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'sideways scroll with increased spacing').toBeLessThanOrEqual(1);
  });
}

// 2.3.3 Animation from Interactions: asking the system for less motion
// turns off every transition and animation on the site.
test('reduced motion turns off transitions and animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about.html', { waitUntil: 'load' });
  const moving = await page.evaluate(() => {
    const seconds = (v) =>
      Math.max(
        ...v
          .split(',')
          .map((t) => (t.trim().endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t))),
      );
    return [...document.querySelectorAll('*')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return seconds(cs.transitionDuration) > 0.001 || seconds(cs.animationDuration) > 0.001;
      })
      .map((el) => el.tagName + (el.id ? `#${el.id}` : ''));
  });
  expect(moving).toEqual([]);
});

// 1.4.11 and 2.4.7 in Windows High Contrast: focus rings and button edges
// survive forced colours, which strip backgrounds and box shadows.
test('focus rings and buttons survive forced colours', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page, 'events.html');
  // Tab into the page content, the way a keyboard user gets there.
  let inMain = false;
  for (let i = 0; i < 60 && !inMain; i += 1) {
    await pressTab(page);
    inMain = await page.evaluate(() => !!document.activeElement?.closest('main a[href]'));
  }
  expect(inMain, 'reached a link in the page content').toBe(true);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe('none');
  const border = await page
    .locator('.button')
    .first()
    .evaluate((el) => getComputedStyle(el).borderTopStyle);
  expect(border).not.toBe('none');
});

test('links added after load are announced too', async ({ page }) => {
  await open(page, 'about.html');
  const name = await page.evaluate(async () => {
    const a = Object.assign(document.createElement('a'), {
      href: 'https://example.org/',
      target: '_blank',
      textContent: 'Example',
    });
    document.querySelector('main').append(a);
    await new Promise((r) => setTimeout(r, 0));
    return { text: a.textContent, rel: a.rel };
  });
  expect(name.text).toBe(`Example${NEW_TAB_TEXT}`);
  expect(name.rel).toContain('noopener');
  // Labelled links get the hint in their label, once.
  const label = await page.evaluate(async () => {
    const a = Object.assign(document.createElement('a'), { href: '#', target: '_blank' });
    a.setAttribute('aria-label', 'Map');
    document.querySelector('main').append(a);
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector('main').append(a);
    await new Promise((r) => setTimeout(r, 0));
    return a.getAttribute('aria-label');
  });
  expect(label).toBe(`Map${NEW_TAB_TEXT}`);
});
