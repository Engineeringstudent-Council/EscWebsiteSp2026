import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildIndex,
  expandSynonyms,
  globToRegExp,
  serializeIndex,
} from '../../scripts/lib/build.mjs';
import { extractPage } from '../../scripts/lib/extract.mjs';
import { isExternal, parseMenu, renderWrittenHtml, toPagePath } from '../../scripts/lib/nav.mjs';
import {
  clean,
  mergeKeywords,
  summarize,
  textFragmentUrl,
  truncate,
} from '../../scripts/lib/text.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ------------------------------------------------------------ text helpers

test('clean collapses whitespace including non-breaking spaces', () => {
  assert.equal(clean('  a \n b  '), 'a b');
  assert.equal(clean(undefined), '');
});

test('truncate cuts on word boundaries with an ellipsis', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('the quick brown fox jumps', 15), 'the quick brown…');
  assert.ok(truncate('x'.repeat(50), 10).length <= 11);
});

test('summarize keeps sentence boundaries and ignores dots in domains', () => {
  assert.equal(
    summarize(
      'Visit berkeley.edu today. Second sentence here is long enough to stop.',
      200,
    ).startsWith('Visit berkeley.edu today.'),
    true,
  );
  assert.equal(summarize(''), '');
});

test('textFragmentUrl encodes reserved characters and shortens long headings', () => {
  assert.equal(
    textFragmentUrl('a.html', 'Food, Inc - Pantry & More'),
    'a.html#:~:text=Food%2C%20Inc%20%2D%20Pantry%20%26%20More',
  );
  const long = textFragmentUrl(
    'a.html',
    'one two three four five six seven eight nine ten eleven twelve',
  );
  assert.equal(long, 'a.html#:~:text=one%20two%20three%20four,ten%20eleven%20twelve');
  assert.equal(textFragmentUrl('a.html', '  '), 'a.html');
});

test('mergeKeywords lowercases and dedupes across lists', () => {
  assert.equal(mergeKeywords('Food food', ['Pantry'], undefined), 'food pantry');
});

// ------------------------------------------------------------ nav helpers

test('renderWrittenHtml captures document.write and insertAdjacentHTML output', () => {
  assert.equal(
    renderWrittenHtml('document.write(\'<a href="x.html">X</a>\')'),
    '<a href="x.html">X</a>',
  );
  assert.equal(
    renderWrittenHtml("document.currentScript.insertAdjacentHTML('beforebegin', '<b>hi</b>')"),
    '<b>hi</b>',
  );
});

test('the real nav script renders and yields breadcrumbs', () => {
  return readFile(join(ROOT, 'assets/js/top-bar.js'), 'utf8').then((source) => {
    const entries = parseMenu(renderWrittenHtml(source), '#nav > ul');
    const housing = entries.find((e) => e.href === 'housing.html');
    assert.deepEqual(housing?.trail, ['Students', 'Life Resources']);
  });
});

test('isExternal and toPagePath classify hrefs', () => {
  assert.ok(isExternal('https://x.org') && isExternal('mailto:a@b') && isExternal('//cdn.x'));
  assert.ok(!isExternal('a.html'));
  assert.equal(toPagePath('./a.html?x=1#top'), 'a.html');
  assert.equal(toPagePath('#top'), '');
});

test('globToRegExp supports * and **', () => {
  assert.ok(globToRegExp('google*.html').test('google123.html'));
  assert.ok(!globToRegExp('google*.html').test('dir/google1.html'));
  assert.ok(globToRegExp('old_ESC/**').test('old_ESC/a/b.html'));
});

test('expandSynonyms adds whole groups for matching words only', () => {
  const groups = [
    ['funding', 'money'],
    ['food', 'pantry'],
  ];
  assert.deepEqual(expandSynonyms('Apply for Funding', groups), ['funding', 'money']);
  assert.deepEqual(expandSynonyms('Fundraiser', groups), []);
});

// ------------------------------------------------------------ extraction

test('extractPage splits sections, strips chrome, and keeps links', () => {
  const page = extractPage(`<!doctype html><html><head><title>T</title>
    <meta name="description" content="Desc"></head><body>
    <header id="header"><nav id="nav"><a href="nav.html">Nav</a></nav></header>
    <div id="main"><header class="major"><h2>Main Heading</h2></header>
      <p>Intro text.</p>
      <h3 id="pantry">Food Pantry</h3><p>Open daily.</p><script>evil()</script>
      <div style="display:none"><h3>Hidden</h3></div>
      <h3><a href="other.html">Other page</a></h3>
    </div><footer>Footer text</footer></body></html>`);
  assert.equal(page.htmlTitle, 'T');
  assert.equal(page.metaDescription, 'Desc');
  assert.equal(page.firstHeading, 'Main Heading');
  const pantry = page.sections.find((s) => s.heading === 'Food Pantry');
  assert.equal(pantry.id, 'pantry');
  assert.equal(pantry.text, 'Open daily.');
  assert.ok(!page.sections.some((s) => s.heading === 'Hidden'));
  assert.equal(page.sections.find((s) => s.heading === 'Other page').href, 'other.html');
  assert.ok(page.links.some((l) => l.href === 'nav.html'));
  assert.ok(!JSON.stringify(page).includes('evil()'));
  assert.ok(!JSON.stringify(page.sections).includes('Footer text'));
});

