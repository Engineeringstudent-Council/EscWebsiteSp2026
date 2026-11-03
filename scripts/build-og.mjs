#!/usr/bin/env node
// Link previews for every live page: a 1200×630 social card PNG in images/og/
// and a block of Open Graph / Twitter <meta> tags in the page's <head>.
//
//   npm run build:og                 render changed cards and refresh every block
//   npm run build:og -- --force      re-render every card even if unchanged
//   npm run build:og -- --check      exit 1 if any block is missing or stale, or
//                                    a card image is missing (renders nothing)
//
// Titles, descriptions and breadcrumbs come from assets/search/index.json, so
// run `npm run build:search` first. A GitHub Action does both on every push
// to main, so teammates editing HTML never have to.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverPages } from './site-pages.mjs';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_CARD,
  OG_DIR,
  SKIP,
  cardFor,
  cardHash,
  imagePath,
  injectBlock,
} from './lib/og.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const force = args.has('--force');
const quiet = args.has('--quiet');
const log = (...line) => quiet || console.log(...line);

const TEMPLATE = path.join(root, 'scripts/og/template.html');
const LOGO = path.join(root, 'images/main_nobckgnd.png');
const MANIFEST = path.join(root, OG_DIR, 'manifest.json');
const FONTS = ['@fontsource/source-serif-4', '@fontsource/source-sans-3'];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16);

/** Everything besides the text that changes a card's pixels. */
function assetFingerprint() {
  const fonts = FONTS.map((name) => {
    const pkg = JSON.parse(read(`node_modules/${name}/package.json`));
    return `${name}@${pkg.version}`;
  });
  return { template: sha(fs.readFileSync(TEMPLATE)), logo: sha(fs.readFileSync(LOGO)), fonts };
}

function loadIndex() {
  const index = JSON.parse(read('assets/search/index.json'));
  const pages = new Map(index.records.filter((r) => r.kind === 'page').map((r) => [r.url, r]));
  return pages;
}

async function render(cards) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(TEMPLATE).href);
    const logo = `data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}`;
    for (const card of cards) {
      const size = await page.evaluate((data) => window.renderCard(data), {
        title: card.cardTitle ?? card.title,
        trail: card.trail,
        logo,
      });
      const out = path.join(root, imagePath(card.slug));
      await page.screenshot({ path: out, type: 'png', animations: 'disabled' });
      const kb = fs.statSync(out).size / 1024;
      log(`  rendered ${imagePath(card.slug)} (${kb.toFixed(0)} KB, title ${size}px)`);
    }
  } finally {
    await browser.close();
  }
}

const { pages } = await discoverPages({ root });
const records = loadIndex();
const fallbackDescription = records.get('index.html')?.description ?? '';
const live = pages.filter((page) => !SKIP.has(page));
const cards = live.map((page) =>
  cardFor(page, { record: records.get(page), html: read(page), fallbackDescription }),
);

// 1. Meta blocks.
const stale = [];
for (const card of cards) {
  const before = read(card.page);
  const after = injectBlock(before, card);
  if (after === before) continue;
  stale.push(card.page);
  if (!check) fs.writeFileSync(path.join(root, card.page), after);
}

// 2. Card images. Only re-render a card when its inputs change: browsers on
// different operating systems anti-alias text slightly differently, so
// re-rendering unchanged cards would churn binary files for no reason.
const assets = assetFingerprint();
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const all = [{ ...DEFAULT_CARD }, ...cards];
const hashes = Object.fromEntries(all.map((card) => [card.slug, cardHash(card, assets)]));
const missing = all.filter((card) => !fs.existsSync(path.join(root, imagePath(card.slug))));
const outdated = all.filter((card) => manifest.cards?.[card.slug] !== hashes[card.slug]);

log(
  `link previews: ${cards.length} pages (skipped ${[...SKIP.keys()].join(', ')}), ` +
    `${stale.length} blocks ${check ? 'stale' : 'updated'}, ${outdated.length} cards to render`,
);

if (check) {
  for (const page of stale) console.error(`  ✗ ${page}: link-preview block is missing or stale`);
  for (const card of missing) console.error(`  ✗ ${imagePath(card.slug)} does not exist`);
  for (const card of outdated) {
    if (!missing.includes(card)) log(`  ! ${imagePath(card.slug)} is older than its inputs`);
  }
  if (stale.length || missing.length) {
    console.error('\nLink previews are out of date. Run `npm run build:og` and commit the result.');
    process.exit(1);
  }
  log('  link previews are up to date ✓');
} else {
  fs.mkdirSync(path.join(root, OG_DIR), { recursive: true });
  const todo = force
    ? all
    : all.filter((card) => missing.includes(card) || outdated.includes(card));
  if (todo.length) await render(todo);

  // Remove cards for pages that are no longer live.
  const keep = new Set(all.map((card) => `${card.slug}.png`));
  for (const file of fs.readdirSync(path.join(root, OG_DIR))) {
    if (file.endsWith('.png') && !keep.has(file)) {
      fs.rmSync(path.join(root, OG_DIR, file));
      log(`  removed ${OG_DIR}/${file}`);
    }
  }

  const next = { version: 1, assets, cards: hashes };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);
  for (const page of stale) log(`  updated ${page}`);
}
