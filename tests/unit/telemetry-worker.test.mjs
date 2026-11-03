import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../workers/search-telemetry/src/index.js';
import {
  handleRequest,
  isAllowedOrigin,
  looksSensitive,
  normalizeQuery,
  parseBeacon,
  pruneOldRows,
  safeEqual,
  utcDay,
  MAX_BODY_BYTES,
  MAX_QUERY_LENGTH,
} from '../../workers/search-telemetry/src/lib.js';

const ORIGIN = 'https://esc.studentorg.berkeley.edu';
const BASE = 'https://telemetry.example.workers.dev';
const TOKEN = 'correct-horse-battery-staple';

/** Minimal stand-in for a D1 binding that records every statement. */
function fakeD1({ rows = [], fail = false } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          const call = { sql, params };
          return {
            async run() {
              if (fail) throw new Error('D1 unavailable');
              calls.push({ ...call, op: 'run' });
              return { success: true, meta: { changes: 3 } };
            },
            async all() {
              if (fail) throw new Error('D1 unavailable');
              calls.push({ ...call, op: 'all' });
              return { success: true, results: rows };
            },
          };
        },
      };
    },
  };
}

function makeEnv(overrides = {}) {
  return { DB: fakeD1(), REPORT_TOKEN: TOKEN, ...overrides };
}

function beacon(body, { origin = ORIGIN, type = 'text/plain;charset=UTF-8', headers = {} } = {}) {
  const h = { 'Content-Type': type, ...headers };
  if (origin) h.Origin = origin;
  return new Request(`${BASE}/zero-results`, { method: 'POST', headers: h, body });
}

function report(query = '', auth) {
  const headers = auth === undefined ? {} : { Authorization: auth };
  return new Request(`${BASE}/report${query}`, { headers });
}

describe('normalizeQuery', () => {
  test('lowercases, trims and collapses whitespace', () => {
    assert.equal(normalizeQuery('  Free   FOOD\tnear\n Soda  '), 'free food near soda');
  });
  test('strips control and format characters', () => {
    assert.equal(normalizeQuery('makers\u0000pace​'), 'makers pace');
  });
  test('applies NFKC so look-alike forms share a key', () => {
    assert.equal(normalizeQuery('ＥＥＣＳ'), 'eecs');
  });
  test(`caps at ${MAX_QUERY_LENGTH} code points without splitting surrogates`, () => {
    const out = normalizeQuery('🐻'.repeat(200));
    assert.equal(Array.from(out).length, MAX_QUERY_LENGTH);
    assert.ok(!/[\ud800-\udbff]$/.test(out));
  });
  test('returns empty for non-strings', () => {
    assert.equal(normalizeQuery(undefined), '');
    assert.equal(normalizeQuery(42), '');
    assert.equal(normalizeQuery({ q: 'x' }), '');
  });
});

describe('looksSensitive', () => {
  const keep = [
    'free food',
    'cs 61a',
    'ee 16b tutoring',
    'hear tool',
    'eweek 2026',
    'jacobs hall',
    'c++ club',
    'what is fmpi',
    'résumé review',
    '机器学习',
  ];
  for (const q of keep) test(`keeps "${q}"`, () => assert.equal(looksSensitive(q), false));

  const drop = {
    empty: '',
    'single char': 'a',
    'only punctuation': '?!',
    email: 'oski@berkeley.edu',
    'partial email': 'oski@berkeley',
    phone: '(510) 642-1234',
    'phone dotted': '510.642.1234',
    'international phone': '+1 510 642 1234',
    ssn: '123-45-6789',
    'student id': 'sid 3034567890',
    'zip code': '94720',
    url: 'https://example.com/x',
    'other scheme': 'ftp://files',
    www: 'www.casino',
    'bare domain': 'cheap-pills.com',
    token: 'a'.repeat(40),
  };
  for (const [label, q] of Object.entries(drop)) {
    test(`drops ${label}`, () => assert.equal(looksSensitive(normalizeQuery(q)), true));
  }
});

describe('isAllowedOrigin', () => {
  const allowed = [
    'https://esc.studentorg.berkeley.edu',
    'https://esc.berkeley.edu',
    'https://esc-berkeley.pages.dev',
    'https://feat-search.esc-berkeley.pages.dev',
    'https://1a2b3c4d.esc-berkeley.pages.dev',
    'http://localhost:8080',
    'http://localhost',
    'http://127.0.0.1:4173',
  ];
  for (const o of allowed) test(`allows ${o}`, () => assert.equal(isAllowedOrigin(o), true));

  const denied = [
    null,
    '',
    'null',
    'http://esc.studentorg.berkeley.edu',
    'https://esc.studentorg.berkeley.edu.evil.com',
    'https://evilesc.berkeley.edu',
    'https://esc-berkeley.pages.dev.evil.com',
    'https://a.b.esc-berkeley.pages.dev',
    'https://evil-esc-berkeley.pages.dev',
    'https://localhost:8080',
    'http://localhost.evil.com',
  ];
  for (const o of denied)
    test(`denies ${JSON.stringify(o)}`, () => assert.equal(isAllowedOrigin(o), false));
});