// ------------------------------------------------------------ full build

async function fixtureSite() {
  const root = await mkdtemp(join(tmpdir(), 'esc-index-'));
  await mkdir(join(root, 'assets/js'), { recursive: true });
  await writeFile(
    join(root, 'assets/js/top-bar.js'),
    `document.write('<nav id="nav"><ul><li><a href="#">Students</a><ul><li><a href="food.html">Food</a></li><li><a href="https://ext.example.org/">Ext</a></li></ul></li></ul></nav>');`,
  );
  await writeFile(
    join(root, 'index.html'),
    '<div id="main"><h1>Home</h1><p>Welcome. <a href="about.html">About</a></p></div>',
  );
  await writeFile(
    join(root, 'food.html'),
    '<div id="main"><h2>Food</h2><p>Free meals.</p><h3>Pantry</h3><p>Open daily.</p></div>',
  );
  await writeFile(
    join(root, 'about.html'),
    '<div id="main"><h2>About</h2><p>Who we are. <a href="missing.html">x</a></p></div>',
  );
  await writeFile(join(root, 'orphan.html'), '<div id="main"><h2>Orphan</h2></div>');
  return root;
}

test('buildIndex crawls from menus, builds page/section/link records, and reports problems', async () => {
  const root = await fixtureSite();
  try {
    const data = {
      config: {
        seeds: ['index.html'],
        menus: [{ script: 'assets/js/top-bar.js', selector: '#nav > ul' }],
      },
      pages: { 'about.html': { title: 'About ESC', keywords: 'who' } },
      links: [{ title: 'Email us', url: 'mailto:a@b.co', category: 'Contact' }],
      synonyms: [['food', 'meals']],
    };
    const { index, report } = buildIndex(root, data);
    const byId = Object.fromEntries(index.records.map((r) => [r.id, r]));
    assert.deepEqual(report.pages.sort(), ['about.html', 'food.html', 'index.html']);
    assert.deepEqual(report.missing, [{ from: 'about.html', href: 'missing.html' }]);
    assert.equal(byId['about.html'].title, 'About ESC');
    assert.deepEqual(byId['food.html'].trail, ['Students']);
    assert.match(byId['food.html'].keywords, /meals/);
    const section = index.records.find((r) => r.kind === 'section' && r.title === 'Pantry');
    assert.equal(section.url, 'food.html#:~:text=Pantry');
    assert.ok(byId['link:mailto:a@b.co']);
    assert.ok(byId['link:https://ext.example.org']);
    assert.ok(!index.records.some((r) => r.url === 'orphan.html'));
    assert.equal(index.count, index.records.length);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('buildIndex rejects bad editorial data', async () => {
  const root = await fixtureSite();
  const base = { config: { seeds: ['index.html'] }, pages: {}, links: [], synonyms: [] };
  try {
    assert.throws(
      () => buildIndex(root, { ...base, links: [{ title: 'X', url: 'javascript:alert(1)' }] }),
      /only http/,
    );
    assert.throws(
      () => buildIndex(root, { ...base, links: [{ title: 'X', url: 'about.html' }] }),
      /internal/,
    );
    assert.throws(
      () => buildIndex(root, { ...base, links: [{ url: 'https://x.org' }] }),
      /needs a title/,
    );
    assert.throws(
      () => buildIndex(root, { ...base, pages: { 'nope.html': { title: 'x' } } }),
      /not a reachable page/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('serializeIndex is stable JSON with one record per line', () => {
  const json = serializeIndex({ version: 1, count: 2, records: [{ id: 'a' }, { id: 'b' }] });
  assert.deepEqual(JSON.parse(json).records, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(json.split('\n').filter((l) => l.includes('"id"')).length, 2);
});

// ------------------------------------------------------------ the real site

test('every internal URL in the index points at a real file', async () => {
  const { records } = JSON.parse(await readFile(join(ROOT, 'assets/search/index.json'), 'utf8'));
  for (const record of records) {
    if (/^(https?:|mailto:)/.test(record.url)) continue;
    await access(join(ROOT, record.url.split('#')[0]));
  }
});

test('the vendored Fuse.js matches the installed package', async () => {
  const vendored = await readFile(join(ROOT, 'assets/js/vendor/fuse.esm.min.js'));
  const installed = await readFile(join(ROOT, 'node_modules/fuse.js/dist/fuse.min.mjs'));
  assert.ok(vendored.equals(installed), 'run `npm run vendor:fuse` after upgrading fuse.js');
});
