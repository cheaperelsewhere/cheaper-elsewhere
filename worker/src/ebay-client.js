// Impure shell: orchestrates a single eBay Browse API search - builds the
// query (pure), gets an application token, calls eBay, normalizes the
// response (pure). Abstains (returns null) before any network call at all
// when the query can't be built, so an unrecognized currency or empty query
// never wastes an OAuth round trip.
import { buildSearchQuery } from './ebay-query.js';
import { normalizeSearchResponse } from './ebay-response.js';
import { getApplicationToken } from './ebay-auth.js';

async function searchEbay(env, query) {
  var built = buildSearchQuery(query);
  if (!built) return null;

  var token = await getApplicationToken(env);

  var url = new URL(env.EBAY_API_BASE_URL + '/buy/browse/v1/item_summary/search');
  Object.keys(built.params).forEach(function (key) {
    url.searchParams.set(key, built.params[key]);
  });
  url.searchParams.set('limit', '10');
  // built.filter uses eBay's { } : syntax which URLSearchParams would percent-
  // encode, causing eBay to silently ignore the filter. Append as a raw string.
  var urlString = built.filter ? url.toString() + '&filter=' + built.filter : url.toString();

  var headers = {
    Authorization: 'Bearer ' + token,
    'X-EBAY-C-MARKETPLACE-ID': built.marketplaceId,
  };
  if (env.EBAY_CAMPAIGN_ID) {
    headers['X-EBAY-C-ENDUSERCTX'] = 'affiliateCampaignId=' + env.EBAY_CAMPAIGN_ID;
  }

  var response = await fetch(urlString, { headers: headers });
  if (!response.ok) {
    throw new Error('eBay Browse API search failed: ' + response.status);
  }

  var data = await response.json();
  return normalizeSearchResponse(data);
}

export { searchEbay };
