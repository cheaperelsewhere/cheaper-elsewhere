import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixturePath = fileURLToPath(new URL('./fixtures/oauth-token-response.json', import.meta.url));
const tokenFixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const ENV = { EBAY_API_BASE_URL: 'https://api.sandbox.ebay.com', EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret' };

// getApplicationToken caches its token at module scope, so each test imports
// a fresh module instance (cache-busting query string) to avoid one test's
// cached token leaking into the next.
async function freshModule(testName) {
  return import(`../src/ebay-auth.js?case=${testName}`);
}

test('fetches a token with Basic auth built from client id/secret, caches it, and refetches once expired', async (t) => {
  const { getApplicationToken } = await freshModule('cache-and-expiry');
  t.mock.timers.enable({ apis: ['Date'] });
  const originalFetch = global.fetch;
  let callCount = 0;
  let lastInit;
  global.fetch = async (url, init) => {
    callCount += 1;
    lastInit = init;
    return { ok: true, json: async () => tokenFixture };
  };

  try {
    const token = await getApplicationToken(ENV);
    assert.equal(token, tokenFixture.access_token);
    assert.equal(lastInit.headers.Authorization, 'Basic ' + Buffer.from('id:secret').toString('base64'));
    assert.equal(callCount, 1);

    // Immediate second call within the token's lifetime should reuse the cache.
    await getApplicationToken(ENV);
    assert.equal(callCount, 1);

    // Advance past expiry (7200s) plus the safety margin - should refetch.
    t.mock.timers.tick(7200 * 1000 + 61000);
    await getApplicationToken(ENV);
    assert.equal(callCount, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('throws when the token endpoint responds with a non-ok status', async () => {
  const { getApplicationToken } = await freshModule('non-ok-status');
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 401 });
  try {
    await assert.rejects(() => getApplicationToken(ENV), /401/);
  } finally {
    global.fetch = originalFetch;
  }
});
