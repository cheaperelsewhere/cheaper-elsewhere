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
    image: 'https://i.ebayimg.com/images/g/example/s-l500.jpg',
    condition: 'New',
    seller: 'exampleseller123',
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
  assert.equal(normalizeSearchResponse(json)[0].url, 'https://www.ebay.com/itm/x');
});

test('drops items with a price but no usable url', () => {
  const json = { itemSummaries: [{ itemId: 'x', title: 't', price: { value: '5.00', currency: 'USD' } }] };
  assert.deepEqual(normalizeSearchResponse(json), []);
});

test('returns an empty array for missing or empty itemSummaries', () => {
  assert.deepEqual(normalizeSearchResponse({}), []);
  assert.deepEqual(normalizeSearchResponse({ itemSummaries: [] }), []);
});
