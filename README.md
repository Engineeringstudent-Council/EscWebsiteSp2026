# Engineering Student Council · Website

> The front door for Berkeley engineers: club funding, Blue & Gold, E-Week, and student resources.

[![CI](https://github.com/Engineeringstudent-Council/EscWebsiteSp2026/actions/workflows/ci.yml/badge.svg)](https://github.com/Engineeringstudent-Council/EscWebsiteSp2026/actions/workflows/ci.yml)
![static site](https://img.shields.io/badge/stack-plain%20HTML%20%2B%20CSS%20%2B%20JS-002676)
![hosted on OCF](https://img.shields.io/badge/hosted%20on-OCF-FDB515)
![a11y ratchet](https://img.shields.io/badge/a11y-axe%20ratchet-3b7a57)

**Live:** <https://esc.studentorg.berkeley.edu> (`esc.berkeley.edu` redirects there)

`#berkeley` `#student-government` `#static-site` `#html` `#playwright` `#github-actions`

---

## Run it locally

No build step and no framework. The files in this repo are the website.

```bash
npm install        # dev tools only: linters, tests (the site itself has zero npm deps)
npm run serve      # → http://localhost:8080
```

To edit a page, open the `.html` file, change it, and refresh the browser. That's the whole workflow.

## How the site is put together

```
.
├── index.html                 Homepage (2026–27 redesign)
├── *.html                     One file per page, all at the root
├── assets/
│   ├── css/main.css           Site-wide styles (HTML5 UP "Landed" base)
│   ├── js/top-bar.js          Shared nav, injected into every page
│   ├── js/bottom-bar.js       Shared footer
│   └── js/main.js             Dropdowns, mobile nav panel, parallax
├── images/                    Photos and logos (keep each under 1 MB)
├── scripts/                   Dev tooling, never served to visitors
│   ├── serve.mjs              Local static server that mirrors production
│   ├── site-pages.mjs         Finds every live page by crawling from the nav
│   └── check-image-budget.mjs Blocks oversized images in PRs
├── tests/
│   ├── unit/                  node:test unit tests (`npm test`)
│   └── e2e/                   Playwright page, a11y, and mobile tests
└── .github/                   CI, link checker, preview deploys, templates
```

**Shared header and footer.** Every page includes `assets/js/top-bar.js` near the top of `<body>` and `assets/js/bottom-bar.js` at the bottom. To change the nav, edit `top-bar.js` once and every page picks it up.

**What counts as "live".** `scripts/site-pages.mjs` crawls links from `index.html`, the nav, and the footer. Any page it can reach is live: it gets tested, audited, and link-checked. Orphaned pages drop out automatically. Run `node scripts/site-pages.mjs` to see the list.

**Hosting.** Production is plain nginx on the [Open Computing Facility](https://www.ocf.berkeley.edu/). Files are served exactly as committed, so whatever works under `npm run serve` works live.

## Site search

Every page has a search palette. Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> or <kbd>/</kbd>, click **Search** in the nav, tap the 🔍 in the phone title bar, or use the search field on the homepage. Links like `/?search=funding` open it pre-filled.

```
HTML pages ──► scripts/build-search-index.mjs ──► assets/search/index.json ──► assets/js/search/ui.js
 + nav menu        crawl, split into sections,        ~150 records,                lazy-loads Fuse.js + index
 + data/search/    breadcrumbs, synonyms              one per line                 on first intent, renders palette
```

- **Index.** `npm run build:search` crawls every live page and records each page, each section (a heading plus its text), and each curated external link. Section results deep-link with [text fragments](https://developer.mozilla.org/en-US/docs/Web/URI/Fragment/Text_fragments), so a click on "CalFresh" scrolls to and highlights that heading. The nav menu supplies the breadcrumbs ("Students › Life Resources").
- **Editorial data** in `data/search/`:
  - `pages.json` fixes titles and breadcrumbs, and adds keywords and ranking boosts. `featured` pages show under "Popular".
  - `links.json` holds external destinations (forms, portals, email) in the `{ title, url, description, keywords }` format.
  - `synonyms.json` holds groups like `money ↔ funding ↔ grant` and `rso ↔ club ↔ org`.
- **Ranking** (`assets/js/search/core.js`): [Fuse.js](https://www.fusejs.io/) fuzzy-matches titles, keywords, and descriptions, so typos like "fnding" still work. Body text uses a fast exact-word pass, which is about 10× faster than fuzzy-matching long text. Long natural phrases ("money for my club") fall back to Fuse token search. Pages beat their own sections, and weak matches past the top three are dropped.
- **Accessibility.** The palette is a native `<dialog>` and follows the [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). It respects reduced motion and dark mode.
- **Zero-result telemetry (off by default).** An optional Cloudflare Worker in [`workers/search-telemetry/`](workers/search-telemetry/README.md) counts the searches that find nothing, so we can see what students look for and fill the gaps. It stores only the cleaned-up query and a daily count, never IPs or cookies. It turns on only when a page has the `esc-search-telemetry` meta tag.
- **You don't need to rebuild the index by hand.** [`search-index.yml`](.github/workflows/search-index.yml) rebuilds and commits it whenever HTML changes on `main`. PRs get a warning if the index is stale.

| Command                | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run build:search` | Rebuild `assets/search/index.json`                                            |
| `npm run check:search` | Exit 1 if the committed index is stale                                        |
| `npm run test:stress`  | Fuzzing (5,000 random queries), XSS payloads, and a 10k-record latency budget |
| `npm run vendor:fuse`  | Copy Fuse.js from `node_modules` after a Dependabot upgrade                   |

The golden relevance tests in `tests/unit/search-relevance.test.mjs` pin queries real students type ("free food", "b&g", "mental health") to the page they need. If one fails, fix the ranking or the data, not the test.

## Quality gates

Every PR runs these checks in [`ci.yml`](.github/workflows/ci.yml):

| Check                     | What it catches                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Lint**                  | ESLint + Prettier on modern code (scripts, tests, search). Legacy files are left alone on purpose.                                  |
| **Unit tests**            | `node --test` over `tests/unit/`.                                                                                                   |
| **Page smoke tests**      | Every live page loads with a 200, renders the header, and adds no new script errors or missing files.                               |
| **Accessibility ratchet** | axe-core (WCAG 2.1 AA) on every live page. Known issues are recorded in a baseline, and a PR fails only if it makes a page _worse_. |
| **Mobile**                | The e2e suite also runs on a Pixel 7 viewport.                                                                                      |
| **Lighthouse**            | Performance, accessibility, SEO, and layout-shift budgets on key pages. Reports are uploaded as artifacts.                          |
| **Image budget**          | Rejects newly added images over 1 MB.                                                                                               |

There are also two scheduled or optional workflows:

- **[Link check](.github/workflows/links.yml)** runs every Monday and keeps one "Broken links report" issue up to date.
- **[Preview deploys](.github/workflows/preview.yml)** give every PR its own Cloudflare Pages URL once a repo admin adds the Cloudflare secrets.
- **Dependabot** keeps dev tooling and Actions current.

### The ratchet, explained

The site is years old and has a backlog of accessibility issues and broken assets. Blocking every PR on that backlog would stall everyone, and ignoring it lets it grow. So `tests/e2e/baselines/` records the current state, and CI only fails on regressions. After you fix something, lock in the win:

```bash
npm run baseline:update
git add tests/e2e/baselines && git commit -m "Lower accessibility baseline"
```

The baseline should only ever shrink.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md), which covers branches, commits, PRs, and how to get your first change merged. If you get stuck, ask in Slack or DM the tech lead.

## Contacts

- Tech Lead: Adriel Becerra · adbecerra@berkeley.edu || technical@esc.studentorg.berkeley.edu
- Presidents: president@esc.studentorg.berkeley.edu

<sub>Built and maintained by the ESC Tech Committee. Made with ☕ in Etcheverry.</sub>
