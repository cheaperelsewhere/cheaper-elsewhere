// Calls the Cloudflare Worker (worker/) that proxies eBay Browse API
// lookups, from a NormalizedProduct (extract-product.js). Pure query
// building lives in buildLookupQuery; the impure fetch shell abstains
// (resolves { listings: [], abstained: true }) on any network/parse failure
// rather than throwing, since a failed lookup must never break the page or
// surface a wrong/guessed comparison - same house style as the worker's own
// buildSearchQuery (worker/src/ebay-query.js) abstaining before a network
// call when a query can't be honestly built.

var WORKER_URL = 'https://shopper-protection-ebay-worker.dwelluma.workers.dev';

// GTIN is forwarded alongside title rather than chosen between client-side -
// the worker's buildSearchQuery already prefers GTIN over title when both
// are present, so this just passes through what extractProduct found.
function buildLookupQuery(product) {
  if (!product) return null;

  var currency = typeof product.currency === 'string' ? product.currency : null;
  if (!currency) return null;

  var gtin = product.identifiers && typeof product.identifiers.gtin === 'string' ? product.identifiers.gtin : null;
  var title = typeof product.title === 'string' && product.title.trim() ? product.title : null;
  if (!gtin && !title) return null;

  return { gtin: gtin, title: title, currency: currency };
}

function fetchCheaperListings(query, workerUrl) {
  return fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
    .then(function (response) {
      return response.ok ? response.json() : { listings: [], abstained: true };
    })
    .catch(function () {
      return { listings: [], abstained: true };
    });
}

function lookupCheaperPrice(product, workerUrl) {
  var query = buildLookupQuery(product);
  if (!query) return Promise.resolve({ listings: [], abstained: true });
  return fetchCheaperListings(query, workerUrl || WORKER_URL);
}

var SPEEbayLookup = {
  WORKER_URL: WORKER_URL,
  buildLookupQuery: buildLookupQuery,
  fetchCheaperListings: fetchCheaperListings,
  lookupCheaperPrice: lookupCheaperPrice,
};

if (typeof module !== 'undefined') {
  module.exports = SPEEbayLookup;
}
