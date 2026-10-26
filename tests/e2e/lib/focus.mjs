// Walks a page with the Tab key and reports every stop that has no visible
// focus ring (WCAG 2.4.7) or that sits hidden under the fixed header or phone
// title bar (WCAG 2.4.11). Shared by the desktop and phone feature suites.
import { pressTab } from '../fixtures.mjs';

/** Facts about the focused element, evaluated in the page. */
function inspect() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const id =
    el.tagName +
    (el.id ? `#${el.id}` : '') +
    (el.getAttribute('href') ? `[href="${el.getAttribute('href')}"]` : '') +
    `@${[...document.querySelectorAll('*')].indexOf(el)}`;
  const cs = getComputedStyle(el);
  const ring =
    (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) ||
    (cs.boxShadow !== 'none' && cs.boxShadow !== '');
  const r = el.getBoundingClientRect();
  const header = [...document.querySelectorAll('#header, #titleBar')].find((h) => {
    const hs = getComputedStyle(h);
    return hs.position === 'fixed' && hs.display !== 'none' && h.offsetHeight > 0;
  });
  const covered =
    !!header &&
    !header.contains(el) &&
    !el.closest('.dropotron, #navPanel, .esc-skip-link') &&
    r.bottom <= header.getBoundingClientRect().bottom + 1;
  return {
    id,
    ring,
    covered,
    frame: el.tagName === 'IFRAME',
    label: el.outerHTML.slice(0, 100),
  };
}

export async function walkFocus(page, { max = 120 } = {}) {
  const problems = [];
  const seen = new Set();
  for (let step = 0; step < max; step += 1) {
    await pressTab(page);
    let stop = await page.evaluate(inspect);
    // Tabbing from one embed straight into the next fires no event in the
    // page, so assets/js/site/a11y.js re-checks every 100ms; allow for that.
    if (stop && !stop.ring && stop.frame) {
      await page.waitForTimeout(250);
      stop = await page.evaluate(inspect);
    }
    if (!stop || seen.has(stop.id)) break;
    seen.add(stop.id);
    if (!stop.ring) problems.push(`no visible focus ring: ${stop.label}`);
    if (stop.covered) problems.push(`hidden under the header: ${stop.label}`);
  }
  return { problems, stops: seen.size };
}
