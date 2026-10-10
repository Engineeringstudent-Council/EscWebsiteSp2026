// Validates the site's JSON data files against their shared contracts.
// Zero config: every schemas/<name>.schema.json is checked against
// data/<name>.json and data/<name>.example.json when they exist.
// On top of the JSON Schema rules it runs checks a schema can't express:
// unique ids, cross-references, real dates, deadlines in the past, and
// image paths that exist with the exact same capitalization (macOS ignores
// case, the Linux web server does not).
// Usage: node scripts/validate-data.mjs   (or: npm run check:data)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a YYYY-MM-DD string naming a day that exists (no Feb 30). */
export function isRealDate(value) {
  const m = typeof value === 'string' && DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Today's date in Berkeley as YYYY-MM-DD. */
export function todayInBerkeley(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Look up a site-relative path one segment at a time, comparing names
 * exactly. Returns { exists: true } on an exact match, otherwise
 * { exists: false, suggestion } where suggestion is the real path when the
 * only problem is capitalization.
 */
export function findFileCaseSensitive(root, relPath) {
  const parts = posix.normalize(relPath).split('/');
  if (parts.some((p) => p === '..' || p === '')) return { exists: false };
  let dir = root;
  const actual = [];
  let caseMismatch = false;
  for (const part of parts) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return { exists: false };
    }
    let match = entries.find((e) => e === part);
    if (!match) {
      match = entries.find((e) => e.toLowerCase() === part.toLowerCase());
      if (!match) return { exists: false };
      caseMismatch = true;
    }
    actual.push(match);
    dir = join(dir, match);
  }
  return caseMismatch ? { exists: false, suggestion: actual.join('/') } : { exists: true };
}

/**
 * Build an Ajv instance for draft 2020-12 with string formats and the
 * custom `siteFile` keyword, which requires the string to name a file
 * that exists under `root` with exact case.
 */
export function createAjv({ root = ROOT } = {}) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, verbose: true });
  addFormats(ajv);
  ajv.addKeyword({
    keyword: 'siteFile',
    type: 'string',
    schemaType: 'boolean',
    errors: true,
    validate: function siteFile(enabled, value) {
      if (!enabled) return true;
      if (/^(\/|\.{1,2}\/|[a-z][a-z0-9+.-]*:)/i.test(value)) {
        siteFile.errors = [
          {
            keyword: 'siteFile',
            message: `"${value}" must be a path relative to the site root`,
            params: { relative: true },
          },
        ];
        return false;
      }
      const found = findFileCaseSensitive(root, value);
      if (found.exists) return true;
      siteFile.errors = [
        {
          keyword: 'siteFile',
          message: found.suggestion
            ? `"${value}" does not match the file's capitalization ("${found.suggestion}")`
            : `"${value}" does not exist in the repo`,
          params: { suggestion: found.suggestion },
        },
      ];
      return false;
    },
  });
  return ajv;
}

/** "/members/3/headshot" -> "members[3].headshot" */
export function toReadablePath(pointer) {
  if (!pointer) return '(top level)';
  return pointer
    .split('/')
    .slice(1)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((out, seg) => (/^\d+$/.test(seg) ? `${out}[${seg}]` : out ? `${out}.${seg}` : seg), '');
}

function shown(value) {
  const text = JSON.stringify(value);
  return text && text.length <= 60 ? ` (got ${text})` : '';
}

