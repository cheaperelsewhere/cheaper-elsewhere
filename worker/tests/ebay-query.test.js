import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchQuery } from '../src/ebay-query.js';

test('prefers gtin over title when both present, for a recognized currency', () => {
  const result = buildSearchQuery({ gtin: '0012345678905', title: 'Wireless Mouse', currency: 'USD' });
  assert.deepEqual(result, { marketplaceId: 'EBAY_US', params: { gtin: '0012345678905' }, filter: 'conditions:{NEW}' });
});

test('falls back to title when gtin is absent', () => {
  const result = buildSearchQuery({ gtin: null, title: 'Wireless Mouse', currency: 'GBP' });
  assert.deepEqual(result, { marketplaceId: 'EBAY_GB', params: { q: 'Wireless Mouse' }, filter: 'conditions:{NEW}' });
});

test('treats a blank/whitespace gtin as absent and falls back to title', () => {
  const result = buildSearchQuery({ gtin: '   ', title: 'Wireless Mouse', currency: 'AUD' });
  assert.deepEqual(result, { marketplaceId: 'EBAY_AU', params: { q: 'Wireless Mouse' }, filter: 'conditions:{NEW}' });
});

// A16: the conditions:{NEW} filter must appear as a top-level field (not in
// params), because URLSearchParams.set() would percent-encode { } : and eBay
// silently ignores the filter when encoded that way. ebay-client.js appends
// it as a raw string instead. The client-side gate in match-confidence.js
// remains the authoritative backstop if the filter is ever ignored.
test('A16: every search query carries the conditions:{NEW} filter as a top-level field', () => {
  const byGtin = buildSearchQuery({ gtin: '0012345678905', currency: 'USD' });
  assert.equal(byGtin.filter, 'conditions:{NEW}');
  assert.equal('filter' in (byGtin.params || {}), false, 'filter must not be in params');

  const byTitle = buildSearchQuery({ gtin: null, title: 'Wireless Mouse', currency: 'GBP' });
  assert.equal(byTitle.filter, 'conditions:{NEW}');
  assert.equal('filter' in (byTitle.params || {}), false, 'filter must not be in params');
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
