# Accessibility

Every live page on this site passes WCAG 2.2 Level AA with **zero** automated violations, at desktop and phone sizes, and CI keeps it that way. This page explains what's tested and how to keep your change passing. The public promise to visitors is [accessibility.html](../accessibility.html).

## What CI checks

| Suite                                                     | What it holds every live page to                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/a11y-static.test.mjs`                         | The HTML source: `lang="en"`, zoom allowed, a unique `<title>`, one `<main id="main">` and one `<h1>`, `alt` on every image, a `title` on every embed, no `href="#"`, no positive `tabindex`, unique ids, and the shared footer. Runs in under a second.                              |
| `tests/e2e/a11y.spec.mjs`                                 | [axe-core](https://github.com/dequelabs/axe-core) with WCAG 2.2 A and AA plus best-practice rules, desktop layout, zero violations.                                                                                                                                                   |
| `tests/e2e/a11y.mobile.spec.mjs`                          | The same audit on a Pixel 7, plus the phone menu while it's open.                                                                                                                                                                                                                     |
| `tests/e2e/a11y-features.spec.mjs`                        | What axe can't see: every Tab stop shows a focus ring and isn't hidden under the fixed header (2.4.7, 2.4.11); text survives wider spacing (1.4.12); reduced motion stops all animation (2.3.3); focus rings and buttons survive Windows High Contrast; new-tab links say so (3.2.5). |
| `tests/e2e/nav-a11y*.spec.mjs`                            | The keyboard and touch menus, skip link, and `aria-current`.                                                                                                                                                                                                                          |
| [Screen readers](../.github/workflows/screen-readers.yml) | Real VoiceOver and NVDA reading the nav.                                                                                                                                                                                                                                              |

Run them locally with `npm test` and `npm run test:e2e`. To run just one page: `npx playwright test tests/e2e/a11y -g "about.html"`.

## Checklist for a new page or a page edit

- **Copy an existing page** so you get the right `<head>`, `<main id="main">`, and shared header and footer scripts. Don't paste in an old footer; include `assets/js/bottom-bar.js`.
- **One `<h1>`**, the page title, inside `<header class="major">`. Then `<h2>`, `<h3>`, and so on, in order with no skipped levels. If a heading needs to look bigger or smaller than its level, add a size class instead of changing the level: `<h2 class="as-h3">` looks like an `<h3>`.
- **Images:** describe what matters in the picture in `alt` ("2026 executive board on the steps of Sather Gate"). Leave it empty (`alt=""`) for decoration. Never write "image" or "picture".
- **Links say where they go.** Not "click here". Link to PDFs with "(PDF)" in the text. Links that open a new tab are announced automatically.
- **Embeds:** give every `<iframe>` a `title`, such as `title="ESC events calendar (Google Calendar)"`.
- **Lists are lists:** `<li>` only inside `<ul>` or `<ol>`, and nothing but `<li>` directly inside them.
- **Colour:** text needs 4.5:1 contrast against its background (3:1 for large text). Navy `#000066` and Berkeley Blue `#002676` on white pass easily; never put white text on gold.
- **Interactive bits** (accordions, "show more", tabs) are real `<button>`s with `aria-expanded`, and they work with Enter and Space.
- **Nothing moves on its own** for more than five seconds unless there's a pause button.
- **Text in a sentence**, not in an image of text.

## Useful helpers in `assets/css/main.css`

- `.visually-hidden`: read by screen readers, invisible on screen.
- `.as-h2` through `.as-h6`: heading sizes, independent of heading level.
- The focus ring, reduced-motion, and high-contrast rules live under "Accessibility START".

## When a check fails

The failure names the page, the rule, and an example element, and axe failures link to the rule's documentation at dequeuniversity.com. Fix the page; there is no baseline to update for accessibility any more. If you think a rule is wrong for a specific case, ask in Slack before disabling anything.
