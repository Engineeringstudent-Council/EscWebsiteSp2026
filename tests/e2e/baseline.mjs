// Ratchet helpers: a baseline records known pre-existing problems so CI
// fails only when something gets worse. Run with UPDATE_BASELINE=1 to
// rewrite a baseline after fixing (or deliberately accepting) issues.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Items present in `actual` but not in `known`. */
export function compareToBaseline(known, actual) {
  const allowed = new Set(known);
  return actual.filter((item) => !allowed.has(item));
}

/** Merge per-page results into the baseline file when UPDATE_BASELINE is set. */
export function writeBaselineIfRequested(file, observed) {
  if (!process.env.UPDATE_BASELINE || Object.keys(observed).length === 0) return;
  let current = {};
  try {
    current = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // first run
  }
  const next = { ...current };
  for (const [page, items] of Object.entries(observed)) {
    if (items.length) next[page] = items;
    else delete next[page];
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}
