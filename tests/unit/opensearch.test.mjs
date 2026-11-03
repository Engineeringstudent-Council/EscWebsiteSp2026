// opensearch.xml lets browsers add the site as an address-bar search engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = 'https://esc.studentorg.berkeley.edu';
const xml = readFileSync(join(ROOT, 'opensearch.xml'), 'utf8');
const $ = cheerio.load(xml, { xml: true });

function hasXmllint() {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test(
  'opensearch.xml is well-formed XML',
  { skip: !hasXmllint() && 'xmllint not installed' },
  () => {
    execFileSync('xmllint', ['--noout', join(ROOT, 'opensearch.xml')], { stdio: 'pipe' });
  },
);

test('opensearch.xml is an OpenSearch 1.1 description with the required fields', () => {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  const root = $('OpenSearchDescription');
  assert.equal(root.length, 1);
  assert.equal(root.attr('xmlns'), 'http://a9.com/-/spec/opensearch/1.1/');
  const shortName = $('ShortName').text();
  assert.equal(shortName, 'ESC Berkeley');
  assert.ok(shortName.length <= 16, 'ShortName is at most 16 characters');
  const description = $('Description').text();
  assert.ok(description.length > 0 && description.length <= 1024);
  assert.equal($('InputEncoding').text(), 'UTF-8');
});

test('the search URL uses the production origin and {searchTerms}', () => {
  const html = $('Url[type="text/html"]');
  assert.equal(html.length, 1);
  assert.equal(html.attr('template'), `${SITE}/?search={searchTerms}`);
  // It must match the origin the search index is built for.
  const index = JSON.parse(readFileSync(join(ROOT, 'assets/search/index.json'), 'utf8'));
  assert.equal(new URL(html.attr('template').replace('{searchTerms}', 'x')).origin, index.site);
  assert.equal(
    $('Url[rel="self"]').attr('template'),
    `${SITE}/opensearch.xml`,
    'self link points at this file',
  );
  assert.equal($('moz\\:SearchForm').text(), `${SITE}/`);
});

test('every icon points at a file that exists', () => {
  const images = $('Image');
  assert.ok(images.length >= 1);
  images.each((_, el) => {
    const url = $(el).text().trim();
    assert.ok(url.startsWith(`${SITE}/`), url);
    assert.ok(existsSync(join(ROOT, url.slice(SITE.length + 1))), url);
    assert.ok(Number($(el).attr('width')) > 0 && Number($(el).attr('height')) > 0);
  });
});

test('the homepage advertises the description', () => {
  const home = cheerio.load(readFileSync(join(ROOT, 'index.html'), 'utf8'));
  const link = home('head link[rel="search"]');
  assert.equal(link.length, 1);
  assert.equal(link.attr('type'), 'application/opensearchdescription+xml');
  assert.equal(link.attr('title'), 'ESC Berkeley');
  assert.equal(link.attr('href'), 'opensearch.xml');
});
