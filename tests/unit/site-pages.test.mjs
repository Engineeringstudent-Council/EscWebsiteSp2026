import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractLocalLinks, discoverPages } from '../../scripts/site-pages.mjs';

test('extractLocalLinks keeps local .html links and drops everything else', () => {
  const html = `
    <a href="about.html">a</a>
    <a href='faqs.html#top'>b</a>
    <a href="events.html?x=1">c</a>
    <a href="https://example.com/x.html">ext</a>
    <a href="//cdn.example.com/x.html">proto-relative</a>
    <a href="mailto:president@esc.studentorg.berkeley.edu">mail</a>
    <a href="#section">frag</a>
    <a href="images/photo.jpg">img</a>
    <!-- <a href="commented.html">dead</a> -->
    <a href="/root.html">root</a>
    <a href="../escape.html">escape</a>
    <a href="My%20Page.html">encoded</a>
    <a href="%E0%A4%A.html">bad encoding</a>`;
  assert.deepEqual(extractLocalLinks(html).sort(), [
    'My Page.html',
    'about.html',
    'events.html',
    'faqs.html',
    'root.html',
  ]);
});

test('extractLocalLinks follows unquoted hrefs the way browsers do', () => {
  assert.deepEqual(extractLocalLinks('<h2><b><a href=ficomm.html>Finance</a></b></h2>'), [
    'ficomm.html',
  ]);
  assert.deepEqual(extractLocalLinks('<a href=https://example.com/x.html>ext</a>'), []);
});

test('extractLocalLinks resolves relative to the linking page directory', () => {
  assert.deepEqual(extractLocalLinks('<a href="../b.html"></a><a href="c.html"></a>', 'sub'), [
    'b.html',
    'sub/c.html',
  ]);
});

test('extractLocalLinks handles links inside document.write string includes', () => {
  const js = `document.write('\\\n<li><a href="execs.html">Exec</a></li>\\\n');`;
  assert.deepEqual(extractLocalLinks(js), ['execs.html']);
});

test('discoverPages crawls from seeds, skips orphans, and reports missing pages', async () => {
  const root = await mkdtemp(join(tmpdir(), 'esc-pages-'));
  try {
    await mkdir(join(root, 'assets/js'), { recursive: true });
    await writeFile(join(root, 'index.html'), '<a href="a.html"></a>');
    await writeFile(join(root, 'assets/js/nav.js'), `document.write('<a href="b.html"></a>')`);
    await writeFile(join(root, 'a.html'), '<a href="c.html"></a><a href="gone.html"></a>');
    await writeFile(join(root, 'b.html'), '<a href="a.html"></a><a href="index.html"></a>');
    await writeFile(join(root, 'c.html'), 'leaf');
    await writeFile(join(root, 'orphan.html'), '<a href="a.html"></a>');
    const result = await discoverPages({ root, seeds: ['index.html', 'assets/js/nav.js'] });
    assert.deepEqual(result.pages, ['a.html', 'b.html', 'c.html', 'index.html']);
    assert.deepEqual(result.missing, ['gone.html']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the real site has a homepage and every nav page is discoverable', async () => {
  const { pages } = await discoverPages();
  for (const page of ['index.html', 'execs.html', 'faqs.html', 'hear.html', 'clubs.html']) {
    assert.ok(pages.includes(page), `${page} should be reachable`);
  }
});
