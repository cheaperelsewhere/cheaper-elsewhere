// Unit 2 - tests for the extended speLabelTextFor (now covers <label for>,
// wrapping <label>, aria-labelledby, and aria-label, in that precedence
// order, with a parentElement.textContent fallback unchanged from before).

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { speLabelTextFor } = require('../src/detectors/utils.js');

function bodyFor(html) {
  return new JSDOM('<!doctype html><body>' + html + '</body>').window.document;
}

test('speLabelTextFor: resolves via <label for>', () => {
  const doc = bodyFor('<input type="checkbox" id="a"><label for="a">Label for text</label>');
  assert.equal(speLabelTextFor(doc.querySelector('input')), 'Label for text');
});

test('speLabelTextFor: resolves via wrapping <label>', () => {
  const doc = bodyFor('<label><input type="checkbox"> Wrapping label text</label>');
  assert.equal(speLabelTextFor(doc.querySelector('input')).trim(), 'Wrapping label text');
});

test('speLabelTextFor: resolves via aria-labelledby (single id)', () => {
  const doc = bodyFor('<span id="ref">Referenced text</span><input type="checkbox" aria-labelledby="ref">');
  assert.equal(speLabelTextFor(doc.querySelector('input')), 'Referenced text');
});

test('speLabelTextFor: resolves via aria-labelledby with multiple space-separated ids, concatenated in order', () => {
  const doc = bodyFor(
    '<span id="part1">First part</span>' +
      '<span id="part2">second part</span>' +
      '<input type="checkbox" aria-labelledby="part1 part2">'
  );
  assert.equal(speLabelTextFor(doc.querySelector('input')), 'First part second part');
});

test('speLabelTextFor: resolves via aria-label', () => {
  const doc = bodyFor('<input type="checkbox" aria-label="Aria label text">');
  assert.equal(speLabelTextFor(doc.querySelector('input')), 'Aria label text');
});

test('speLabelTextFor: <label for> takes precedence over aria-label when both present', () => {
  const doc = bodyFor('<input type="checkbox" id="a" aria-label="aria text"><label for="a">label-for text</label>');
  assert.equal(speLabelTextFor(doc.querySelector('input')), 'label-for text');
});

test('speLabelTextFor: aria-labelledby takes precedence over aria-label when both present', () => {
  const doc = bodyFor(
    '<span id="ref">labelledby text</span><input type="checkbox" aria-labelledby="ref" aria-label="aria text">'
  );
  assert.equal(speLabelTextFor(doc.querySelector('input')), 'labelledby text');
});

test('speLabelTextFor: no association at all does not throw and returns empty', () => {
  const doc = bodyFor('<input type="checkbox">');
  let result;
  assert.doesNotThrow(() => {
    result = speLabelTextFor(doc.querySelector('input'));
  });
  assert.equal(result, '');
});

test('speLabelTextFor: aria-labelledby referencing a nonexistent id does not throw, falls through', () => {
  const doc = bodyFor('<input type="checkbox" id="b" aria-labelledby="missing"><label for="b">fallback label</label>');
  // label-for is checked first, so this doesn't exercise the missing-id path
  // directly, but confirms no throw when a referenced id can't be found at all.
  const doc2 = bodyFor('<input type="checkbox" aria-labelledby="missing">');
  let result;
  assert.doesNotThrow(() => {
    result = speLabelTextFor(doc2.querySelector('input'));
  });
  assert.equal(result, '');
});