/** Turn one Ajv error into { path, message, hint } in plain language. */
export function describeAjvError(err) {
  const p = err.params ?? {};
  const desc = err.parentSchema?.description;
  switch (err.keyword) {
    case 'required':
      return {
        path: toReadablePath(err.instancePath),
        message: `missing required field "${p.missingProperty}"`,
        hint: `Add "${p.missingProperty}" to this entry.`,
      };
    case 'additionalProperties': {
      const allowed = Object.keys(err.parentSchema?.properties ?? {}).filter(
        (k) => k !== '$schema',
      );
      return {
        path: toReadablePath(`${err.instancePath}/${p.additionalProperty}`),
        message: `unknown field "${p.additionalProperty}"`,
        hint: `Remove it or fix the spelling. Allowed fields: ${allowed.join(', ')}.`,
      };
    }
    case 'enum':
      return {
        path: toReadablePath(err.instancePath),
        message: `is not an allowed value${shown(err.data)}`,
        hint: `Use one of: ${p.allowedValues.join(', ')}.`,
      };
    case 'format': {
      const hints = {
        date: 'Write dates as YYYY-MM-DD (e.g. 2027-02-15) and make sure the day exists.',
        email: 'Use a full email address like name@berkeley.edu.',
        uri: 'Use a full URL that starts with https://.',
      };
      return {
        path: toReadablePath(err.instancePath),
        message: `is not a valid ${p.format}${shown(err.data)}`,
        hint: hints[p.format] ?? desc,
      };
    }
    case 'type':
      return {
        path: toReadablePath(err.instancePath),
        message: `should be ${/^[aeiou]/.test(p.type) ? 'an' : 'a'} ${p.type}${shown(err.data)}`,
        hint:
          p.type === 'integer' || p.type === 'number'
            ? 'Write the number without quotes, e.g. 2027.'
            : p.type === 'boolean'
              ? 'Write true or false without quotes.'
              : desc,
      };
    case 'pattern':
      return {
        path: toReadablePath(err.instancePath),
        message: `has the wrong format${shown(err.data)}`,
        hint: desc,
      };
    case 'siteFile':
      return {
        path: toReadablePath(err.instancePath),
        message: err.message,
        hint: p.relative
          ? 'Drop any leading "/", "./" or "http(s)://..." part, e.g. "exec2025/Name.jpg", and keep the image in this repo.'
          : p.suggestion
            ? `Change it to "${p.suggestion}". macOS ignores capitalization, but the Linux web server treats them as different files, so the image would 404 on the live site.`
            : 'Add the image to the repo, or fix the path. Paths are relative to the site root, e.g. "exec2025/Name.jpg".',
      };
    default:
      return { path: toReadablePath(err.instancePath), message: err.message, hint: desc };
  }
}

function duplicates(items, key, basePath) {
  const seen = new Map();
  const out = [];
  items.forEach((item, i) => {
    const value = item?.[key];
    if (value === undefined) return;
    const norm = typeof value === 'string' ? value.toLowerCase() : value;
    if (seen.has(norm))
      out.push({ index: i, first: seen.get(norm), value, path: `${basePath}[${i}].${key}` });
    else seen.set(norm, i);
  });
  return out;
}

/** Cross-field checks for data/execs*.json. Assumes the schema already passed. */
export function checkExecs(data) {
  const issues = [];
  const members = data.members ?? [];
  const committees = data.committees ?? [];

  const [start, end] = data.term.split('-').map(Number);
  if (end !== start + 1) {
    issues.push({
      level: 'error',
      path: 'term',
      message: `"${data.term}" is not two consecutive years`,
      hint: `Use something like "${start}-${start + 1}".`,
    });
  }

  for (const d of duplicates(members, 'id', 'members')) {
    issues.push({
      level: 'error',
      path: d.path,
      message: `duplicate id "${d.value}" (also used by members[${d.first}])`,
      hint: 'Every member needs a unique id. Add a middle initial or number, e.g. "alex-chen-2".',
    });
  }
  for (const d of duplicates(committees, 'id', 'committees')) {
    issues.push({
      level: 'error',
      path: d.path,
      message: `duplicate committee id "${d.value}" (also used by committees[${d.first}])`,
      hint: 'Every committee needs a unique id.',
    });
  }

  // Co-holders of a role (or two officers on one committee, like the
  // treasurers) can share a role mailbox; anything else is a copy-paste slip.
  for (const d of duplicates(members, 'email', 'members')) {
    const a = members[d.first];
    const b = members[d.index];
    const shared = a.role === b.role || (a.committee && a.committee === b.committee);
    if (!shared) {
      issues.push({
        level: 'error',
        path: d.path,
        message: `email "${d.value}" is already used by ${a.name} (${a.role})`,
        hint: 'Only co-holders of the same role or committee should share a mailbox. Check for a copy-paste mistake.',
      });
    }
  }

  for (const d of duplicates(members, 'headshot', 'members')) {
    issues.push({
      level: 'warning',
      path: d.path,
      message: `same photo as ${members[d.first].name} ("${d.value}")`,
      hint: "Each person should have their own headshot. Leave the field out until you have this person's photo.",
    });
  }

  const ids = new Set(committees.map((c) => c.id));
  members.forEach((m, i) => {
    if (m.committee && !ids.has(m.committee)) {
      issues.push({
        level: 'error',
        path: `members[${i}].committee`,
        message: `refers to committee "${m.committee}", which is not in "committees"`,
        hint: ids.size
          ? `Use one of: ${[...ids].join(', ')}, or add a committee with this id.`
          : 'Add a "committees" list with an entry for this id.',
      });
    }
  });
  return issues;
}

