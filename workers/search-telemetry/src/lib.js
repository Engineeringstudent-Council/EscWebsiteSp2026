/**
 * ESC search telemetry Worker.
 *
 * Receives a beacon from the site search palette whenever a search finds
 * nothing, and keeps a per-day tally of those queries in D1 so the council can
 * see what students look for and can't find.
 *
 * Privacy: only the normalized query text and a daily count are stored. No IP
 * addresses, user agents, cookies, referrers or page paths are persisted, and
 * queries that look like personal data (emails, phone numbers, ID numbers,
 * URLs) are dropped before they reach the database.
 *
 * Plain JavaScript ES module with no build step. All logic lives here and is
 * exported for unit tests (node:test with a fake D1 binding). The Worker entry
 * point (index.js) must only have a default export: workerd treats every named
 * export of the entry module as an entrypoint and refuses to start otherwise.
 */

export const BEACON_PATH = '/zero-results';
export const REPORT_PATH = '/report';
export const REPORT_HTML_PATH = '/report.html';

export const MAX_BODY_BYTES = 1024;
export const MAX_QUERY_LENGTH = 96;
export const DEFAULT_REPORT_DAYS = 30;
export const MAX_REPORT_DAYS = 365;
export const DEFAULT_REPORT_LIMIT = 100;
export const MAX_REPORT_LIMIT = 500;
export const DEFAULT_RETENTION_DAYS = 365;

const EXACT_ORIGINS = new Set([
  'https://esc.studentorg.berkeley.edu',
  'https://esc.berkeley.edu',
  'https://esc-berkeley.pages.dev',
]);
// Cloudflare Pages branch and commit previews: https://<branch>.esc-berkeley.pages.dev
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.esc-berkeley\.pages\.dev$/;
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;

/** True when a beacon from this Origin header value should be accepted. */
export function isAllowedOrigin(origin) {
  if (typeof origin !== 'string' || !origin) return false;
  return EXACT_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin) || LOCAL_ORIGIN.test(origin);
}

/**
 * Canonical form used as the aggregation key: Unicode-normalized, lowercase,
 * control characters removed, whitespace collapsed, capped at
 * MAX_QUERY_LENGTH code points. Returns '' for anything that is not text.
 */
export function normalizeQuery(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_QUERY_LENGTH).join('').trim();
}

const SENSITIVE_PATTERNS = [
  /[^\s@]+@[^\s@]+/, // email-like (also catches "name@berkeley")
  /(?:\+?\d[\s().-]*){7,}/, // phone numbers, SSNs: 7+ digits with separators
  /\d{5,}/, // student IDs, zip codes, card numbers
  /[a-z][a-z0-9+.-]*:\/\//, // any URL scheme
  /\bwww\./,
  /\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|dev|app|co|me|ly|xyz|info|biz)\b/, // bare domains
  /\S{33,}/, // tokens, hashes and other long unbroken strings
];

/**
 * True when a normalized query should not be stored: too short, no letters or
 * digits, or shaped like personal data or spam (see SENSITIVE_PATTERNS).
 */
export function looksSensitive(query) {
  if (typeof query !== 'string') return true;
  if (Array.from(query).length < 2) return true;
  if (!/[\p{L}\p{N}]/u.test(query)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(query));
}

/** UTC calendar day (YYYY-MM-DD) used as the aggregation bucket. */
export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Constant-time string comparison (hashes first, so lengths never leak). */
export async function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(a))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(b))),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(x, y);
  }
  // Node (unit tests) has no crypto.subtle.timingSafeEqual; XOR every byte.
  const left = new Uint8Array(x);
  const right = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Reads at most `limit` bytes of the body, throwing 413 past that. */
async function readCappedText(request, limit) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, 'Payload too large');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'Payload too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Extracts the raw query from a beacon body. The site sends JSON
 * (`{"q": "..."}`) as text/plain so the beacon needs no CORS preflight; a
 * bare text body is accepted too.
 */
export function parseBeacon(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    throw new HttpError(400, 'Malformed JSON');
  }
  if (!payload || typeof payload.q !== 'string') throw new HttpError(400, 'Missing "q"');
  return payload.q;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    // sendBeacon always sends credentials mode "include"; nothing here reads
    // or sets cookies, but the browser requires this for the preflight.
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function text(status, body, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function log(event, fields = {}) {
  // Structured, and deliberately never includes the query text or client IP.
  console.log(JSON.stringify({ event, ...fields }));
}

async function handleBeacon(request, env) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) return text(403, 'Origin not allowed');
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (env.RATE_LIMITER) {
    // Counters live in memory at the Cloudflare location; the IP is used only
    // as an ephemeral key and is never written anywhere.
    const key = request.headers.get('cf-connecting-ip') || 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key });
    if (!success) return text(429, 'Too many requests', cors);
  }

  const raw = parseBeacon(await readCappedText(request, MAX_BODY_BYTES));
  const query = normalizeQuery(raw);
  if (looksSensitive(query)) {
    log('beacon_dropped');
    return new Response(null, { status: 204, headers: cors });
  }

  await env.DB.prepare(
    `INSERT INTO zero_result_queries (day, query, count) VALUES (?1, ?2, 1)
     ON CONFLICT (day, query) DO UPDATE SET count = count + 1`,
  )
    .bind(utcDay(), query)
    .run();
  log('beacon_recorded');
  return new Response(null, { status: 204, headers: cors });
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

