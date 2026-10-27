# Search telemetry Worker

> What are students searching for that the site doesn't have?

`cloudflare-workers` `d1` `privacy` `site-search`

A small Cloudflare Worker that counts the searches on the ESC site that come back **empty**. Each week you can read a short list like "parking permit × 14, printing × 9" and fix the gaps by adding a page, a keyword, or a synonym in `data/search/`.

It is **off by default**. No page sends anything until someone adds the meta tag described in [Turn it on](#4-turn-it-on-on-the-site).

## What it collects, and what it doesn't

| Stored                                                           | Never stored                                   |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| The search text, lowercased and trimmed, capped at 96 characters | IP addresses, user agents, cookies, referrers  |
| A count per query per UTC **day**                                | The page the visitor was on                    |
|                                                                  | Exact timestamps, sessions, or any visitor IDs |

- **Personal data is dropped before it reaches the database.** Queries that look like an email address, a phone number, an SSN, a run of five or more digits (student IDs, zip codes), a URL or domain, or a long token are discarded. So are empty, one-character, and punctuation-only queries.
- **Rows expire.** A daily cron deletes days older than `RETENTION_DAYS` (365 by default, set in `wrangler.jsonc`).
- **Logs stay clean too.** Invocation logs are off and query strings are redacted, so Workers Logs never hold request metadata. The Worker's own log lines are event names only (`beacon_recorded`, `beacon_dropped`).
- **Rate limiting** uses the client IP as an in-memory key for the [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). That key is never written anywhere.

## How it works

```
search palette (assets/js/search/ui.js)
  │  zero results, visitor stops typing for 1.5 s, each query sent once per page view
  │  navigator.sendBeacon(endpoint, '{"q":"parking permit"}')   ← text/plain, so no CORS preflight
  ▼
POST /zero-results  ─ Origin allowlist ─ rate limit (30/min/IP) ─ 1 KB body cap
  │                 ─ normalize ─ drop PII and junk
  ▼
D1  zero_result_queries (day, query, count)   INSERT … ON CONFLICT DO UPDATE count = count + 1
  ▲
GET /report?days=30   Bearer REPORT_TOKEN (constant-time check)  →  top queries as JSON
GET /report.html      tiny page that asks for the token and renders the same report as a table
```

| Endpoint        | Method    | Response                                                                                                                    |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/zero-results` | `POST`    | `204` (also when a query is dropped as PII). `403` bad or missing Origin, `400` malformed JSON, `413` body over 1 KB, `429` |
| `/zero-results` | `OPTIONS` | CORS preflight for allowed origins (`204`), `403` otherwise                                                                 |
| `/report`       | `GET`     | JSON report. `401` without the right token, `503` if `REPORT_TOKEN` is not set                                              |
| `/report.html`  | `GET`     | HTML viewer (no data until you enter the token)                                                                             |
| anything else   | any       | `404` (wrong method on a known path is `405` with an `Allow` header)                                                        |

**Allowed origins:** `https://esc.studentorg.berkeley.edu`, `https://esc.berkeley.edu`, `https://esc-berkeley.pages.dev` and its `*.esc-berkeley.pages.dev` previews, and `http://localhost` / `http://127.0.0.1` on any port.

**Files**

| Path                    | What it is                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/index.js`          | Worker entry. Only a default export, because workerd treats named exports of the entry as entrypoints. |
| `src/lib.js`            | All logic, exported for tests: `handleRequest`, `normalizeQuery`, `looksSensitive`, `isAllowedOrigin`  |
| `migrations/0001_*.sql` | D1 schema, applied with `wrangler d1 migrations apply`                                                 |
| `wrangler.jsonc`        | Bindings: `DB` (D1), `RATE_LIMITER`, the daily cron, `RETENTION_DAYS`                                  |

Plain JavaScript, no build step, no dependencies. Tests live in `tests/unit/telemetry-worker.test.mjs` and run with `npm test` against a fake D1.

## One-time setup

Run these from `workers/search-telemetry/`. Wrangler isn't a repo dependency (it's large), so commands use `npx`.

### 1. Create the database

```sh
npx wrangler@4 login
npx wrangler@4 d1 create esc-search-telemetry
```

Copy the printed `database_id` into `wrangler.jsonc`, replacing the `00000000-…` placeholder, and commit it. The id is not a secret. The deploy workflow skips itself while the placeholder is still there.

### 2. Set the report token

```sh
openssl rand -base64 32          # generate a token and keep it in the team password manager
npx wrangler@4 secret put REPORT_TOKEN
```

Paste the token at the prompt. Never put it in `wrangler.jsonc` or pass it on the command line.

### 3. Deploy

The [`telemetry-worker.yml`](../../.github/workflows/telemetry-worker.yml) workflow applies migrations and deploys on every push to `main` that touches this folder, and you can also run it by hand from the Actions tab. It needs the repo secrets `CLOUDFLARE_API_TOKEN` (with **Workers Scripts: Edit** and **D1: Edit**) and `CLOUDFLARE_ACCOUNT_ID`. Without them it skips with a notice instead of failing. PRs only get a `wrangler deploy --dry-run` bundle check.

To deploy by hand instead:

```sh
npx wrangler@4 d1 migrations apply esc-search-telemetry --remote
npx wrangler@4 deploy
```

The Worker URL is printed at the end, for example `https://esc-search-telemetry.<account>.workers.dev`.

### 4. Turn it on on the site

Add this to the `<head>` of the pages that load search, with your Worker URL:

```html
<meta
  name="esc-search-telemetry"
  content="https://esc-search-telemetry.<account>.workers.dev/zero-results"
/>
```

To turn it off again, remove the tag. The client does nothing when the tag is missing.

## Reading the report

In a browser, open `https://esc-search-telemetry.<account>.workers.dev/report.html`, paste the token, and pick a window.

From a terminal:

```sh
curl -s -H "Authorization: Bearer $REPORT_TOKEN" \
  "https://esc-search-telemetry.<account>.workers.dev/report?days=30&limit=50"
```

```json
{
  "days": 30,
  "since": "2026-09-10",
  "generatedAt": "2026-10-09T18:00:00.000Z",
  "queries": [
    { "query": "parking permit", "count": 14, "firstSeen": "2026-09-12", "lastSeen": "2026-10-08" }
  ]
}
```

`days` is 1 to 365 (default 30) and counts today in UTC. `limit` is 1 to 500 (default 100). Results are sorted by count.

For raw SQL:

```sh
npx wrangler@4 d1 execute esc-search-telemetry --remote \
  --command "SELECT query, SUM(count) AS n FROM zero_result_queries GROUP BY query ORDER BY n DESC LIMIT 20"
```

## Local development

```sh
cd workers/search-telemetry
npx wrangler@4 d1 migrations apply esc-search-telemetry --local
echo 'REPORT_TOKEN=dev-token' > .dev.vars        # git-ignored
npx wrangler@4 dev --local --port 8799

curl -i -X POST localhost:8799/zero-results -H 'Origin: http://localhost:4173' --data '{"q":"parking permit"}'
curl -s localhost:8799/report -H 'Authorization: Bearer dev-token'
```

To watch it from the real palette, run `npm run serve` at the repo root, add the meta tag pointing at `http://localhost:8799/zero-results` to a page, and search for something like `zzqxv`.

## Design notes

- **Daily buckets instead of one lifetime counter per query.** The report can then show real counts for "the last 7 days", and old data can be deleted. A day is too coarse to identify anyone.
- **`text/plain` beacons.** `sendBeacon` with an `application/json` Blob needs a CORS preflight, and some browsers have refused it outright. A string body goes out as `text/plain`, which needs no preflight. The Worker still answers preflights correctly in case an older client sends JSON.
- **Rate Limiting binding over a hand-rolled guard.** It's generally available, costs nothing to call, and needs no storage. Limits apply per Cloudflare location and are eventually consistent, which is fine for an abuse guard. Cloudflare suggests keys other than IPs, but anonymous beacons have nothing else to key on. 30 a minute leaves plenty of room for students behind a shared campus NAT.
- **Silent drops.** PII and junk get the same `204` as a recorded query, so probing the filter teaches a spammer nothing.
