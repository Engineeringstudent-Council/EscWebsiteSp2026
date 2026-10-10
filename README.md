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
│   ├── build-sitemap.mjs      Writes sitemap.xml from the live pages
│   └── check-image-budget.mjs Blocks oversized images in PRs
├── tests/
│   ├── unit/                  node:test unit tests (`npm test`)
│   └── e2e/                   Playwright page, a11y, and mobile tests
└── .github/                   CI, link checker, preview deploys, templates
```

**Shared header and footer.** Every page includes `assets/js/top-bar.js` near the top of `<body>` and `assets/js/bottom-bar.js` at the bottom. To change the nav, edit `top-bar.js` once and every page picks it up.

**What counts as "live".** `scripts/site-pages.mjs` crawls links from `index.html`, the nav, and the footer. Any page it can reach is live: it gets tested, audited, and link-checked. Orphaned pages drop out automatically. Run `node scripts/site-pages.mjs` to see the list.

**Sitemap and robots.txt.** `sitemap.xml` lists exactly the live pages, minus anything marked `<meta name="robots" content="noindex">` and Google's verification file. When you add or remove a page, run `npm run build:sitemap` and commit the result; a unit test fails if you forget. `robots.txt` points crawlers at the sitemap.

**Hosting.** Production is plain nginx on the [Open Computing Facility](https://www.ocf.berkeley.edu/). Files are served exactly as committed, so whatever works under `npm run serve` works live.

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

- Tech Lead: Adriel Becerra · adbecerra@berkeley.edu
- Presidents: president@esc.studentorg.berkeley.edu

<sub>Built and maintained by the ESC Tech Committee. Made with ☕ in Etcheverry.</sub>
