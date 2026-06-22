import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokenFixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/oauth-token-response.json', import.meta.url)), 'utf8')
);
const searchFixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/browse-search-response.json', import.meta.url)), 'utf8')
);

const ENV = {
  EBAY_API_BASE_URL: 'https://api.sandbox.ebay.com',
  EBAY_CLIENT_ID: 'id',
  EBAY_CLIENT_SECRET: 'secret',
};

// ebay-auth's token cache is module-scoped, so each test imports a fresh
// ebay-client (and transitively, a fresh ebay-auth) to avoid cross-test leakage.
async function freshSearchEbay(testName) {
  const mod = await import(`../src/ebay-client.js?case=${testName}`);
  return mod.searchEbay;
}

test('abstains without making any network call when the query cannot be built', async () => {
  const searchEbay = await freshSearchEbay('abstain');
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    throw new Error('should not be called');
  };
  try {
    const result = await searchEbay(ENV, { gtin: null, title: null, currency: 'EUR' });
    assert.equal(result, null);
    assert.equal(calls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

// ebay-client.js always imports the plain (non-busted) './ebay-auth.js'
// internally, so that module's token cache is shared across every test in
// this file regardless of cache-busting ebay-client.js itself - a token
// fetched by an earlier test can still be cached when a later test runs.
// Dispatching the fetch mock by URL rather than call order/count keeps every
// test correct either way, whether or not the auth call actually happens.
function mockFetchByUrl({ tokenResponse, searchResponse }) {
  const requests = [];
  const fn = async (url, init) => {
    const urlString = url.toString();
    requests.push({ url: urlString, init });
    if (urlString.includes('/identity/v1/oauth2/token')) return tokenResponse;
    return searchResponse;
  };
  return { fn, requests };
}

test('happy path: fetches a token, searches eBay with the right headers, and returns normalized listings', async () => {
  const searchEbay = await freshSearchEbay('happy-path');
  const originalFetch = global.fetch;
  const { fn, requests } = mockFetchByUrl({
    tokenResponse: { ok: true, json: async () => tokenFixture },
    searchResponse: { ok: true, json: async () => searchFixture },
  });
  global.fetch = fn;

  try {
    const listings = await searchEbay(
      { ...ENV, EBAY_CAMPAIGN_ID: 'camp123' },
      { gtin: null, title: 'Wireless Mouse', currency: 'GBP' }
    );

    assert.equal(listings.length, 1);
    assert.equal(listings[0].itemId, 'v1|110587956912|0');
    assert.equal(listings[0].affiliateTracked, true);

    const searchRequest = requests.find((r) => r.url.includes('/item_summary/search'));
    assert.match(searchRequest.url, /q=Wireless\+Mouse/);
    assert.equal(searchRequest.init.headers.Authorization, 'Bearer ' + tokenFixture.access_token);
    assert.equal(searchRequest.init.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_GB');
    assert.equal(searchRequest.init.headers['X-EBAY-C-ENDUSERCTX'], 'affiliateCampaignId=camp123');
  } finally {
    global.fetch = originalFetch;
  }
});

test('omits the campaign header when no campaign ID is configured', async () => {
  const searchEbay = await freshSearchEbay('no-campaign');
  const originalFetch = global.fetch;
  const { fn, requests } = mockFetchByUrl({
    tokenResponse: { ok: true, json: async () => tokenFixture },
    searchResponse: { ok: true, json: async () => searchFixture },
  });
  global.fetch = fn;

  try {
    await searchEbay(ENV, { gtin: '0012345678905', title: null, currency: 'USD' });
    const searchRequest = requests.find((r) => r.url.includes('/item_summary/search'));
    assert.equal('X-EBAY-C-ENDUSERCTX' in searchRequest.init.headers, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('propagates an error when the search call itself fails', async () => {
  const searchEbay = await freshSearchEbay('search-failure');
  const originalFetch = global.fetch;
  const { fn } = mockFetchByUrl({
    tokenResponse: { ok: true, json: async () => tokenFixture },
    searchResponse: { ok: false, status: 500 },
  });
  global.fetch = fn;

  try {
    await assert.rejects(
      () => searchEbay(ENV, { gtin: '0012345678905', title: null, currency: 'USD' }),
      /500/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
