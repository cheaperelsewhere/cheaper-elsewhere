// Worker entrypoint. Wraps the eBay search call as a handler factory
// (createFetchHandler) so tests can inject a fake search function instead of
// mocking global fetch through two layers of indirection - the default
// export wires the real searchEbay for actual deployment/wrangler dev.
import { searchEbay } from './ebay-client.js';

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
  });
}

function createFetchHandler(searchFn) {
  return async function fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    var body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }

    var query = {
      gtin: typeof body.gtin === 'string' ? body.gtin : null,
      title: typeof body.title === 'string' ? body.title : null,
      currency: typeof body.currency === 'string' ? body.currency : null,
    };

    var listings;
    try {
      listings = await searchFn(env, query);
    } catch (err) {
      return jsonResponse({ error: 'upstream_error' }, 502);
    }

    if (listings === null) {
      return jsonResponse({ listings: [], abstained: true }, 200);
    }
    return jsonResponse({ listings: listings, abstained: false }, 200);
  };
}

export { createFetchHandler, jsonResponse, CORS_HEADERS };

export default {
  fetch: createFetchHandler(searchEbay),
};
