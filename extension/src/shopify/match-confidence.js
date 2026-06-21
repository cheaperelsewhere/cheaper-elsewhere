// Pure decision logic: given a NormalizedProduct (extract-product.js) and the
// eBay Worker's lookup result (ebay-lookup.js), decides whether there is a
// genuinely cheaper, confidently-matched listing worth suggesting - or
// abstains (null) rather than risk a wrong/misleading suggestion.
//
// Confidence is tied to hasStrongIdentifier: a GTIN-backed search asks eBay
// for that exact barcode, so any listing eBay returns is a real match for
// the product. A title/keyword-only search has no such guarantee - eBay's
// keyword search can return loosely related items - so without a GTIN there
// is no honest way to claim a returned listing IS the product, and this
// abstains rather than suggest a possibly-wrong "cheaper" item. Same house
// style as the currency/marketplace abstains elsewhere in this build.
//
// Known limitation: eBay listing prices don't include shipping cost (the
// worker's normalizeSearchResponse doesn't carry shipping data at all) - a
// listing that's marginally cheaper on item price alone could cost more once
// shipping is added. Not handled here; flag to planning if real-world
// testing shows this produces misleading suggestions.

function findCheaperListing(product, lookupResult) {
  if (!product || !product.hasStrongIdentifier) return null;
  if (!lookupResult || lookupResult.abstained) return null;

  var listings = Array.isArray(lookupResult.listings) ? lookupResult.listings : [];
  if (listings.length === 0) return null;

  var ownPrice = product.selectedVariant && product.selectedVariant.price;
  if (!ownPrice || typeof ownPrice.amount !== 'number') return null;

  var cheaper = listings.filter(function (listing) {
    return (
      listing &&
      listing.price &&
      listing.price.currency === ownPrice.currency &&
      typeof listing.price.amount === 'number' &&
      listing.price.amount < ownPrice.amount
    );
  });
  if (cheaper.length === 0) return null;

  return cheaper.reduce(function (best, listing) {
    return listing.price.amount < best.price.amount ? listing : best;
  });
}

var SPEMatchConfidence = {
  findCheaperListing: findCheaperListing,
};

if (typeof module !== 'undefined') {
  module.exports = SPEMatchConfidence;
}
