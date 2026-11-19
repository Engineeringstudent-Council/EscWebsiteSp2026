// Pulls SimplifyJobs' public internship list into data/opportunities.synced.json
// (the file the Opportunities page reads next to the hand-curated
// data/opportunities.json). Nothing here is edited by hand: the scheduled
// GitHub Action (.github/workflows/sync-internships.yml) rewrites it.
//
// Usage:
//   node scripts/sync-simplify.mjs                 fetch the live list
//   node scripts/sync-simplify.mjs --input f.json  use a downloaded copy
//   node scripts/sync-simplify.mjs --check         exit 1 if the file is out of date
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(ROOT, 'data/opportunities.synced.json');

const BERKELEY = { timeZone: 'America/Los_Angeles' };
const clip = (text, max) => {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

// Simplify sorts roles into a few broad groups; map them to the engineering
// majors the board filters on. Rough on purpose: a listing with no majors
// shows under every major, so only tag when the group clearly points somewhere.
export function majorsFor(listing) {
  const category = String(listing.category ?? '').toLowerCase();
  const title = String(listing.title ?? '');
  if (/software/.test(category)) return ['eecs'];
  if (/ai|ml|data|machine/.test(category)) return ['eecs', 'engineering-math-statistics', 'ieor'];
  if (/quant/.test(category)) return ['engineering-math-statistics', 'ieor'];
  if (/hardware/.test(category)) {
    const majors = ['electrical-computer-engineering', 'eecs', 'mechanical-engineering'];
    if (/aerospace|avionics|propulsion|aircraft|\bspace\b|satellite/i.test(title))
      majors.push('aerospace-engineering');
    return majors;
  }
  return [];
}

// Simplify keeps some listings marked active long after the season they were
// for, and some listings carry the wrong season (a "Summer 2026" role added in
// October is really for next summer). So an over term only gets a listing
// dropped when the label is believable: the listing was added well before that
// season ended. Otherwise the listing stays and the doubtful term is not shown.
// "N/A" or an empty list says nothing, so those are kept as they are.
const TERM_END = {
  Spring: (y) => [y, 6, 30],
  Summer: (y) => [y, 8, 31],
  Fall: (y) => [y, 12, 31],
  Winter: (y) => [y + 1, 3, 31],
};
const BELIEVABLE_DAYS = 60;

function termEndDate(term) {
  const m = /^(Spring|Summer|Fall|Winter) (\d{4})$/.exec(String(term ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = TERM_END[m[1]](Number(m[2]));
  return new Date(Date.UTC(y, mo - 1, d));
}

const iso = (date) => date.toISOString().slice(0, 10);

export function termEnded(term, today) {
  const end = termEndDate(term);
  return end !== null && iso(end) < today;
}

/** Was the listing added early enough for this season to be what it is for? */
function believableFor(term, posted) {
  const end = termEndDate(term);
  if (!end || !posted) return false;
  return posted < iso(new Date(end.getTime() - BELIEVABLE_DAYS * 86400000));
}

/** True when every term is over and the listing really is that old. */
export function isStale(listing, posted, today) {
  const terms = (listing.terms ?? []).filter((t) => t && t !== 'N/A');
  return (
    terms.length > 0 &&
    terms.every((t) => termEnded(t, today)) &&
    terms.every((t) => believableFor(t, posted))
  );
}

function eligibilityFor(listing, today) {
  const parts = [];
  const terms = (listing.terms ?? []).filter((t) => t && t !== 'N/A' && !termEnded(t, today));
  if (terms.length) parts.push(terms.join(', '));
  if (listing.degrees?.length) parts.push(listing.degrees.join(', '));
  if (listing.sponsorship === 'U.S. Citizenship is Required')
    parts.push('U.S. citizenship required');
  else if (listing.sponsorship === 'Does Not Offer Sponsorship') parts.push('No visa sponsorship');
  else if (listing.sponsorship === 'Offers Sponsorship') parts.push('Offers visa sponsorship');
  return clip(parts.join(' · '), 300);
}

/** One Simplify listing -> one opportunity, or null if it can't be used. */
export function toOpportunity(listing, today = new Date().toLocaleDateString('en-CA', BERKELEY)) {
  if (!listing || !listing.is_visible || !listing.active) return null;
  let url;
  try {
    url = new URL(listing.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !listing.title || !listing.company_name || !listing.id)
    return null;

  const locations = (listing.locations ?? []).filter(Boolean);
  const location =
    locations.length > 1 ? `${locations[0]} +${locations.length - 1} more` : (locations[0] ?? '');
  const posted = Number.isFinite(listing.date_posted)
    ? new Date(listing.date_posted * 1000).toLocaleDateString('en-CA', BERKELEY)
    : '';
  if (isStale(listing, posted, today)) return null;
  const majors = majorsFor(listing);
  const eligibility = eligibilityFor(listing, today);

  const out = {
    id: `simplify-${String(listing.id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`.slice(0, 80),
    title: clip(listing.title, 120),
    organization: clip(listing.company_name, 120),
    type: 'internship',
    url: url.href,
  };
  if (posted) out.postedDate = posted;
  if (location) out.location = clip(location, 120);
  if (eligibility) out.eligibility = eligibility;
  if (majors.length) out.majors = majors;
  return out;
}

/** The whole list -> the file body: stable order, one entry per line. */
export function buildFile(listings, today) {
  const seen = new Set();
  const items = [];
  for (const listing of listings) {
    const item = toOpportunity(listing, today);
    if (!item || seen.has(item.url) || seen.has(item.id)) continue;
    seen.add(item.url);
    seen.add(item.id);
    items.push(item);
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  const head = '{\n"$schema":"../schemas/opportunities.schema.json",\n"opportunities":[\n';
  return `${head}${items.map((i) => JSON.stringify(i)).join(',\n')}\n]\n}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const inputAt = args.indexOf('--input');
  const raw =
    inputAt !== -1
      ? readFileSync(resolve(args[inputAt + 1]), 'utf8')
      : await fetch(SOURCE_URL).then((r) => {
          if (!r.ok) throw new Error(`${SOURCE_URL} answered ${r.status}`);
          return r.text();
        });
  const listings = JSON.parse(raw);
  if (!Array.isArray(listings)) throw new Error('Expected a list of listings.');
  const body = buildFile(listings);
  const count = (body.match(/^\{"id"/gm) ?? []).length;

  if (args.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== body) {
      console.error(
        'data/opportunities.synced.json is out of date. Run: node scripts/sync-simplify.mjs',
      );
      process.exit(1);
    }
    console.log(`data/opportunities.synced.json is current (${count} listings).`);
    return;
  }
  // Never replace a good file with an empty one if the source breaks.
  if (count < 1) throw new Error('No usable listings in the source; leaving the file alone.');
  writeFileSync(OUT, body);
  console.log(`Wrote ${count} internships to data/opportunities.synced.json`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
