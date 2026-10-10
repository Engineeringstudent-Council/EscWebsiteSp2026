import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  END,
  SITE,
  SITE_NAME,
  SKIP,
  START,
  cardFor,
  cardHash,
  detectEol,
  escapeAttr,
  findPlacement,
  imageUrl,
  injectBlock,
  pageUrl,
  readBlock,
  renderBlock,
  slugFor,
} from '../../scripts/lib/og.mjs';

const card = (overrides = {}) => ({
  title: 'Treasurer Training',
  trail: ['Organizations'],
  description: 'Slides and documents for treasurers.',
  url: `${SITE}/treasurertrain.html`,
  image: `${SITE}/images/og/treasurertrain.png`,
  alt: `Treasurer Training · ${SITE_NAME}`,
  ...overrides,
});

const page = (eol = '\n', indent = '\t\t') =>
  [
    '<!DOCTYPE HTML>',
    '<html>',
    `${indent.slice(1)}<head>`,
    `${indent}<title>Treasurer Training</title>`,
    `${indent}<meta charset="utf-8" />`,
    `${indent}<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `${indent}<link rel="stylesheet" href="assets/css/main.css" />`,
    `${indent.slice(1)}</head>`,
    '<body></body>',
    '</html>',
    '',
  ].join(eol);

// ------------------------------------------------------------ URLs & names

test('pageUrl serves index.html as its folder and leaves other pages alone', () => {
  assert.equal(pageUrl('index.html'), `${SITE}/`);
  assert.equal(pageUrl('about.html'), `${SITE}/about.html`);
  assert.equal(pageUrl('exec2025/index.html'), `${SITE}/exec2025/`);
  assert.equal(pageUrl('my page.html'), `${SITE}/my%20page.html`);
});

test('slugFor makes file-safe card names', () => {
  assert.equal(slugFor('about.html'), 'about');
  assert.equal(slugFor('fin-decisions.html'), 'fin-decisions');
  assert.equal(slugFor('exec2025/index.html'), 'exec2025--index');
  assert.equal(slugFor('My Page!.html'), 'My-Page-');
  assert.equal(imageUrl('about'), `${SITE}/images/og/about.png`);
});

test('the pages teammates are editing are skipped', () => {
  assert.ok(SKIP.has('execs.html'));
  assert.ok(SKIP.has('committees.html'));
  assert.ok(!SKIP.has('index.html'));
});

// ------------------------------------------------------------ card content

test('cardFor prefers the search index, then the page head', () => {
  const html = '<head><title>Raw Title</title><meta name="description" content="Raw."></head>';
  const fromIndex = cardFor('food.html', {
    record: { title: 'Food Security', trail: ['Students', 'Life Resources'], description: 'Hi.' },
    html,
  });
  assert.equal(fromIndex.title, 'Food Security');
  assert.deepEqual(fromIndex.trail, ['Students', 'Life Resources']);
  assert.equal(fromIndex.description, 'Hi.');
  assert.equal(fromIndex.image, `${SITE}/images/og/food.png`);

  const fromHead = cardFor('new.html', { html, fallbackDescription: 'Default.' });
  assert.equal(fromHead.title, 'Raw Title');
  assert.equal(fromHead.description, 'Raw.');
  assert.deepEqual(fromHead.trail, []);

  const bare = cardFor('bare.html', { html: '<head></head>', fallbackDescription: 'Default.' });
  assert.equal(bare.title, 'Engineering Student Council');
  assert.equal(bare.description, 'Default.');
});

test('the homepage previews as the council itself, not as "Home"', () => {
  const home = cardFor('index.html', { record: { title: 'Home', trail: [], description: 'D' } });
  assert.equal(home.title, SITE_NAME);
  assert.equal(home.cardTitle, 'Engineering Student Council');
  assert.equal(home.url, `${SITE}/`);
});

test('cardHash changes with the words on the card and the assets, not the description', () => {
  const assets = { template: 'a' };
  const base = cardHash(card(), assets);
  assert.equal(base, cardHash(card({ description: 'Something else' }), assets));
  assert.notEqual(base, cardHash(card({ title: 'Other' }), assets));
  assert.notEqual(base, cardHash(card({ trail: [] }), assets));
  assert.notEqual(base, cardHash(card(), { template: 'b' }));
});

// ------------------------------------------------------------ the block

test('escapeAttr escapes everything that could break out of an attribute', () => {
  assert.equal(
    escapeAttr('Blue & Gold "B&G" <3 >'),
    'Blue &amp; Gold &quot;B&amp;G&quot; &lt;3 &gt;',
  );
  assert.equal(escapeAttr(1200), '1200');
  assert.equal(escapeAttr(undefined), '');
});

test('renderBlock emits every tag, escaped, with the requested indent and line ending', () => {
  const block = renderBlock(card({ title: 'Blue & Gold "Certified"' }), {
    indent: '\t\t',
    eol: '\r\n',
  });
  const lines = block.split('\r\n');
  assert.equal(lines.at(-1), '', 'block ends with a line ending');
  assert.ok(lines.slice(0, -1).every((line) => line.startsWith('\t\t<')));
  assert.equal(lines[0], `\t\t${START}`);
  assert.equal(lines.at(-2), `\t\t${END}`);
  assert.ok(!/(?<!\r)\n/.test(block), 'no bare LF');
  assert.match(block, /property="og:title" content="Blue &amp; Gold &quot;Certified&quot;"/);
  for (const key of [
    'og:type',
    'og:site_name',
    'og:description',
    'og:url',
    'og:image',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'theme-color',
  ]) {
    assert.match(block, new RegExp(`="${key}" content="`), key);
  }
});

