import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ROOT,
  isRealDate,
  todayInBerkeley,
  findFileCaseSensitive,
  toReadablePath,
  createAjv,
  validateData,
  validateFile,
  checkExecs,
  checkOpportunities,
  discoverTargets,
  formatReport,
  formatAnnotations,
  run,
} from '../../scripts/validate-data.mjs';

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const clone = (v) => structuredClone(v);

const EXECS_EXAMPLE = readJson('data/execs.example.json');
const OPPS_EXAMPLE = readJson('data/opportunities.example.json');

// A throwaway site root with the real schemas and a couple of images, so
// file-existence checks don't depend on the repo's photos.
let root;
let validators;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'esc-data-'));
  await mkdir(join(root, 'schemas'));
  await mkdir(join(root, 'data'));
  await mkdir(join(root, 'exec2025'));
  for (const name of ['execs', 'opportunities']) {
    await copyFile(
      join(ROOT, 'schemas', `${name}.schema.json`),
      join(root, 'schemas', `${name}.schema.json`),
    );
  }
  await writeFile(join(root, 'exec2025', 'Evan.JPG'), '');
  await writeFile(join(root, 'exec2025', 'Laura.png'), '');
  const ajv = createAjv({ root });
  validators = {
    execs: ajv.compile(readJson('schemas/execs.schema.json')),
    opportunities: ajv.compile(readJson('schemas/opportunities.schema.json')),
  };
});

after(() => rm(root, { recursive: true, force: true }));

function execsDoc(member = {}) {
  return {
    term: '2025-2026',
    members: [
      {
        id: 'evan-wong',
        name: 'Evan Wong',
        role: 'Co-President',
        email: 'president@esc.studentorg.berkeley.edu',
        headshot: 'exec2025/Evan.JPG',
        ...member,
      },
    ],
    committees: [{ id: 'technical', name: 'Technical Committee', description: 'Runs the site.' }],
  };
}

function oppsDoc(fields = {}) {
  return {
    opportunities: [
      {
        id: 'urap-spring-2027',
        title: 'URAP',
        organization: 'UC Berkeley',
        type: 'research',
        url: 'https://urap.berkeley.edu/',
        ...fields,
      },
    ],
  };
}

const check = (name, data, opts = {}) =>
  validateData({ name, data, validate: validators[name], today: '2026-10-09', ...opts });
const errorsOf = (issues) => issues.filter((i) => i.level === 'error');
const warningsOf = (issues) => issues.filter((i) => i.level === 'warning');

/** Assert exactly one error at `path` whose message matches `re`, and that it has a hint. */
function assertOneError(issues, path, re) {
  const errors = errorsOf(issues);
  assert.equal(errors.length, 1, `expected one error, got ${JSON.stringify(errors, null, 2)}`);
  assert.equal(errors[0].path, path);
  assert.match(errors[0].message, re);
  assert.ok(errors[0].hint, 'every error should explain how to fix it');
}

describe('helpers', () => {
  test('isRealDate accepts real days and rejects impossible or malformed ones', () => {
    for (const ok of ['2026-10-09', '2024-02-29', '2000-02-29', '2027-12-31']) {
      assert.equal(isRealDate(ok), true, ok);
    }
    for (const bad of ['2026-02-30', '2025-02-29', '1900-02-29', '2026-13-01', '2026-00-10']) {
      assert.equal(isRealDate(bad), false, bad);
    }
    for (const bad of ['2026-1-5', '10/09/2026', '2026-10-09T00:00:00Z', '', null, 20261009]) {
      assert.equal(isRealDate(bad), false, String(bad));
    }
  });

  test('todayInBerkeley uses Pacific time', () => {
    // 05:00 UTC on Oct 10 is still Oct 9 in Berkeley.
    assert.equal(todayInBerkeley(new Date('2026-10-10T05:00:00Z')), '2026-10-09');
    assert.match(todayInBerkeley(), /^\d{4}-\d{2}-\d{2}$/);
  });

  test('findFileCaseSensitive matches exact case only and suggests the real name', () => {
    assert.deepEqual(findFileCaseSensitive(root, 'exec2025/Evan.JPG'), { exists: true });
    assert.deepEqual(findFileCaseSensitive(root, 'exec2025/Evan.jpg'), {
      exists: false,
      suggestion: 'exec2025/Evan.JPG',
    });
    assert.deepEqual(findFileCaseSensitive(root, 'EXEC2025/laura.PNG'), {
      exists: false,
      suggestion: 'exec2025/Laura.png',
    });
    assert.deepEqual(findFileCaseSensitive(root, 'exec2025/Nobody.jpg'), { exists: false });
    assert.deepEqual(findFileCaseSensitive(root, 'missing-dir/Evan.JPG'), { exists: false });
    assert.deepEqual(findFileCaseSensitive(root, '../etc/passwd'), { exists: false });
    assert.deepEqual(findFileCaseSensitive(root, 'exec2025/Evan.JPG/x'), { exists: false });
  });

  test('toReadablePath turns JSON pointers into dotted paths', () => {
    assert.equal(toReadablePath(''), '(top level)');
    assert.equal(toReadablePath('/members/3/headshot'), 'members[3].headshot');
    assert.equal(toReadablePath('/opportunities/0/tags/2'), 'opportunities[0].tags[2]');
    assert.equal(toReadablePath('/a~1b'), 'a/b');
  });
});

