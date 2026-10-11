// Fails when a change adds or modifies an image larger than the budget.
// Phone photos are often 5-15 MB; the site never needs more than ~1 MB.
// Usage: node scripts/check-image-budget.mjs <base-sha> [max-bytes]
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

export const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i;
export const DEFAULT_MAX = 1024 * 1024;

/** Pick out oversized images from a list of { path, size } entries. */
export function findOversized(files, max = DEFAULT_MAX) {
  return files.filter((f) => IMAGE_EXT.test(f.path) && f.size > max);
}

export function formatReport(oversized, max = DEFAULT_MAX) {
  const lines = oversized.map((f) => `  ${f.path}: ${(f.size / 1024 / 1024).toFixed(1)} MB`);
  return [
    `These images exceed the ${(max / 1024 / 1024).toFixed(1)} MB budget:`,
    ...lines,
    '',
    'Resize to at most 2000px on the long edge and re-export (JPEG quality ~80),',
    'e.g. with https://squoosh.app or `npx sharp-cli -i in.jpg -o out.jpg resize 2000`.',
  ].join('\n');
}

function changedFiles(base) {
  const valid = base && !/^0+$/.test(base);
  const args = valid
    ? ['diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`]
    : ['diff-tree', '--no-commit-id', '--name-only', '--diff-filter=AM', '-r', 'HEAD'];
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const [base, maxArg] = process.argv.slice(2);
  const max = Number(maxArg) || DEFAULT_MAX;
  const files = changedFiles(base).map((path) => {
    try {
      return { path, size: statSync(path).size };
    } catch {
      return { path, size: 0 };
    }
  });
  const oversized = findOversized(files, max);
  if (oversized.length) {
    for (const f of oversized) console.log(`::error file=${f.path}::Image is over budget`);
    console.error(formatReport(oversized, max));
    process.exit(1);
  }
  console.log(
    `Image budget OK (${files.filter((f) => IMAGE_EXT.test(f.path)).length} changed images checked).`,
  );
}
