import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeSearchResponse } from '../src/ebay-response.js';

const fixturePath = fileURLToPath(new URL('./fixtures/browse-search-response.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('normalizes a complete item and prefers the affiliate URL', () => {
  const listings = normalizeSearchResponse(fixture);
  assert.equal(listings.length, 1);
  assert.deepEqual(listings[0], {
    itemId: 'v1|110587956912|0',
    title: 'Example Wireless Mouse - Black',
    price: { amount: 19.99, currency: 'USD' },
    url: 'https://www.ebay.com/itm/110587956912?campid=affiliate123',
    affiliateTracked: true,
    image: 'https://i.ebayimg.com/images/g/example/s-l500.jpg',
    condition: 'New',
    seller: 'exampleseller123',
    shippingCost: null,
  });
});

test('drops items with no price', () => {
  const listings = normalizeSearchResponse(fixture);
  assert.equal(listings.some((l) => l.itemId === 'v1|220987654321|0'), false);
});

test('falls back to itemWebUrl when no affiliate URL is present', () => {
  const json = {
    itemSummaries: [
      { itemId: 'x', title: 't', price: { value: '5.00', currency: 'USD' }, itemWebUrl: 'https://www.ebay.com/itm/x' },
    ],
  };
  const listing = normalizeSearchResponse(json)[0];
  assert.equal(listing.url, 'https://www.ebay.com/itm/x');
  assert.equal(listing.affiliateTracked, false);
});

// Unit A11: affiliateTracked is per-listing, not derived from whether a
// campaign ID happens to be configured for the request as a whole - two
// items in the same response can land on opposite sides of it.
test('affiliateTracked reflects whether itemAffiliateWebUrl was actually used, per listing', () => {
  const json = {
    itemSummaries: [
      {
        itemId: 'tracked',
        title: 't',
        price: { value: '5.00', currency: 'USD' },
        itemWebUrl: 'https://www.ebay.com/itm/tracked',
        itemAffiliateWebUrl: 'https://www.ebay.com/itm/tracked?campid=affiliate123',
      },
      {
        itemId: 'untracked',
        title: 't',
        price: { value: '5.00', currency: 'USD' },
        itemWebUrl: 'https://www.ebay.com/itm/untracked',
      },
    ],
  };
  const listings = normalizeSearchResponse(json);
  assert.equal(listings.find((l) => l.itemId === 'tracked').affiliateTracked, true);
  assert.equal(listings.find((l) => l.itemId === 'untracked').affiliateTracked, false);
});

test('drops items with a price but no usable url', () => {
  const json = { itemSummaries: [{ itemId: 'x', title: 't', price: { value: '5.00', currency: 'USD' } }] };
  assert.deepEqual(normalizeSearchResponse(json), []);
});

test('returns an empty array for missing or empty itemSummaries', () => {
  assert.deepEqual(normalizeSearchResponse({}), []);
  assert.deepEqual(normalizeSearchResponse({ itemSummaries: [] }), []);
});

// A16: condition field regression tests.
// The field exists in the API response and must survive normalisation; a missing
// condition field must normalise to null (not throw, not silently become undefined).
test('A16: condition field survives normalisation from a fixture item', () => {
  const listings = normalizeSearchResponse(fixture);
  assert.equal(listings[0].condition, 'New');
});

test('A16: an item with no condition field normalises to condition: null, not undefined', () => {
  const json = {
    itemSummaries: [
      { itemId: 'x', title: 't', price: { value: '5.00', currency: 'USD' }, itemWebUrl: 'https://www.ebay.com/itm/x' },
    ],
  };
  const listing = normalizeSearchResponse(json)[0];
  assert.equal(listing.condition, null);
});

// --- Unit A7: shippingCost extraction ---

function itemWith(shippingOptions) {
  return {
    itemId: 'x',
    title: 't',
    price: { value: '5.00', currency: 'USD' },
    itemWebUrl: 'https://www.ebay.com/itm/x',
    shippingOptions: shippingOptions,
  };
}

test('shippingCost: a free ($0.00) shipping option is captured, not treated as missing', () => {
  const json = { itemSummaries: [itemWith([{ shippingCost: { value: '0.00', currency: 'USD' } }])] };
  assert.deepEqual(normalizeSearchResponse(json)[0].shippingCost, { amount: 0, currency: 'USD' });
});

test('shippingCost: among several options, the cheapest numeric one is used', () => {
  const json = {
    itemSummaries: [
      itemWith([
        { shippingCost: { value: '12.50', currency: 'USD' } },
        { shippingCost: { value: '4.25', currency: 'USD' } },
        { shippingCost: { value: '6.00', currency: 'USD' } },
      ]),
    ],
  };
  assert.deepEqual(normalizeSearchResponse(json)[0].shippingCost, { amount: 4.25, currency: 'USD' });
});

test('shippingCost: missing shippingOptions entirely -> null', () => {
  const json = { itemSummaries: [itemWith(undefined)] };
  assert.equal(normalizeSearchResponse(json)[0].shippingCost, null);
});

test('shippingCost: options present but none have a usable numeric value (calculated/pickup/freight) -> null', () => {
  const json = {
    itemSummaries: [
      itemWith([
        { shippingCostType: 'CALCULATED' },
        { shippingCostType: 'PICKUP' },
        { shippingCost: { value: 'Calculated', currency: 'USD' } },
      ]),
    ],
  };
  assert.equal(normalizeSearchResponse(json)[0].shippingCost, null);
});