describe('parseBeacon', () => {
  test('reads q from JSON', () => assert.equal(parseBeacon('{"q":"free food"}'), 'free food'));
  test('accepts a bare text body', () => assert.equal(parseBeacon(' free food '), 'free food'));
  test('rejects malformed JSON', () => assert.throws(() => parseBeacon('{"q":'), /Malformed/));
  test('rejects JSON without a string q', () => assert.throws(() => parseBeacon('{"q":1}'), /q/));
});

describe('safeEqual', () => {
  test('matches equal strings and rejects different ones', async () => {
    assert.equal(await safeEqual('abc', 'abc'), true);
    assert.equal(await safeEqual('abc', 'abd'), false);
    assert.equal(await safeEqual('abc', 'abcd'), false);
  });
});

describe('POST /zero-results', () => {
  test('records a normalized query in today’s bucket and returns 204', async () => {
    const env = makeEnv();
    const res = await handleRequest(beacon(JSON.stringify({ q: '  Free   FOOD ' })), env);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(env.DB.calls.length, 1);
    const [call] = env.DB.calls;
    assert.match(call.sql, /ON CONFLICT \(day, query\) DO UPDATE SET count = count \+ 1/);
    assert.deepEqual(call.params, [utcDay(), 'free food']);
  });

  test('accepts application/json bodies too', async () => {
    const env = makeEnv();
    const res = await handleRequest(beacon('{"q":"hear"}', { type: 'application/json' }), env);
    assert.equal(res.status, 204);
    assert.deepEqual(env.DB.calls[0].params, [utcDay(), 'hear']);
  });

  test('ignores extra fields such as page paths', async () => {
    const env = makeEnv();
    await handleRequest(beacon('{"q":"hear","page":"/clubs.html","ua":"x"}'), env);
    assert.deepEqual(env.DB.calls[0].params, [utcDay(), 'hear']);
  });

  test('silently drops PII-looking queries (204, nothing stored)', async () => {
    for (const q of ['oski@berkeley.edu', '510-642-1234', '3034567890', 'https://spam.example']) {
      const env = makeEnv();
      const res = await handleRequest(beacon(JSON.stringify({ q })), env);
      assert.equal(res.status, 204, q);
      assert.equal(env.DB.calls.length, 0, q);
    }
  });

  test('drops empty and single-character queries', async () => {
    for (const q of ['', '   ', 'x']) {
      const env = makeEnv();
      assert.equal((await handleRequest(beacon(JSON.stringify({ q })), env)).status, 204);
      assert.equal(env.DB.calls.length, 0);
    }
  });

  test('rejects a disallowed Origin with 403 and no CORS headers', async () => {
    const env = makeEnv();
    const res = await handleRequest(
      beacon('{"q":"hear"}', { origin: 'https://evil.example' }),
      env,
    );
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.equal(env.DB.calls.length, 0);
  });

  test('rejects a missing Origin with 403', async () => {
    const env = makeEnv();
    const res = await handleRequest(beacon('{"q":"hear"}', { origin: null }), env);
    assert.equal(res.status, 403);
  });

  test('rejects an oversized body with 413', async () => {
    const env = makeEnv();
    const big = JSON.stringify({ q: 'x'.repeat(MAX_BODY_BYTES * 2) });
    const res = await handleRequest(beacon(big), env);
    assert.equal(res.status, 413);
    assert.equal(env.DB.calls.length, 0);
  });

  test('rejects an oversized streamed body without Content-Length', async () => {
    const env = makeEnv();
    const chunk = new TextEncoder().encode('a'.repeat(512));
    let sent = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (sent++ < 10) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const req = new Request(`${BASE}/zero-results`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' },
      body,
      duplex: 'half',
    });
    const res = await handleRequest(req, env);
    assert.equal(res.status, 413);
    assert.ok(sent < 10, 'stopped reading early');
  });

  test('rejects malformed JSON with 400', async () => {
    const env = makeEnv();
    const res = await handleRequest(beacon('{"q": "unterminated'), env);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(env.DB.calls.length, 0);
  });

  test('returns 429 when the rate limiter says no', async () => {
    const keys = [];
    const env = makeEnv({
      RATE_LIMITER: {
        async limit({ key }) {
          keys.push(key);
          return { success: false };
        },
      },
    });
    const res = await handleRequest(
      beacon('{"q":"hear"}', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }),
      env,
    );
    assert.equal(res.status, 429);
    assert.deepEqual(keys, ['203.0.113.9']);
    assert.equal(env.DB.calls.length, 0);
  });

  test('passes through when the rate limiter allows the request', async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: true }) } });
    assert.equal((await handleRequest(beacon('{"q":"hear"}'), env)).status, 204);
    assert.equal(env.DB.calls.length, 1);
  });

  test('returns 500 without leaking details when D1 fails', async () => {
    const env = makeEnv({ DB: fakeD1({ fail: true }) });
    const original = console.error;
    console.error = () => {};
    try {
      const res = await handleRequest(beacon('{"q":"hear"}'), env);
      assert.equal(res.status, 500);
      assert.equal(await res.text(), 'Internal error');
    } finally {
      console.error = original;
    }
  });
});

