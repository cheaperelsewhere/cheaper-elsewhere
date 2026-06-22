// Pure: normalizes an eBay Browse API item_summary/search response body into
// a stable listing shape. No network, no fetch.

// Unit A7: picks the cheapest shippingOptions[] entry that has a usable
// numeric shippingCost.value - the most favorable honest landed price. Some
// options (calculated-at-checkout, local pickup, freight) expose no number
// at all; those are skipped rather than treated as free. Returns null when
// no option yields a usable value, so the extension's match-confidence logic
// can abstain instead of guessing a shipping cost.
function extractShippingCost(item) {
  var options = Array.isArray(item && item.shippingOptions) ? item.shippingOptions : [];
  var cheapest = null;

  options.forEach(function (option) {
    var cost = option && option.shippingCost;
    if (!cost || typeof cost.value !== 'string') return;
    var amount = Number(cost.value);
    if (!isFinite(amount)) return;
    if (cheapest === null || amount < cheapest.amount) {
      cheapest = { amount: amount, currency: cost.currency || null };
    }
  });

  return cheapest;
}

// Items missing a price or a usable URL are dropped rather than passed
// through with nulls - a listing with no price or link is useless for a
// price-comparison suggestion, so it's not worth surfacing. A missing/
// unusable shippingCost is not a drop reason - the listing can still abstain
// later, per-listing, in match-confidence.js.
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
      // affiliateTracked records, per listing, which of the two was actually
      // used for `url` - the extension's disclosure copy is keyed off this
      // field directly rather than a build-time assumption about whether a
      // campaign ID happens to be configured (A11).
      var affiliateUrl = item && item.itemAffiliateWebUrl;
      var url = affiliateUrl || (item && item.itemWebUrl) || null;

      return {
        itemId: item.itemId || null,
        title: item.title || null,
        price: price,
        url: url,
        affiliateTracked: Boolean(affiliateUrl),
        image: (item.image && item.image.imageUrl) || null,
        condition: item.condition || null,
        seller: (item.seller && item.seller.username) || null,
        shippingCost: extractShippingCost(item),
      };
    })
    .filter(function (listing) {
      return listing.price !== null && listing.url !== null;
    });
}

export { normalizeSearchResponse };
