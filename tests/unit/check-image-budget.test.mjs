import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findOversized, formatReport, DEFAULT_MAX } from '../../scripts/check-image-budget.mjs';

test('flags only image files over the budget', () => {
  const files = [
    { path: 'images/big.JPG', size: DEFAULT_MAX + 1 },
    { path: 'images/ok.png', size: DEFAULT_MAX },
    { path: 'docs/huge.pdf', size: DEFAULT_MAX * 10 },
    { path: 'images/Gallery Photos/x.jpeg', size: DEFAULT_MAX * 3 },
  ];
  assert.deepEqual(
    findOversized(files).map((f) => f.path),
    ['images/big.JPG', 'images/Gallery Photos/x.jpeg'],
  );
});

test('report explains how to fix the problem', () => {
  const report = formatReport([{ path: 'a.jpg', size: 5 * 1024 * 1024 }]);
  assert.match(report, /a\.jpg: 5\.0 MB/);
  assert.match(report, /2000px/);
});