test('the block stays clear of SEO tags another teammate owns', () => {
  const block = renderBlock(card());
  assert.doesNotMatch(block, /rel="canonical"|application\/ld\+json|name="description"/);
  assert.doesNotMatch(block, /google-site-verification/);
});

test('readBlock round-trips the tags', () => {
  const tags = readBlock(injectBlock(page(), card({ title: 'A & B' })));
  assert.equal(tags['og:title'], 'A & B');
  assert.equal(tags['twitter:card'], 'summary_large_image');
  assert.equal(tags['og:image:width'], '1200');
  assert.equal(readBlock(page()), null);
});

// ------------------------------------------------------------ injection

test('the block goes on the line right after the viewport meta', () => {
  const html = page();
  const out = injectBlock(html, card());
  const lines = out.split('\n');
  const viewport = lines.findIndex((l) => l.includes('name="viewport"'));
  assert.equal(lines[viewport + 1], `\t\t${START}`);
  assert.equal(lines[viewport - 1], '\t\t<meta charset="utf-8" />');
  // Nothing else moved: removing the block gives back the original file.
  assert.equal(out.replace(renderBlock(card(), { indent: '\t\t' }), ''), html);
});

test('injection is idempotent and refreshes a stale block in place', () => {
  const once = injectBlock(page(), card());
  assert.equal(injectBlock(once, card()), once);
  const updated = injectBlock(once, card({ title: 'New Title' }));
  assert.notEqual(updated, once);
  assert.equal(updated.split(START).length, 2, 'still exactly one block');
  assert.equal(readBlock(updated)['og:title'], 'New Title');
  assert.equal(injectBlock(updated, card()), once);
});

test('a block moved elsewhere by hand is refreshed where it is', () => {
  const block = renderBlock(card({ title: 'Old' }), { indent: '    ' });
  const html = page().replace('\t</head>', `${block}\t</head>`);
  const out = injectBlock(html, card());
  assert.equal(
    out,
    page().replace('\t</head>', `${renderBlock(card(), { indent: '    ' })}\t</head>`),
  );
});

test('CRLF files stay CRLF, with no stray LF', () => {
  const html = page('\r\n');
  assert.equal(detectEol(html), '\r\n');
  const out = injectBlock(html, card());
  assert.ok(!/(?<!\r)\n/.test(out));
  assert.equal(injectBlock(out, card()), out);
  assert.equal(out.replace(renderBlock(card(), { indent: '\t\t', eol: '\r\n' }), ''), html);
});

test('indentation follows the anchor line (spaces or tabs)', () => {
  const out = injectBlock(page('\n', '    '), card());
  assert.match(out, new RegExp(`\\n    ${START}\\n    <!-- Generated`));
});

test('placement falls back to <meta charset>, then to just before </head>', () => {
  const noViewport = page().replace(/.*name="viewport".*\n/, '');
  assert.equal(findPlacement(noViewport).rule, 'charset');
  const lines = injectBlock(noViewport, card()).split('\n');
  assert.equal(lines[lines.findIndex((l) => l.includes('charset')) + 1], `\t\t${START}`);

  const bare = '<html>\n\t<head>\n\t\t<title>x</title>\n\t</head>\n</html>\n';
  assert.equal(findPlacement(bare).rule, 'head');
  const out = injectBlock(bare, card());
  assert.match(out, new RegExp(`<title>x</title>\\n\\t\\t${START}`));
  assert.match(out, new RegExp(`${END}\\n\\t</head>`));
});

test('an anchor sharing its line with </head> still lands inside the head', () => {
  const html = '<html><head><meta name="viewport" content="x"></head><body></body></html>';
  const out = injectBlock(html, card());
  assert.ok(out.indexOf(END) < out.indexOf('</head>'));
  assert.equal(injectBlock(out, card()), out);
});

test('viewport metas outside the head and in the body are ignored', () => {
  const html = page().replace('<body></body>', '<body><meta name="viewport" content="no"></body>');
  const out = injectBlock(html, card());
  assert.ok(out.indexOf(START) < out.indexOf('</head>'));
});

test('broken or duplicated blocks are reported instead of guessed at', () => {
  const once = injectBlock(page(), card());
  assert.throws(() => injectBlock(once + START, card()), /more than one/);
  assert.throws(
    () => injectBlock(page().replace('</head>', `${START}\n</head>`), card()),
    /end marker/,
  );
  assert.throws(() => injectBlock('<html><body></body></html>', card()), /no <\/head>/);
});
