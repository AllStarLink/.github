// Tests the parsing functions embedded in the reusable workflow. The code is
// extracted from the workflow between the BEGIN/END parse markers so there is
// a single source of truth.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ai-disclosure.yml'), 'utf8');
const m = wf.match(/\/\/ BEGIN parse[^\n]*\n([\s\S]*?)\n\s*\/\/ END parse/);
assert.ok(m, 'parse markers not found in workflow');
const src = m[1].split('\n').map((l) => l.replace(/^ {12}/, '')).join('\n');
const { parseBody, hasAssistedByTrailer } = new Function(`${src}\nreturn { parseBody, hasAssistedByTrailer };`)();

const NONE = 'No AI use of *any kind at all*';
const SOME = 'Some AI involvement (AI-enabled IDE/development environment, some\ncode generation, AI-assisted debugging). Commits **MUST** include\nan `Assisted-by:` trailer and tools are listed next.';
const HEAVY = 'Heavy AI involvement (more than half of the PR is AI-generated code, AI\nperformed engineering or analysis of problems/solutions, etc.) Commits **MUST**\ninclude an `Assisted-by:` trailer and the tools are listed next.';
const ATT = [
  'I have reviewed every line of this change, understand it, and can explain and defend it in review without deferring to a tool',
  'I have built, run, and tested this change',
  "To my knowledge, this contribution does not violate any license, copyright, or third-party rights, and is compatible with this project's license",
  'This change contains no secrets, credentials, personal data, or non-public node or user information',
];
const box = (on, label, mark = 'x') => `- [${on ? mark : ' '}] ${label}`;
const build = ({ none = false, some = false, heavy = false, att = [true, true, true, true], mark = 'x', sep = '\n' } = {}) =>
  [
    'Did a thing.', '', '---', '',
    "Don't change anything after this except to check the boxes", '', '---', '',
    '## AI Use Disclosure ([ASL003](https://allstarlink.org/ai/))',
    '*Check exactly ONE of the first three boxes.*',
    box(none, NONE, mark), box(some, SOME, mark), box(heavy, HEAVY, mark), '',
    'AI tools used:', '',
    '## Contributor Attestation',
    ...ATT.map((l, i) => box(att[i], l, mark)),
  ].join(sep);

test('empty body fails', () => {
  for (const b of ['', '   \n ', null, undefined]) {
    const r = parseBody(b);
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /empty/);
  }
});

test('no boxes checked fails', () => {
  const r = parseBody(build({ att: [false, false, false, false] }));
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 5);
});

test('more than one disclosure box checked fails', () => {
  for (const opts of [
    { none: true, some: true },
    { none: true, heavy: true },
    { some: true, heavy: true },
    { none: true, some: true, heavy: true },
  ]) {
    const r = parseBody(build(opts));
    assert.equal(r.ok, false, JSON.stringify(opts));
    assert.match(r.errors[0], /more than one is checked/);
    assert.equal(r.level, null);
  }
});

test('no disclosure box checked fails', () => {
  const r = parseBody(build());
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /none is checked/);
});

test('one disclosure box plus all attestations passes', () => {
  for (const [level, material] of [['none', false], ['some', true], ['heavy', true]]) {
    const r = parseBody(build({ [level]: true }));
    assert.equal(r.ok, true, level);
    assert.equal(r.level, level);
    assert.equal(r.material, material, level);
  }
});

test('missing disclosure box fails with a restore message', () => {
  const r = parseBody(build({ some: true }).replace(/^- \[ \] Heavy AI involvement.*$/m, ''));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /checkboxes are missing/);
});

test('one attestation unchecked fails', () => {
  for (let i = 0; i < 4; i++) {
    const att = [true, true, true, true];
    att[i] = false;
    const r = parseBody(build({ none: true, att }));
    assert.equal(r.ok, false, `attestation ${i}`);
    assert.equal(r.errors.length, 1);
  }
});

test('uppercase [X] is accepted', () => {
  const r = parseBody(build({ heavy: true, mark: 'X' }));
  assert.equal(r.ok, true);
  assert.equal(r.material, true);
});

test('extra whitespace and CRLF are tolerated', () => {
  const body = build({ none: true, sep: '\r\n' })
    .replace(/^- \[x\]/gm, '  -   [ x ]   ')
    .replace(/^- \[ \]/gm, '*  [  ]  ');
  const r = parseBody(body);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('checked boxes inside HTML comments are ignored', () => {
  const body = '<!-- - [x] No AI use of any kind at all -->\n' + build({ some: true });
  assert.equal(parseBody(body).ok, true);
});

test('removed template sections fail with a restore message', () => {
  const r = parseBody('Just a description with no template.');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /missing/);
});

test('Assisted-by trailer detection', () => {
  assert.equal(hasAssistedByTrailer('Fix\n\nAssisted-by: Claude claude-sonnet-5\nSigned-off-by: A <a@b>'), true);
  assert.equal(hasAssistedByTrailer('Fix the thing\n\nSigned-off-by: A <a@b>'), false);
  assert.equal(hasAssistedByTrailer('Fix\n\nassisted-by: Copilot gpt'), true);
  assert.equal(hasAssistedByTrailer('Fix\n\nASSISTED-BY: Tool 1.0'), true);
  assert.equal(hasAssistedByTrailer('Mentions Assisted-by: in prose mid-line'), false);
  assert.equal(hasAssistedByTrailer('Assisted-by:'), false);
  assert.equal(hasAssistedByTrailer(''), false);
  assert.equal(hasAssistedByTrailer(undefined), false);
});
