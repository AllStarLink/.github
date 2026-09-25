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

const NONE = 'No material AI involvement (none, or only trivial use such as autocomplete, spell/grammar check, or translation)';
const MATERIAL = 'Material AI involvement (significant generated code/text, or AI used to find an issue or design the approach). Commits include an `Assisted-by:` trailer, or tools are listed below.';
const ATT = [
  'I have reviewed every line of this change, understand it, and can explain and defend it in review without deferring to a tool',
  'I have built, run, and tested this change',
  "To my knowledge, this contribution does not violate any license, copyright, or third-party rights, and is compatible with this project's license",
  'This change contains no secrets, credentials, personal data, or non-public node or user information',
];
const box = (on, label, mark = 'x') => `- [${on ? mark : ' '}] ${label}`;
const build = ({ none = false, material = false, att = [true, true, true, true], mark = 'x', sep = '\n' } = {}) =>
  [
    '## Summary', 'Did a thing.', '',
    '## AI Use Disclosure ([ASL003](https://allstarlink.org/ai/))',
    '<!-- Check exactly ONE of the first two boxes. -->',
    box(none, NONE, mark), box(material, MATERIAL, mark), '',
    'Tools used (if material):', '',
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

test('both disclosure boxes checked fails', () => {
  const r = parseBody(build({ none: true, material: true }));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /both are checked/);
});

test('one disclosure box plus all attestations passes', () => {
  const a = parseBody(build({ none: true }));
  assert.equal(a.ok, true);
  assert.equal(a.material, false);
  const b = parseBody(build({ material: true }));
  assert.equal(b.ok, true);
  assert.equal(b.material, true);
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
  const r = parseBody(build({ material: true, mark: 'X' }));
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
  const body = '<!-- - [x] No material AI involvement -->\n' + build({ material: true });
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
