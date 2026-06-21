// Unit A5 - tests for the match-confidence decision logic
// (extension/src/shopify/match-confidence.js). Pure, hand-authored inputs only.

const test = require('node:test');
const assert = require('node:assert/strict');

const { findCheaperListing } = require('../src/shopify/match-confidence.js');

function product(overrides) {
  return Object.assign(
    {
      hasStrongIdentifier: true,
      selectedVariant: { price: { amount: 50, currency: 'USD' } },
    },
    overrides
  );
}

function listing(amount, currency, extra) {
  return Object.assign(
    { itemId: 'v1|' + amount + currency + '|0', price: { amount: amount, currency: currency } },
    extra
  );
}

test('no strong identifier -> null even when a cheaper listing exists (no confident match possible)', () => {
  const p = product({ hasStrongIdentifier: false });
  const result = { listings: [listing(30, 'USD')], abstained: false };
  assert.equal(findCheaperListing(p, result), null);
});

test('lookup abstained -> null', () => {
  const result = { listings: [], abstained: true };
  assert.equal(findCheaperListing(product(), result), null);
});

test('no listings at all -> null', () => {
  const result = { listings: [], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('listings present but none cheaper -> null', () => {
  const result = { listings: [listing(50, 'USD'), listing(60, 'USD')], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('a single cheaper listing in the same currency is returned', () => {
  const cheap = listing(30, 'USD');
  const result = { listings: [listing(60, 'USD'), cheap], abstained: false };
  assert.equal(findCheaperListing(product(), result), cheap);
});

test('a cheaper listing in a different currency is ignored - currency mismatch can not be honestly compared', () => {
  const result = { listings: [listing(10, 'GBP')], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('multiple qualifying listings -> the cheapest one wins', () => {
  const cheapest = listing(20, 'USD');
  const result = {
    listings: [listing(45, 'USD'), cheapest, listing(35, 'USD'), listing(10, 'EUR')],
    abstained: false,
  };
  assert.equal(findCheaperListing(product(), result), cheapest);
});

test('missing selectedVariant price -> null, no crash', () => {
  const p = product({ selectedVariant: null });
  const result = { listings: [listing(10, 'USD')], abstained: false };
  assert.equal(findCheaperListing(p, result), null);
});

test('listing with a missing/non-numeric price is filtered out safely', () => {
  const valid = listing(15, 'USD');
  const result = {
    listings: [
      { itemId: 'v1|null-price|0', price: null },
      { itemId: 'v1|nan-price|0', price: { amount: 'not-a-number', currency: 'USD' } },
      valid,
    ],
    abstained: false,
  };
  assert.equal(findCheaperListing(product(), result), valid);
});

test('null product or null lookupResult -> null, no crash', () => {
  assert.equal(findCheaperListing(null, { listings: [], abstained: false }), null);
  assert.equal(findCheaperListing(product(), null), null);
});