describe('committed examples', () => {
  test('the real repo data passes with no errors or warnings', () => {
    const { code, results, text } = run({ root: ROOT, today: '2026-10-09' });
    assert.equal(code, 0, text);
    const files = results.map((r) => r.file);
    assert.ok(files.includes('data/execs.example.json'));
    assert.ok(files.includes('data/opportunities.example.json'));
    for (const r of results) assert.deepEqual(r.issues, [], `${r.file}\n${text}`);
  });

  test('examples point their $schema at the right file', () => {
    assert.equal(EXECS_EXAMPLE.$schema, '../schemas/execs.schema.json');
    assert.equal(OPPS_EXAMPLE.$schema, '../schemas/opportunities.schema.json');
  });

  test('every schema property documents itself with a description', () => {
    for (const name of ['execs', 'opportunities']) {
      const missing = [];
      const walk = (node, path) => {
        if (!node || typeof node !== 'object') return;
        for (const [key, prop] of Object.entries(node.properties ?? {})) {
          if (!prop.description) missing.push(`${path}.${key}`);
          walk(prop, `${path}.${key}`);
        }
        if (node.items) walk(node.items, `${path}[]`);
        for (const [key, def] of Object.entries(node.$defs ?? {})) walk(def, `$defs.${key}`);
      };
      walk(readJson(`schemas/${name}.schema.json`), name);
      assert.deepEqual(missing, [], `${name} schema fields without a description`);
    }
  });
});

