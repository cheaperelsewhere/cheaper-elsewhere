// Pure: turns a minimal lookup query ({ gtin, title, currency }) into an eBay
// Browse API search shape, or null to abstain. No network, no fetch - the
// impure shell that actually calls eBay lives in ebay-client.js.

// Currency -> eBay marketplace ID, restricted to currencies that map to
// exactly one eBay site. EUR is deliberately excluded: eBay runs separate
// marketplaces per eurozone country (EBAY_DE, EBAY_FR, EBAY_IT, ...) and
// currency alone can't disambiguate which one - guessing one would silently
// search the wrong country's listings, so callers with EUR currently abstain
// until a future unit adds a country/locale signal.
var CURRENCY_TO_MARKETPLACE = {
  USD: 'EBAY_US',
  GBP: 'EBAY_GB',
  AUD: 'EBAY_AU',
  CAD: 'EBAY_ENCA',
};

// Builds the eBay Browse API search request shape for a query, or null if
// there isn't enough to search on (no recognized marketplace, or neither a
// gtin nor a title). GTIN is preferred over title when both are present -
// it's the strong identifier (mirrors hasStrongIdentifier elsewhere in the
// extension), so it gives an exact-product match instead of a keyword guess.
function buildSearchQuery(query) {
  var q = query || {};
  var marketplaceId = CURRENCY_TO_MARKETPLACE[q.currency] || null;
  if (!marketplaceId) return null;

  var gtin = typeof q.gtin === 'string' ? q.gtin.trim() : '';
  if (gtin) return { marketplaceId: marketplaceId, params: { gtin: gtin } };

  var title = typeof q.title === 'string' ? q.title.trim() : '';
  if (title) return { marketplaceId: marketplaceId, params: { q: title } };

  return null;
}

export { buildSearchQuery, CURRENCY_TO_MARKETPLACE };
