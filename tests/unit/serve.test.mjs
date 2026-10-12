import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createStaticServer, resolveSafe } from '../../scripts/serve.mjs';

let root;
let server;
let port;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'esc-serve-'));
  await mkdir(join(root, 'sub'));
  await writeFile(join(root, 'index.html'), '<h1>home</h1>');
  await writeFile(join(root, 'sub/index.html'), '<h1>sub</h1>');
  await writeFile(join(root, 'app.js'), 'export {}');
  await writeFile(join(root, 'data.json'), '{}');
  server = createStaticServer(root);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await rm(root, { recursive: true, force: true });
});

function get(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    // Raw paths (with ..) must reach the server unnormalised.
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the homepage for / and directory index files', async () => {
  assert.equal((await get('/')).body, '<h1>home</h1>');
  assert.equal((await get('/sub/')).body, '<h1>sub</h1>');
});

test('serves JavaScript with a module-safe MIME type', async () => {
  const res = await get('/app.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/javascript/);
});

test('returns 404 for missing files and ignores query strings', async () => {
  assert.equal((await get('/nope.html')).status, 404);
  assert.equal((await get('/data.json?v=123')).status, 200);
});

test('blocks path traversal and malformed encodings', async () => {
  assert.notEqual((await get('/../../etc/passwd')).status, 200);
  assert.equal((await get('/%2e%2e/%2e%2e/etc/passwd')).status, 400);
  assert.equal((await get('/%E0%A4%A')).status, 400);
  assert.equal((await get('/a%00b')).status, 400);
});

test('rejects non-GET methods and supports HEAD', async () => {
  assert.equal((await get('/', 'POST')).status, 405);
  const head = await get('/index.html', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('resolveSafe never returns a path outside the root', () => {
  for (const p of ['/../x', '/..%2fx', '/a/../../x', '/%2e%2e%2fx']) {
    const r = resolveSafe('/srv/site', p);
    assert.ok(r === null || r.startsWith('/srv/site'), `${p} -> ${r}`);
  }
});