describe('execs schema', () => {
  test('a minimal valid document passes', () => {
    assert.deepEqual(check('execs', execsDoc()), []);
  });

  test('a fully filled-in member passes', () => {
    const doc = execsDoc({
      pronouns: 'he/him',
      committee: 'technical',
      major: 'EECS',
      graduationYear: 2027,
      bio: 'Builds things.',
      linkedin: 'https://www.linkedin.com/in/evan-wong/',
    });
    assert.deepEqual(check('execs', doc), []);
  });

  test('missing required field', () => {
    const doc = execsDoc();
    delete doc.members[0].role;
    assertOneError(check('execs', doc), 'members[0]', /missing required field "role"/);
  });

  test('misspelled field lists the allowed ones', () => {
    const issues = check('execs', execsDoc({ nmae: 'Evan' }));
    assertOneError(issues, 'members[0].nmae', /unknown field "nmae"/);
    assert.match(issues[0].hint, /Allowed fields: id, name/);
  });

  test('non-Berkeley email', () => {
    const issues = check('execs', execsDoc({ email: 'evan@gmail.com' }));
    assertOneError(issues, 'members[0].email', /wrong format.*evan@gmail\.com/);
    assert.match(issues[0].hint, /berkeley\.edu/);
  });

  test('malformed email', () => {
    const issues = errorsOf(check('execs', execsDoc({ email: 'not an email@berkeley.edu' })));
    assert.ok(issues.some((i) => i.path === 'members[0].email' && /valid email/.test(i.message)));
  });

  test('quoted number', () => {
    const issues = check('execs', execsDoc({ graduationYear: '2027' }));
    assertOneError(issues, 'members[0].graduationYear', /should be an integer/);
    assert.match(issues[0].hint, /without quotes/);
  });

  test('id with spaces or capitals', () => {
    assertOneError(check('execs', execsDoc({ id: 'Evan Wong' })), 'members[0].id', /wrong format/);
  });

  test('bad term format', () => {
    const doc = { ...execsDoc(), term: '2025-26' };
    assertOneError(check('execs', doc), 'term', /wrong format/);
  });

  test('linkedin must be a profile URL', () => {
    assertOneError(
      check('execs', execsDoc({ linkedin: 'https://example.com/evan' })),
      'members[0].linkedin',
      /wrong format/,
    );
  });

  test('case-mismatched headshot fails and names the real file', () => {
    const issues = check('execs', execsDoc({ headshot: 'exec2025/Evan.jpg' }));
    assertOneError(issues, 'members[0].headshot', /capitalization.*exec2025\/Evan\.JPG/);
    assert.match(issues[0].hint, /Change it to "exec2025\/Evan\.JPG"/);
    assert.match(issues[0].hint, /Linux/);
  });

  test('missing headshot file fails', () => {
    const issues = check('execs', execsDoc({ headshot: 'exec2025/Nobody.jpg' }));
    assertOneError(issues, 'members[0].headshot', /does not exist/);
  });

  for (const bad of ['/exec2025/Evan.JPG', './exec2025/Evan.JPG', 'https://x.com/Evan.JPG']) {
    test(`non-relative headshot "${bad}" fails with one clear error`, () => {
      const issues = check('execs', execsDoc({ headshot: bad }));
      assertOneError(issues, 'members[0].headshot', /relative to the site root/);
    });
  }

  test('headshot must be an image and may not climb out of the site', () => {
    for (const bad of ['exec2025/../secret.png', 'exec2025/resume.pdf']) {
      const issues = errorsOf(check('execs', execsDoc({ headshot: bad })));
      assert.ok(issues.length > 0, bad);
      assert.ok(issues.every((i) => i.path === 'members[0].headshot'));
      assert.ok(
        issues.some((i) => /wrong format/.test(i.message)),
        bad,
      );
    }
  });

  test('reports every problem at once, not just the first', () => {
    const doc = execsDoc({ email: 'x', graduationYear: 'soon', extra: true });
    assert.equal(errorsOf(check('execs', doc)).length >= 3, true);
  });
});

describe('execs semantic checks', () => {
  test('duplicate member ids fail', () => {
    const doc = execsDoc();
    doc.members.push({ ...doc.members[0], name: 'Evan Wong II', headshot: 'exec2025/Laura.png' });
    assertOneError(check('execs', doc), 'members[1].id', /duplicate id "evan-wong".*members\[0\]/);
  });

  test('duplicate committee ids fail', () => {
    const doc = execsDoc();
    doc.committees.push({ ...doc.committees[0] });
    assertOneError(check('execs', doc), 'committees[1].id', /duplicate committee id/);
  });

  test('unknown committee reference fails and lists valid ids', () => {
    const issues = check('execs', execsDoc({ committee: 'tech' }));
    assertOneError(issues, 'members[0].committee', /"tech"/);
    assert.match(issues[0].hint, /technical/);
  });

  test('committee reference without a committees list fails', () => {
    const doc = execsDoc({ committee: 'technical' });
    delete doc.committees;
    const issues = check('execs', doc);
    assertOneError(issues, 'members[0].committee', /not in "committees"/);
    assert.match(issues[0].hint, /Add a "committees" list/);
  });

  test('co-holders of a role or committee may share a mailbox', () => {
    const doc = clone(EXECS_EXAMPLE);
    delete doc.$schema;
    // Example has both Co-Presidents on president@ and both treasurers on treasurer@.
    assert.deepEqual(checkExecs(doc), []);
  });

  test('unrelated roles sharing an email fail (copy-paste slip)', () => {
    const doc = execsDoc();
    doc.members.push({
      id: 'ethan-hu',
      name: 'Ethan Hu',
      role: 'Technical Director',
      email: 'PRESIDENT@esc.studentorg.berkeley.edu',
    });
    assertOneError(check('execs', doc), 'members[1].email', /already used by Evan Wong/);
  });

  test('two people with the same photo is a warning', () => {
    const doc = execsDoc();
    doc.members.push({
      id: 'laura-viera',
      name: 'Laura Viera',
      role: 'Co-President',
      email: 'president@esc.studentorg.berkeley.edu',
      headshot: 'exec2025/Evan.JPG',
    });
    const issues = check('execs', doc);
    assert.deepEqual(errorsOf(issues), []);
    assert.equal(warningsOf(issues).length, 1);
    assert.match(warningsOf(issues)[0].message, /same photo as Evan Wong/);
  });

  test('term must be consecutive years', () => {
    const issues = check('execs', { ...execsDoc(), term: '2025-2027' });
    assertOneError(issues, 'term', /consecutive/);
    assert.match(issues[0].hint, /2025-2026/);
  });

  test('semantic checks are skipped until the schema passes', () => {
    const doc = execsDoc({ committee: 'nope', email: 'bad' });
    const issues = check('execs', doc);
    assert.ok(issues.every((i) => i.path !== 'members[0].committee'));
  });
});

