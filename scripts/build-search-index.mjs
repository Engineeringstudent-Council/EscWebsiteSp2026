#!/usr/bin/env node
// Regenerates assets/search/index.json from the site's HTML.
//
//   npm run build:search          write the index
//   npm run check:search          exit 1 if the committed index is stale
//
// Teammates who edit HTML don't have to run this: a GitHub Action rebuilds and
// commits the index on every push to main.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, serializeIndex } from './lib/build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets', 'search', 'index.json');
const check = process.argv.includes('--check');
const quiet = process.argv.includes('--quiet');

const { index, report } = buildIndex(root);
const json = serializeIndex(index);

const log = (...args) => quiet || console.log(...args);
const kinds = index.records.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
log(
  `search index: ${report.pages.length} pages → ${index.count} records (${Object.entries(kinds)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')}), ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`,
);
for (const { from, href } of report.missing)
  console.warn(`  ! broken link in ${from}: ${href} does not exist`);
if (report.skipped.length) log(`  skipped (excluded or noindex): ${report.skipped.join(', ')}`);

if (check) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (current !== json) {
    console.error(
      '\nassets/search/index.json is out of date. Run `npm run build:search` and commit the result.',
    );
    process.exit(1);
  }
  log('  index is up to date ✓');
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json);
  log(`  wrote ${path.relative(root, out)}`);
}