async function handleReport(request, env, url) {
  if (!env.REPORT_TOKEN) return text(503, 'Report is disabled until REPORT_TOKEN is set');
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !(await safeEqual(match[1].trim(), env.REPORT_TOKEN))) {
    return text(401, 'Unauthorized', { 'WWW-Authenticate': 'Bearer realm="esc-search-telemetry"' });
  }

  const days = clampInt(url.searchParams.get('days'), DEFAULT_REPORT_DAYS, 1, MAX_REPORT_DAYS);
  const limit = clampInt(url.searchParams.get('limit'), DEFAULT_REPORT_LIMIT, 1, MAX_REPORT_LIMIT);
  // Window is inclusive of today: days=1 means "today (UTC)".
  const since = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));

  const { results = [] } = await env.DB.prepare(
    `SELECT query, SUM(count) AS count, MIN(day) AS first_seen, MAX(day) AS last_seen
       FROM zero_result_queries
      WHERE day >= ?1
      GROUP BY query
      ORDER BY count DESC, last_seen DESC, query ASC
      LIMIT ?2`,
  )
    .bind(since, limit)
    .all();

  return json(200, {
    days,
    since,
    generatedAt: new Date().toISOString(),
    queries: results.map((row) => ({
      query: row.query,
      count: Number(row.count),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    })),
  });
}

const REPORT_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ESC search: zero-result queries</title>
<style>
  :root { color-scheme: light dark; --ink: #10213a; --muted: #5b6b82; --line: #d9e0ea; --gold: #fdb515; }
  body { font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 2rem auto; max-width: 52rem; padding: 0 1rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; } p { color: var(--muted); margin: 0 0 1.25rem; }
  form { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
  input, select, button { font: inherit; padding: .45rem .6rem; border-radius: .4rem; border: 1px solid var(--line); }
  input { flex: 1 1 16rem; } button { background: var(--gold); border-color: var(--gold); color: #10213a; font-weight: 600; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--line); }
  td.n { text-align: right; font-variant-numeric: tabular-nums; } #status { min-height: 1.5em; }
</style>
</head>
<body>
<h1>Searches that found nothing</h1>
<p>What students typed into site search with zero results, grouped and counted. No personal data is stored.</p>
<form id="f">
  <input id="token" type="password" placeholder="Report token" autocomplete="current-password" required>
  <select id="days"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="365">365 days</option></select>
  <button>Load</button>
</form>
<p id="status" role="status"></p>
<table hidden id="t"><thead><tr><th>Query</th><th class="n">Count</th><th>First seen</th><th>Last seen</th></tr></thead><tbody></tbody></table>
<script>
  const $ = (id) => document.getElementById(id);
  $('f').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('status').textContent = 'Loading...';
    const res = await fetch('${REPORT_PATH}?days=' + $('days').value, {
      headers: { Authorization: 'Bearer ' + $('token').value },
    });
    if (!res.ok) { $('status').textContent = 'Error ' + res.status + ': ' + (await res.text()); $('t').hidden = true; return; }
    const data = await res.json();
    const body = $('t').tBodies[0];
    body.replaceChildren(...data.queries.map((q) => {
      const tr = document.createElement('tr');
      for (const [value, cls] of [[q.query], [q.count, 'n'], [q.firstSeen], [q.lastSeen]]) {
        const td = document.createElement('td');
        td.textContent = String(value);
        if (cls) td.className = cls;
        tr.append(td);
      }
      return tr;
    }));
    $('t').hidden = !data.queries.length;
    $('status').textContent = data.queries.length + ' queries since ' + data.since + ' (UTC).';
  });
</script>
</body>
</html>`;

function handleReportHtml() {
  return new Response(REPORT_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function methodNotAllowed(allow) {
  return text(405, 'Method not allowed', { Allow: allow });
}

/** Routes one request. Exported so tests can call it without the runtime. */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === BEACON_PATH) {
      if (request.method !== 'POST' && request.method !== 'OPTIONS') {
        return methodNotAllowed('POST, OPTIONS');
      }
      return await handleBeacon(request, env);
    }
    if (url.pathname === REPORT_PATH) {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return await handleReport(request, env, url);
    }
    if (url.pathname === REPORT_HTML_PATH) {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return handleReportHtml();
    }
    return text(404, 'Not found');
  } catch (error) {
    if (error instanceof HttpError) {
      const origin = request.headers.get('origin');
      const cors = isAllowedOrigin(origin) ? corsHeaders(origin) : {};
      return text(error.status, error.message, cors);
    }
    console.error(JSON.stringify({ event: 'unhandled_error', message: String(error?.message) }));
    return text(500, 'Internal error');
  }
}

/** Deletes daily buckets older than RETENTION_DAYS (cron trigger). */
export async function pruneOldRows(env, now = new Date()) {
  const days = clampInt(env.RETENTION_DAYS, DEFAULT_RETENTION_DAYS, 1, 3650);
  const cutoff = utcDay(new Date(now.getTime() - days * 86_400_000));
  const result = await env.DB.prepare('DELETE FROM zero_result_queries WHERE day < ?1')
    .bind(cutoff)
    .run();
  log('pruned', { cutoff, deleted: result?.meta?.changes ?? 0 });
}