/** Cross-field checks for data/opportunities*.json. Assumes the schema already passed. */
export function checkOpportunities(data, { today = todayInBerkeley(), isExample = false } = {}) {
  const issues = [];
  const items = data.opportunities ?? [];

  for (const d of duplicates(items, 'id', 'opportunities')) {
    issues.push({
      level: 'error',
      path: d.path,
      message: `duplicate id "${d.value}" (also used by opportunities[${d.first}])`,
      hint: 'Every opportunity needs a unique id. Adding the term helps, e.g. "urap-fall-2027".',
    });
  }
  for (const d of duplicates(items, 'url', 'opportunities')) {
    issues.push({
      level: 'warning',
      path: d.path,
      message: `same link as opportunities[${d.first}]`,
      hint: 'This may be a duplicate entry. Ignore if both really share one page.',
    });
  }

  items.forEach((o, i) => {
    for (const field of ['deadline', 'eventDate', 'postedDate']) {
      if (o[field] !== undefined && !isRealDate(o[field])) {
        issues.push({
          level: 'error',
          path: `opportunities[${i}].${field}`,
          message: `"${o[field]}" is not a real date`,
          hint: 'Write dates as YYYY-MM-DD (e.g. 2027-02-15) and make sure the day exists.',
        });
      }
    }
    if (o.deadline && o.postedDate && o.deadline < o.postedDate) {
      issues.push({
        level: 'error',
        path: `opportunities[${i}].deadline`,
        message: `deadline ${o.deadline} is before postedDate ${o.postedDate}`,
        hint: 'One of the two dates is probably mistyped.',
      });
    }
    // Example files are fixtures; their dates going stale is expected.
    if (isExample) return;
    if (o.deadline && o.deadline < today) {
      issues.push({
        level: 'warning',
        path: `opportunities[${i}].deadline`,
        message: `"${o.title}" closed on ${o.deadline}`,
        hint: 'Remove the entry or update the deadline for the next cycle.',
      });
    } else if (!o.deadline && o.eventDate && o.eventDate < today) {
      issues.push({
        level: 'warning',
        path: `opportunities[${i}].eventDate`,
        message: `"${o.title}" already happened on ${o.eventDate}`,
        hint: 'Remove the entry or update it for the next event.',
      });
    }
  });
  return issues;
}

/** Semantic checks per dataset name. Add a function here for new datasets. */
export const SEMANTIC_CHECKS = { execs: checkExecs, opportunities: checkOpportunities };

/**
 * Validate parsed data against a compiled schema validator, then run the
 * dataset's semantic checks if the schema passed. Pure apart from the
 * siteFile file-system lookups. Returns a list of issues.
 */
export function validateData({ name, data, validate, today, isExample = false }) {
  if (validate(data)) {
    const check = SEMANTIC_CHECKS[name];
    const issues = check ? check(data, { today, isExample }) : [];
    if (typeof data.$schema === 'string' && !data.$schema.endsWith(`${name}.schema.json`)) {
      issues.push({
        level: 'warning',
        path: '$schema',
        message: `points to "${data.$schema}" instead of the ${name} schema`,
        hint: `Use "../schemas/${name}.schema.json" so your editor autocompletes the right fields.`,
      });
    }
    return issues;
  }
  // "Not a valid uri" or "must be relative to the site root" already says
  // more than the generic pattern error for the same field, so drop the latter.
  const explained = new Set(
    validate.errors
      .filter((e) => e.keyword === 'format' || (e.keyword === 'siteFile' && e.params?.relative))
      .map((e) => e.instancePath),
  );
  return validate.errors
    .filter((e) => !(e.keyword === 'pattern' && explained.has(e.instancePath)))
    .map((err) => ({ level: 'error', ...describeAjvError(err) }));
}

