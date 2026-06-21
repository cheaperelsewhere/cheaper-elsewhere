// Pure: normalizes an eBay Browse API item_summary/search response body into
// a stable listing shape. No network, no fetch.

// Items missing a price or a usable URL are dropped rather than passed
// through with nulls - a listing with no price or link is useless for a
// price-comparison suggestion, so it's not worth surfacing.
function normalizeSearchResponse(json) {
  var items = Array.isArray(json && json.itemSummaries) ? json.itemSummaries : [];

  return items
    .map(function (item) {
      var price =
        item && item.price && typeof item.price.value === 'string'
          ? { amount: Number(item.price.value), currency: item.price.currency || null }
          : null;
      // itemAffiliateWebUrl carries EPN tracking when a campaign ID is
      // configured; fall back to the plain itemWebUrl otherwise.
      var url = (item && (item.itemAffiliateWebUrl || item.itemWebUrl)) || null;

      return {
        itemId: item.itemId || null,
        title: item.title || null,
        price: price,
        url: url,
        image: (item.image && item.image.imageUrl) || null,
        condition: item.condition || null,
        seller: (item.seller && item.seller.username) || null,
      };
    })
    .filter(function (listing) {
      return listing.price !== null && listing.url !== null;
    });
}

export { normalizeSearchResponse };
