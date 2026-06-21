import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFetchHandler } from '../src/index.js';

const ENV = {};

test('OPTIONS request gets CORS headers and no body', async () => {
  const handler = createFetchHandler(async () => []);
  const response = await handler(new Request('https://worker.test/', { method: 'OPTIONS' }), ENV);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('non-POST, non-OPTIONS methods are rejected', async () => {
  const handler = createFetchHandler(async () => []);
  const response = await handler(new Request('https://worker.test/', { method: 'GET' }), ENV);
  assert.equal(response.status, 405);
});

test('invalid JSON body returns 400', async () => {
  const handler = createFetchHandler(async () => []);
  const response = await handler(
    new Request('https://worker.test/', { method: 'POST', body: 'not json' }),
    ENV
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_json' });
});

test('valid request returns the listings from the search function', async () => {
  const fakeListings = [{ itemId: 'x', title: 't', price: { amount: 1, currency: 'USD' }, url: 'https://x' }];
  let receivedQuery;
  const handler = createFetchHandler(async (env, query) => {
    receivedQuery = query;
    return fakeListings;
  });
  const response = await handler(
    new Request('https://worker.test/', {
      method: 'POST',
      body: JSON.stringify({ gtin: '0012345678905', title: 'Mouse', currency: 'USD' }),
    }),
    ENV
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { listings: fakeListings, abstained: false });
  assert.deepEqual(receivedQuery, { gtin: '0012345678905', title: 'Mouse', currency: 'USD' });
});

test('a null result from the search function is reported as an abstain, not an error', async () => {
  const handler = createFetchHandler(async () => null);
  const response = await handler(
    new Request('https://worker.test/', { method: 'POST', body: JSON.stringify({ currency: 'EUR' }) }),
    ENV
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { listings: [], abstained: true });
});

test('a rejected search function call becomes a 502', async () => {
  const handler = createFetchHandler(async () => {
    throw new Error('eBay Browse API search failed: 500');
  });
  const response = await handler(
    new Request('https://worker.test/', { method: 'POST', body: JSON.stringify({ currency: 'USD' }) }),
    ENV
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'upstream_error' });
});

test('missing fields in the body are normalized to null rather than passed through as undefined', async () => {
  let receivedQuery;
  const handler = createFetchHandler(async (env, query) => {
    receivedQuery = query;
    return [];
  });
  await handler(new Request('https://worker.test/', { method: 'POST', body: JSON.stringify({}) }), ENV);
  assert.deepEqual(receivedQuery, { gtin: null, title: null, currency: null });
});
