// Every live page (except the skip list) shares a proper preview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { discoverPages } from '../../scripts/site-pages.mjs';
import { SITE, SKIP, START, pageUrl, readBlock } from '../../scripts/lib/og.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const { pages } = await discoverPages({ root: ROOT });

for (const page of pages.filter((p) => !SKIP.has(p))) {
  test(`${page} has a link preview with an existing card image`, () => {
    const tags = readBlock(readFileSync(join(ROOT, page), 'utf8'));
    assert.ok(tags, 'missing link-preview block; run npm run build:og');
    assert.equal(tags['og:url'], pageUrl(page));
    assert.ok(tags['og:title'] && tags['og:description'], 'title and description are set');
    assert.equal(tags['twitter:image'], tags['og:image']);
    assert.ok(tags['og:image'].startsWith(`${SITE}/images/og/`));
    const file = join(ROOT, tags['og:image'].slice(SITE.length + 1));
    assert.ok(existsSync(file), `${file} does not exist`);
    const png = readFileSync(file);
    assert.equal(png.readUInt32BE(16), 1200, 'width');
    assert.equal(png.readUInt32BE(20), 630, 'height');
    assert.ok(statSync(file).size < 150 * 1024, 'card stays well under the image budget');
  });
}

test('skipped pages are left untouched', () => {
  for (const page of SKIP.keys()) {
    assert.ok(!readFileSync(join(ROOT, page), 'utf8').includes(START), page);
  }
});

test('the committed blocks match the current search index (npm run build:og -- --check)', async () => {
  await promisify(execFile)(process.execPath, ['scripts/build-og.mjs', '--check', '--quiet'], {
    cwd: ROOT,
  });
});
