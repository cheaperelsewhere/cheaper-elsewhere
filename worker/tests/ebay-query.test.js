import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchQuery } from '../src/ebay-query.js';

test('prefers gtin over title when both present, for a recognized currency', () => {
  const result = buildSearchQuery({ gtin: '0012345678905', title: 'Wireless Mouse', currency: 'USD' });
  assert.deepEqual(result, { marketplaceId: 'EBAY_US', params: { gtin: '0012345678905' } });
});

test('falls back to title when gtin is absent', () => {
  const result = buildSearchQuery({ gtin: null, title: 'Wireless Mouse', currency: 'GBP' });
  assert.deepEqual(result, { marketplaceId: 'EBAY_GB', params: { q: 'Wireless Mouse' } });
});

test('treats a blank/whitespace gtin as absent and falls back to title', () => {
  const result = buildSearchQuery({ gtin: '   ', title: 'Wireless Mouse', currency: 'AUD' });
  assert.deepEqual(result, { marketplaceId: 'EBAY_AU', params: { q: 'Wireless Mouse' } });
});

test('abstains when neither gtin nor title is present', () => {
  assert.equal(buildSearchQuery({ gtin: null, title: '', currency: 'USD' }), null);
});

test('abstains on an unrecognized currency even with a gtin present', () => {
  assert.equal(buildSearchQuery({ gtin: '0012345678905', title: 'Wireless Mouse', currency: 'EUR' }), null);
});

test('abstains when currency is missing', () => {
  assert.equal(buildSearchQuery({ gtin: '0012345678905', title: 'Wireless Mouse' }), null);
});
