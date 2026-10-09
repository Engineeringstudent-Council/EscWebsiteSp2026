# Contributing

Welcome to the Tech Committee! Here's how to go from zero to your first merged change.

## One-time setup

1. Make sure you've been added to the GitHub org. If not, DM the tech lead.
2. Install [Node.js 22](https://nodejs.org/) (`nvm use` picks the version from `.nvmrc`).
3. Clone the repo and install the dev tools:
   ```bash
   git clone https://github.com/Engineeringstudent-Council/EscWebsiteSp2026.git
   cd EscWebsiteSp2026
   npm install
   npx playwright install chromium   # only needed for end-to-end tests
   ```
4. Start the site with `npm run serve` and open http://localhost:8080.

## Making a change

1. **Branch off `main`** using a short name for your task:
   ```bash
   git switch main && git pull
   git switch -c exec-tab        # or opportunities-tab, fix-search-console, ...
   ```
2. **Edit, then check it in the browser.** Look at desktop _and_ a narrow window, because many visitors are on phones.
3. **Commit in small steps** with messages that say what the commit does, in the imperative:
   - ✅ `Add committee descriptions to the exec tab`
   - ❌ `updates`, `fixed stuff`, `Add files via upload`
4. **Push and open a PR.** Fill in the template and add screenshots for visual changes.
5. **CI runs automatically.** If a check fails, open its log; the error message says what to fix. Ask in Slack if it doesn't make sense.
6. A reviewer approves the PR, then it gets merged. 🎉

## Running checks yourself

```bash
npm test                 # unit tests (fast)
npm run test:e2e         # every page in a real browser, plus accessibility
npm run lint             # code style for scripts and tests
npm run format           # auto-fix code style
```

## House rules

- **Images:** keep each one under 1 MB (CI enforces this) and under about 2000px on the long edge. [Squoosh](https://squoosh.app) makes this easy.
- **New pages:** copy an existing page so you get the shared header and footer, then link it from the nav (`assets/js/top-bar.js`) or another page so it counts as live.
- **Don't reformat files you didn't otherwise change.** Teammates are probably editing them, and whitespace-only diffs cause merge conflicts.
- **Accessibility:** give images real `alt` text, use headings in order, and make sure links say where they go. CI fails if a page gets worse.
- **Never commit secrets** (API keys, passwords). Ask the tech lead about repo secrets.
