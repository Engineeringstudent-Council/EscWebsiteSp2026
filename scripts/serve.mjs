// Tiny zero-dependency static file server for local preview and CI.
// It mirrors the production host (plain nginx on OCF): files are served
// as-is from the repo root, directories fall back to index.html, and
// anything missing is a real 404 so broken links show up in tests.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

/** Resolve a request path to a file inside ROOT, or null if it escapes. */
export function resolveSafe(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

export function createStaticServer(root = ROOT) {
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let file = resolveSafe(root, req.url || '/');
    if (!file) {
      res.writeHead(400).end('Bad request');
      return;
    }
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file);
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  createStaticServer().listen(port, () => {
    console.log(`ESC site → http://localhost:${port}`);
  });
}
