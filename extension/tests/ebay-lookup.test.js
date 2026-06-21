// Unit A4 - tests for the eBay Worker lookup call (extension/src/shopify/ebay-lookup.js).
// buildLookupQuery is pure (hand-authored inputs). fetchCheaperListings/lookupCheaperPrice
// wrap global fetch - mocked here the same way worker/tests mock fetch (save/restore
// global.fetch per test), since unlike page-adapter's fetch (tied to window.location, only
// meaningfully exercised live) this is just a fixed-URL POST with no DOM dependency.

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLookupQuery, fetchCheaperListings, lookupCheaperPrice } = require('../src/shopify/ebay-lookup.js');

// --- buildLookupQuery ---

test('buildLookupQuery: gtin + title + currency all forwarded (worker decides priority)', () => {
  const product = { currency: 'USD', title: 'Wireless Mouse', identifiers: { gtin: '036000291452' } };
  assert.deepEqual(buildLookupQuery(product), {
    gtin: '036000291452',
    title: 'Wireless Mouse',
    currency: 'USD',
  });
});

test('buildLookupQuery: no gtin -> title-only query', () => {
  const product = { currency: 'GBP', title: 'Moonlight Serenity Frame', identifiers: { gtin: null } };
  assert.deepEqual(buildLookupQuery(product), {
    gtin: null,
    title: 'Moonlight Serenity Frame',
    currency: 'GBP',
  });
});

test('buildLookupQuery: no currency -> null (abstain, no guessing)', () => {
  const product = { currency: null, title: 'Wireless Mouse', identifiers: { gtin: '036000291452' } };
  assert.equal(buildLookupQuery(product), null);
});

test('buildLookupQuery: neither gtin nor title -> null', () => {
  const product = { currency: 'USD', title: null, identifiers: { gtin: null } };
  assert.equal(buildLookupQuery(product), null);
});

test('buildLookupQuery: blank title is treated as absent', () => {
  const product = { currency: 'USD', title: '   ', identifiers: { gtin: null } };
  assert.equal(buildLookupQuery(product), null);
});

test('buildLookupQuery: missing identifiers object does not throw', () => {
  const product = { currency: 'USD', title: 'Wireless Mouse' };
  assert.deepEqual(buildLookupQuery(product), { gtin: null, title: 'Wireless Mouse', currency: 'USD' });
});

test('buildLookupQuery: null product -> null', () => {
  assert.equal(buildLookupQuery(null), null);
});

// --- fetchCheaperListings / lookupCheaperPrice ---

test('lookupCheaperPrice: unbuildable query abstains without making any network call', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    throw new Error('should not be called');
  };
  try {
    const result = await lookupCheaperPrice({ currency: null, title: null, identifiers: {} }, 'https://worker.example/');
    assert.deepEqual(result, { listings: [], abstained: true });
    assert.equal(calls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchCheaperListings: happy path posts the query and returns the parsed JSON', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ listings: [{ itemId: 'v1|1|0' }], abstained: false }) };
  };
  try {
    const result = await fetchCheaperListings({ gtin: null, title: 'shirt', currency: 'USD' }, 'https://worker.example/');
    assert.deepEqual(result, { listings: [{ itemId: 'v1|1|0' }], abstained: false });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://worker.example/');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].init.body, JSON.stringify({ gtin: null, title: 'shirt', currency: 'USD' }));
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchCheaperListings: non-OK response abstains instead of throwing', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const result = await fetchCheaperListings({ gtin: null, title: 'shirt', currency: 'USD' }, 'https://worker.example/');
    assert.deepEqual(result, { listings: [], abstained: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchCheaperListings: network error abstains instead of throwing', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    const result = await fetchCheaperListings({ gtin: null, title: 'shirt', currency: 'USD' }, 'https://worker.example/');
    assert.deepEqual(result, { listings: [], abstained: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test('lookupCheaperPrice: buildable query calls fetchCheaperListings against the given worker URL', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(url);
    return { ok: true, json: async () => ({ listings: [], abstained: false }) };
  };
  try {
    const product = { currency: 'USD', title: 'shirt', identifiers: { gtin: null } };
    const result = await lookupCheaperPrice(product, 'https://worker.example/lookup');
    assert.deepEqual(result, { listings: [], abstained: false });
    assert.deepEqual(calls, ['https://worker.example/lookup']);
  } finally {
    global.fetch = originalFetch;
  }
});
