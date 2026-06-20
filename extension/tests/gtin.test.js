const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidGtin } = require('../src/shopify/gtin.js');

// One real, well-known EAN-13 (commonly used as a GS1 checksum worked
// example) plus one freshly generated, checksum-correct code per length -
// each verified against this same right-to-left algorithm independently
// in Python before being hardcoded here.
const VALID_BY_LENGTH = {
  8: '10433218',
  12: '819600133892',
  13: '0838637940266',
  14: '54235116155943',
};

Object.keys(VALID_BY_LENGTH).forEach((length) => {
  test('isValidGtin: accepts a checksum-correct GTIN-' + length, () => {
    assert.equal(isValidGtin(VALID_BY_LENGTH[length]), true);
  });

  test('isValidGtin: rejects the same GTIN-' + length + ' with a corrupted check digit', () => {
    const code = VALID_BY_LENGTH[length];
    const lastDigit = Number(code.charAt(code.length - 1));
    const corrupted = code.slice(0, -1) + ((lastDigit + 1) % 10);
    assert.equal(isValidGtin(corrupted), false);
  });
});

test('isValidGtin: accepts a well-known EAN-13', () => {
  assert.equal(isValidGtin('4006381333931'), true);
});

test('isValidGtin: rejects an empty string', () => {
  assert.equal(isValidGtin(''), false);
});

test('isValidGtin: rejects non-numeric input', () => {
  assert.equal(isValidGtin('N/A'), false);
  assert.equal(isValidGtin('ABCDEFGH'), false);
});

test('isValidGtin: rejects a wrong-length numeric string', () => {
  assert.equal(isValidGtin('12345'), false); // 5 digits - not 8/12/13/14
  assert.equal(isValidGtin('123456789'), false); // 9 digits
});

test('isValidGtin: rejects null/undefined/non-string input without throwing', () => {
  assert.doesNotThrow(() => {
    assert.equal(isValidGtin(null), false);
    assert.equal(isValidGtin(undefined), false);
    assert.equal(isValidGtin(123456789012), false);
  });
});
