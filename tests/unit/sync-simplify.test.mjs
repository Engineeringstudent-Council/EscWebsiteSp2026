import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFile, majorsFor, termEnded, toOpportunity } from '../../scripts/sync-simplify.mjs';

const base = {
  id: 'ABC-123',
  title: 'Software Engineer Intern',
  company_name: 'Acme',
  url: 'https://example.com/jobs/1',
  active: true,
  is_visible: true,
  category: 'Software',
  terms: ['Summer 2027'],
  degrees: ["Bachelor's"],
  locations: ['Oakland, CA', 'Remote'],
  date_posted: 1790000000,
  sponsorship: 'Does Not Offer Sponsorship',
};

test('maps a listing to an internship', () => {
  const o = toOpportunity(base, '2026-11-17');
  assert.equal(o.type, 'internship');
  assert.equal(o.id, 'simplify-abc-123');
  assert.equal(o.organization, 'Acme');
  assert.equal(o.location, 'Oakland, CA +1 more');
  assert.equal(o.eligibility, "Summer 2027 · Bachelor's · No visa sponsorship");
  assert.deepEqual(o.majors, ['eecs']);
  assert.match(o.postedDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(o.deadline, undefined);
});

test('skips inactive, hidden and non-https listings', () => {
  assert.equal(toOpportunity({ ...base, active: false }, '2026-11-17'), null);
  assert.equal(toOpportunity({ ...base, is_visible: false }, '2026-11-17'), null);
  assert.equal(toOpportunity({ ...base, url: 'http://example.com/x' }, '2026-11-17'), null);
  assert.equal(toOpportunity({ ...base, url: 'not a url' }, '2026-11-17'), null);
});

test('keeps long titles inside the schema limit', () => {
  assert.ok(toOpportunity({ ...base, title: 'x'.repeat(300) }, '2026-11-17').title.length <= 120);
});

test('tags majors from the category', () => {
  assert.deepEqual(majorsFor({ category: 'Product' }), []);
  assert.ok(
    majorsFor({ category: 'Hardware', title: 'Avionics Intern' }).includes('aerospace-engineering'),
  );
  assert.ok(majorsFor({ category: 'AI/ML/Data' }).includes('engineering-math-statistics'));
});

test('builds a stable file without duplicate links', () => {
  const body = buildFile([
    base,
    { ...base, id: 'dup' },
    { ...base, id: 'AAA', url: 'https://example.com/jobs/2' },
  ]);
  const data = JSON.parse(body);
  assert.equal(data.opportunities.length, 2);
  assert.deepEqual(
    data.opportunities.map((o) => o.id),
    ['simplify-aaa', 'simplify-abc-123'],
  );
});

test('drops genuinely old listings, keeps ones with a doubtful season', () => {
  const today = '2026-11-17';
  const at = (iso) => Date.parse(`${iso}T12:00:00Z`) / 1000;
  assert.equal(termEnded('Summer 2026', today), true);
  assert.equal(termEnded('Fall 2026', today), false);
  assert.equal(termEnded('N/A', today), false);
  // Added in April for Summer 2026, still marked active in November: stale.
  assert.equal(
    toOpportunity({ ...base, terms: ['Summer 2026'], date_posted: at('2026-04-10') }, today),
    null,
  );
  // Added in October with a "Summer 2026" label: the label is wrong, keep it
  // and do not show the season.
  const wrong = toOpportunity(
    { ...base, terms: ['Summer 2026'], date_posted: at('2026-10-05') },
    today,
  );
  assert.equal(wrong.type, 'internship');
  assert.ok(!/Summer 2026/.test(wrong.eligibility));
  // A listing with a current season keeps it and hides the over one.
  const mixed = toOpportunity(
    { ...base, terms: ['Summer 2026', 'Summer 2027'], date_posted: at('2026-04-10') },
    today,
  );
  assert.match(mixed.eligibility, /^Summer 2027/);
  assert.ok(toOpportunity({ ...base, terms: [] }, today));
  assert.ok(toOpportunity({ ...base, terms: ['N/A'] }, today));
});