describe('opportunities schema', () => {
  test('a minimal valid document passes', () => {
    assert.deepEqual(check('opportunities', oppsDoc()), []);
  });

  test('an empty list is valid (nothing posted yet)', () => {
    assert.deepEqual(check('opportunities', { opportunities: [] }), []);
  });

  test('unknown type lists the allowed values', () => {
    const issues = check('opportunities', oppsDoc({ type: 'Internship' }));
    assertOneError(issues, 'opportunities[0].type', /not an allowed value.*"Internship"/);
    assert.match(issues[0].hint, /internship, research, scholarship/);
  });

  test('impossible deadline date', () => {
    const issues = check('opportunities', oppsDoc({ deadline: '2027-02-30' }));
    assertOneError(issues, 'opportunities[0].deadline', /not a valid date/);
    assert.match(issues[0].hint, /YYYY-MM-DD/);
  });

  test('US-style date', () => {
    assertOneError(
      check('opportunities', oppsDoc({ deadline: '02/15/2027' })),
      'opportunities[0].deadline',
      /not a valid date/,
    );
  });

  test('url must be a full https link', () => {
    assertOneError(
      check('opportunities', oppsDoc({ url: 'urap.berkeley.edu' })),
      'opportunities[0].url',
      /valid uri|wrong format/,
    );
    assertOneError(
      check('opportunities', oppsDoc({ url: 'http://urap.berkeley.edu/' })),
      'opportunities[0].url',
      /wrong format/,
    );
  });

  test('tags must be unique lowercase slugs', () => {
    assert.equal(
      errorsOf(check('opportunities', oppsDoc({ tags: ['EECS'] })))[0].path,
      'opportunities[0].tags[0]',
    );
    assert.equal(errorsOf(check('opportunities', oppsDoc({ tags: ['a', 'a'] }))).length, 1);
  });

  test('contact needs a valid email', () => {
    assertOneError(
      check('opportunities', oppsDoc({ contact: { name: 'Team' } })),
      'opportunities[0].contact',
      /missing required field "email"/,
    );
  });

  test('top-level typo is caught', () => {
    const issues = check('opportunities', { opportunites: [] });
    assert.deepEqual(
      issues.map((i) => [i.path, i.message]),
      [
        ['(top level)', 'missing required field "opportunities"'],
        ['opportunites', 'unknown field "opportunites"'],
      ],
    );
  });
});

describe('opportunities semantic checks', () => {
  test('duplicate ids fail', () => {
    const doc = oppsDoc();
    doc.opportunities.push({ ...doc.opportunities[0], url: 'https://example.berkeley.edu/' });
    assertOneError(check('opportunities', doc), 'opportunities[1].id', /duplicate id/);
  });

  test('duplicate links are a warning', () => {
    const doc = oppsDoc();
    doc.opportunities.push({ ...doc.opportunities[0], id: 'urap-fall-2027' });
    const issues = check('opportunities', doc);
    assert.deepEqual(errorsOf(issues), []);
    assert.match(warningsOf(issues)[0].message, /same link as opportunities\[0\]/);
  });

  test('deadline before posted date fails', () => {
    const issues = check(
      'opportunities',
      oppsDoc({ deadline: '2027-01-01', postedDate: '2027-02-01' }),
    );
    assertOneError(issues, 'opportunities[0].deadline', /before postedDate/);
  });

  test('impossible dates are caught even without the schema', () => {
    const issues = checkOpportunities(oppsDoc({ deadline: '2027-02-30' }), { today: '2026-10-09' });
    assertOneError(issues, 'opportunities[0].deadline', /not a real date/);
  });

  test('past deadline is a warning, not an error', () => {
    const issues = check('opportunities', oppsDoc({ deadline: '2026-10-08' }));
    assert.deepEqual(errorsOf(issues), []);
    assert.equal(warningsOf(issues).length, 1);
    assert.match(warningsOf(issues)[0].message, /closed on 2026-10-08/);
  });

  test('deadline today is still open', () => {
    assert.deepEqual(check('opportunities', oppsDoc({ deadline: '2026-10-09' })), []);
  });

  test('past event without a deadline is a warning', () => {
    const issues = check('opportunities', oppsDoc({ type: 'event', eventDate: '2026-01-01' }));
    assert.match(warningsOf(issues)[0].message, /already happened/);
  });

  test('example files do not warn about stale dates', () => {
    const issues = check('opportunities', oppsDoc({ deadline: '2020-01-01' }), {
      isExample: true,
    });
    assert.deepEqual(issues, []);
  });

  test('$schema pointing at the wrong schema is a warning', () => {
    const doc = { $schema: '../schemas/execs.schema.json', ...oppsDoc() };
    const issues = check('opportunities', doc);
    assert.equal(warningsOf(issues)[0].path, '$schema');
  });
});