describe('OPTIONS /zero-results (CORS preflight)', () => {
  test('allows the site origin', async () => {
    const res = await handleRequest(
      new Request(`${BASE}/zero-results`, {
        method: 'OPTIONS',
        headers: {
          Origin: ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      }),
      makeEnv(),
    );
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
    assert.match(res.headers.get('access-control-allow-headers'), /Content-Type/i);
    assert.equal(res.headers.get('vary'), 'Origin');
  });

  test('refuses other origins', async () => {
    const res = await handleRequest(
      new Request(`${BASE}/zero-results`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
      }),
      makeEnv(),
    );
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

describe('GET /report', () => {
  const rows = [
    { query: 'free food', count: 12, first_seen: '2026-09-20', last_seen: '2026-10-08' },
    { query: 'parking', count: 3, first_seen: '2026-10-01', last_seen: '2026-10-02' },
  ];

  test('requires a token (401 when missing)', async () => {
    const env = makeEnv();
    const res = await handleRequest(report(), env);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate'), /Bearer/);
    assert.equal(env.DB.calls.length, 0);
  });

  test('rejects a wrong token with 401', async () => {
    const env = makeEnv();
    for (const auth of ['Bearer nope', `Bearer ${TOKEN}x`, `Basic ${TOKEN}`, TOKEN]) {
      assert.equal((await handleRequest(report('', auth), env)).status, 401, auth);
    }
    assert.equal(env.DB.calls.length, 0);
  });

  test('is disabled (503) when REPORT_TOKEN is not configured', async () => {
    const env = makeEnv({ REPORT_TOKEN: undefined });
    assert.equal((await handleRequest(report('', 'Bearer '), env)).status, 503);
  });

  test('returns the top queries with the right token', async () => {
    const env = makeEnv({ DB: fakeD1({ rows }) });
    const res = await handleRequest(report('?days=30', `Bearer ${TOKEN}`), env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json();
    assert.equal(body.days, 30);
    assert.equal(body.since, utcDay(new Date(Date.now() - 29 * 86_400_000)));
    assert.deepEqual(body.queries[0], {
      query: 'free food',
      count: 12,
      firstSeen: '2026-09-20',
      lastSeen: '2026-10-08',
    });
    const [call] = env.DB.calls;
    assert.match(call.sql, /GROUP BY query/);
    assert.deepEqual(call.params, [body.since, 100]);
  });

  test('clamps days and limit to sane ranges', async () => {
    const env = makeEnv();
    const res = await handleRequest(report('?days=99999&limit=-4', `bearer ${TOKEN}`), env);
    const body = await res.json();
    assert.equal(body.days, 365);
    assert.equal(env.DB.calls[0].params[1], 1);
    const env2 = makeEnv();
    const body2 = await (await handleRequest(report('?days=abc', `Bearer ${TOKEN}`), env2)).json();
    assert.equal(body2.days, 30);
  });
});

describe('routing', () => {
  test('405 for wrong methods, with an Allow header', async () => {
    const env = makeEnv();
    const get = await handleRequest(new Request(`${BASE}/zero-results`), env);
    assert.equal(get.status, 405);
    assert.equal(get.headers.get('allow'), 'POST, OPTIONS');
    const post = await handleRequest(new Request(`${BASE}/report`, { method: 'POST' }), env);
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET');
    const del = await handleRequest(new Request(`${BASE}/report.html`, { method: 'DELETE' }), env);
    assert.equal(del.status, 405);
  });

  test('404 for unknown paths', async () => {
    assert.equal((await handleRequest(new Request(`${BASE}/`), makeEnv())).status, 404);
  });

  test('serves the report page with a strict CSP and no data', async () => {
    const res = await handleRequest(new Request(`${BASE}/report.html`), makeEnv());
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(await res.text(), /Searches that found nothing/);
  });

  test('default export fetch delegates to handleRequest', async () => {
    const res = await worker.fetch(new Request(`${BASE}/nope`), makeEnv());
    assert.equal(res.status, 404);
  });
});

describe('retention', () => {
  test('pruneOldRows deletes buckets older than RETENTION_DAYS', async () => {
    const env = makeEnv({ RETENTION_DAYS: '30' });
    const original = console.log;
    console.log = () => {};
    try {
      await pruneOldRows(env, new Date('2026-10-09T12:00:00Z'));
    } finally {
      console.log = original;
    }
    assert.equal(env.DB.calls.length, 1);
    assert.match(env.DB.calls[0].sql, /DELETE FROM zero_result_queries WHERE day < \?1/);
    assert.deepEqual(env.DB.calls[0].params, ['2026-09-09']);
  });
});
