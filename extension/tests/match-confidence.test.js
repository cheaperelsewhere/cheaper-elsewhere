// Unit A5 - tests for the match-confidence decision logic
// (extension/src/shopify/match-confidence.js). Pure, hand-authored inputs only.
// Unit A7 extended this to a landed-cost (item + shipping) comparison against
// a minimum-savings threshold - see the new "Unit A7" section below.

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

// Defaults to free shipping in the same currency, so pre-A7 tests that don't
// care about shipping keep exercising the same item-price comparison they
// always did. Pass shippingCost: null/override via extra to test shipping
// handling specifically.
function listing(amount, currency, extra) {
  return Object.assign(
    {
      itemId: 'v1|' + amount + currency + '|0',
      price: { amount: amount, currency: currency },
      shippingCost: { amount: 0, currency: currency },
    },
    extra
  );
}

function expectMatch(listing, landedAmount, currency) {
  return Object.assign({}, listing, { landedCost: { amount: landedAmount, currency: currency } });
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
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(cheap, 30, 'USD'));
});

test('a cheaper listing in a different currency is ignored - currency mismatch can not be honestly compared', () => {
  const result = { listings: [listing(10, 'GBP')], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('multiple qualifying listings -> the cheapest (landed) one wins', () => {
  const cheapest = listing(20, 'USD');
  const result = {
    listings: [listing(44, 'USD'), cheapest, listing(35, 'USD'), listing(10, 'EUR')],
    abstained: false,
  };
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(cheapest, 20, 'USD'));
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
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(valid, 15, 'USD'));
});

test('null product or null lookupResult -> null, no crash', () => {
  assert.equal(findCheaperListing(null, { listings: [], abstained: false }), null);
  assert.equal(findCheaperListing(product(), null), null);
});

// --- Unit A7: landed cost (item + shipping) vs the minimum-savings threshold ---

test('A7: cheaper on item price alone but not after shipping -> rejected (the core point of A7)', () => {
  // item-only savings: 10 (20%) - would have qualified under the old,
  // pre-A7 "any cheaper" rule. Landed savings: 2 (4%) - below both the 10%
  // and the flat-3 floor, so this must be rejected.
  const tooClose = listing(40, 'USD', { shippingCost: { amount: 8, currency: 'USD' } });
  const result = { listings: [tooClose], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('A7: cheaper on item price and still cheaper after shipping by >=10% and >=3 -> accepted, with landed savings', () => {
  const candidate = listing(35, 'USD', { shippingCost: { amount: 5, currency: 'USD' } });
  const result = { listings: [candidate], abstained: false };
  // landed = 35 + 5 = 40; savings = 10 (20%), not the item-only 15 (30%).
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(candidate, 40, 'USD'));
});

test('A7: free shipping (0.00) -> accepted, landed cost equals item price', () => {
  const candidate = listing(35, 'USD', { shippingCost: { amount: 0, currency: 'USD' } });
  const result = { listings: [candidate], abstained: false };
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(candidate, 35, 'USD'));
});

test('A7: unknown shipping cost on an otherwise-qualifying listing -> abstains', () => {
  const candidate = listing(30, 'USD', { shippingCost: null });
  const result = { listings: [candidate], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('A7: shipping cost in a different currency than the item -> abstains (no FX conversion)', () => {
  const candidate = listing(30, 'USD', { shippingCost: { amount: 2, currency: 'GBP' } });
  const result = { listings: [candidate], abstained: false };
  assert.equal(findCheaperListing(product(), result), null);
});

test('A7: among several qualifying listings, the lowest LANDED total wins, not the lowest item price', () => {
  // A: item 33 + shipping 11 = landed 44 (cheaper item price than B).
  // B: item 40 + shipping 2 = landed 42 (more expensive item price, but
  // cheaper landed total - B must win).
  const a = listing(33, 'USD', { shippingCost: { amount: 11, currency: 'USD' } });
  const b = listing(40, 'USD', { shippingCost: { amount: 2, currency: 'USD' } });
  const result = { listings: [a, b], abstained: false };
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(b, 42, 'USD'));
});

test('A7: multiple shipping-derived candidates, one with unknown shipping -> that one is excluded, not chosen', () => {
  const unknown = listing(20, 'USD', { shippingCost: null }); // would be cheapest if it qualified
  const known = listing(35, 'USD', { shippingCost: { amount: 5, currency: 'USD' } });
  const result = { listings: [unknown, known], abstained: false };
  assert.deepEqual(findCheaperListing(product(), result), expectMatch(known, 40, 'USD'));
});