describe('files, discovery and output', () => {
  test('invalid JSON is reported, not thrown', async () => {
    await writeFile(join(root, 'data', 'broken.json'), '{ "opportunities": [ }');
    const result = validateFile({
      root,
      name: 'opportunities',
      file: 'broken.json',
      validate: validators.opportunities,
    });
    await rm(join(root, 'data', 'broken.json'));
    assert.equal(result.file, 'data/broken.json');
    assertOneError(result.issues, '(file)', /not valid JSON/);
  });

  test('discoverTargets pairs schemas with data files and flags orphans', async () => {
    await writeFile(join(root, 'data', 'execs.json'), '{}');
    await writeFile(join(root, 'data', 'exec.json'), '{}');
    await writeFile(join(root, 'data', 'notes.txt'), '');
    const { targets, orphans } = discoverTargets(root);
    await Promise.all(
      ['execs.json', 'exec.json', 'notes.txt'].map((f) => rm(join(root, 'data', f))),
    );
    assert.deepEqual(targets, [
      { name: 'execs', schemaFile: 'schemas/execs.schema.json', files: ['execs.json'] },
      { name: 'opportunities', schemaFile: 'schemas/opportunities.schema.json', files: [] },
    ]);
    assert.deepEqual(orphans, ['data/exec.json']);
  });

  test('run exits non-zero and prints file, path, message and fix', async () => {
    const bad = execsDoc({ headshot: 'exec2025/evan.jpg' });
    await writeFile(join(root, 'data', 'execs.json'), JSON.stringify(bad));
    await writeFile(join(root, 'data', 'opportunities.example.json'), JSON.stringify(oppsDoc()));
    const { code, text } = run({ root, today: '2026-10-09' });
    await rm(join(root, 'data', 'execs.json'));
    await rm(join(root, 'data', 'opportunities.example.json'));
    assert.equal(code, 1);
    assert.match(text, /✖ data\/execs\.json/);
    assert.match(text, /error {3}members\[0\]\.headshot: /);
    assert.match(text, /fix: Change it to "exec2025\/Evan\.JPG"/);
    assert.match(text, /✔ data\/opportunities\.example\.json/);
    assert.match(text, /2 data files checked: 1 error, 0 warnings\./);
  });

  test('run passes when only warnings are found', async () => {
    await writeFile(
      join(root, 'data', 'opportunities.json'),
      JSON.stringify(oppsDoc({ deadline: '2020-01-01' })),
    );
    const { code, text } = run({ root, today: '2026-10-09' });
    await rm(join(root, 'data', 'opportunities.json'));
    assert.equal(code, 0);
    assert.match(text, /⚠ data\/opportunities\.json/);
    assert.match(text, /1 data file checked: 0 errors, 1 warning\./);
  });

  test('formatReport counts orphan files as warnings', () => {
    const { text, errors, warnings } = formatReport([], ['data/exec.json']);
    assert.equal(errors, 0);
    assert.equal(warnings, 1);
    assert.match(text, /no matching schema/);
  });

  test('formatAnnotations emits GitHub workflow commands', () => {
    const lines = formatAnnotations([
      {
        file: 'data/execs.json',
        issues: [{ level: 'error', path: 'members[0].id', message: 'bad\nid', hint: '100%' }],
      },
    ]);
    assert.deepEqual(lines, ['::error file=data/execs.json,title=members[0].id::bad%0Aid. 100%25']);
  });
});