/** Read and validate one data file. Returns { file, issues }. */
export function validateFile({ root = ROOT, name, file, validate, today }) {
  const rel = posix.join('data', file);
  let data;
  try {
    data = JSON.parse(readFileSync(join(root, 'data', file), 'utf8'));
  } catch (err) {
    return {
      file: rel,
      issues: [
        {
          level: 'error',
          path: '(file)',
          message: `is not valid JSON: ${err.message}`,
          hint: 'Look for a missing comma or quote, or a trailing comma after the last item. Running "npm run format" points at the exact spot.',
        },
      ],
    };
  }
  const isExample = file.endsWith('.example.json');
  return { file: rel, issues: validateData({ name, data, validate, today, isExample }) };
}

/**
 * Find every schema and the data files that belong to it, plus data files
 * that have no schema (usually a typo in the file name).
 */
export function discoverTargets(root = ROOT) {
  const list = (dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).sort() : []);
  const names = list('schemas')
    .filter((f) => f.endsWith('.schema.json'))
    .map((f) => f.slice(0, -'.schema.json'.length));
  const dataFiles = list('data').filter((f) => f.endsWith('.json'));
  const targets = names.map((name) => ({
    name,
    schemaFile: posix.join('schemas', `${name}.schema.json`),
    files: [`${name}.json`, `${name}.example.json`].filter((f) => dataFiles.includes(f)),
  }));
  const claimed = new Set(targets.flatMap((t) => t.files));
  const orphans = dataFiles.filter((f) => !claimed.has(f)).map((f) => posix.join('data', f));
  return { targets, orphans };
}

/** Format results for the terminal. */
export function formatReport(results, orphans = []) {
  const lines = [];
  let errors = 0;
  let warnings = 0;
  for (const { file, issues } of results) {
    const fileErrors = issues.filter((i) => i.level === 'error').length;
    errors += fileErrors;
    warnings += issues.length - fileErrors;
    lines.push(`${fileErrors ? '✖' : issues.length ? '⚠' : '✔'} ${file}`);
    for (const issue of issues) {
      lines.push(`    ${issue.level.padEnd(7)} ${issue.path}: ${issue.message}`);
      if (issue.hint) lines.push(`            fix: ${issue.hint}`);
    }
  }
  for (const file of orphans) {
    warnings += 1;
    lines.push(`⚠ ${file}`);
    lines.push(`    warning (file): no matching schema in schemas/, so it was not checked`);
    lines.push(
      `            fix: Name it after a schema, e.g. data/execs.json for schemas/execs.schema.json.`,
    );
  }
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  lines.push(
    '',
    `${plural(results.length, 'data file')} checked: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}.`,
  );
  if (errors) lines.push('See docs/DATA.md for the field reference.');
  return { text: lines.join('\n'), errors, warnings };
}

/** GitHub Actions annotations so problems show up inline on the PR. */
export function formatAnnotations(results) {
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return results.flatMap(({ file, issues }) =>
    issues.map(
      (i) =>
        `::${i.level} file=${file},title=${esc(i.path)}::${esc(`${i.message}. ${i.hint ?? ''}`)}`,
    ),
  );
}

/** Validate everything under `root`. Returns { code, text }. */
export function run({ root = ROOT, today = todayInBerkeley() } = {}) {
  const ajv = createAjv({ root });
  const { targets, orphans } = discoverTargets(root);
  const results = [];
  for (const target of targets) {
    const schema = JSON.parse(readFileSync(join(root, target.schemaFile), 'utf8'));
    const validate = ajv.compile(schema);
    for (const file of target.files) {
      results.push(validateFile({ root, name: target.name, file, validate, today }));
    }
  }
  const report = formatReport(results, orphans);
  return { code: report.errors ? 1 : 0, text: report.text, results };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const { code, text, results } = run();
  if (process.env.GITHUB_ACTIONS) for (const line of formatAnnotations(results)) console.log(line);
  (code ? console.error : console.log)(text);
  process.exit(code);
}
