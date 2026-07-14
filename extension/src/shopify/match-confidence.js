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
// Unit A7: the comparison is on total landed cost (item price + shipping),
// not item price alone - a listing that's marginally cheaper on item price
// can cost more once shipping is added, which would be a false "cheaper"
// claim. A landed cost must beat the product's price by MIN_SAVINGS_PERCENT
// AND MIN_SAVINGS_ABSOLUTE to qualify. MIN_SAVINGS_ABSOLUTE is a flat number
// in whatever currency the comparison is already in - this codebase never
// converts currency, so "3" applies the same whether that currency happens
// to be GBP, USD, or EUR.
var MIN_SAVINGS_PERCENT = 0.1;
var MIN_SAVINGS_ABSOLUTE = 3;

// Allowlist of eBay condition strings that are unambiguously new. Fails closed:
// null, undefined, empty string, "Open box", "New other (see details)", or any
// unrecognised string all return false and the listing is excluded. An
// unchecked string must never be admitted — the user harm of claiming a used
// item is "cheaper" is the reason this gate exists.
var NEW_CONDITION_ALLOWLIST = ['New', 'Brand New', 'New with tags', 'New with box', 'New without tags'];

function isNewCondition(condition) {
  if (typeof condition !== 'string' || condition === '') return false;
  return NEW_CONDITION_ALLOWLIST.indexOf(condition) !== -1;
}

function meetsSavingsThreshold(savingsAmount, ownAmount) {
  return savingsAmount >= ownAmount * MIN_SAVINGS_PERCENT && savingsAmount >= MIN_SAVINGS_ABSOLUTE;
}

// listing.shippingCost is set by the worker's normalizeSearchResponse (the
// cheapest numeric shippingOptions[] entry, or null if every option is
// calculated-at-checkout/pickup/freight with no usable number - see
// worker/src/ebay-response.js). A null or differently-currencied shipping
// cost means landed cost can't be honestly computed, so this returns null
// and the listing abstains rather than being treated as free shipping.
function resolveLandedAmount(listing, currency) {
  var shipping = listing.shippingCost;
  if (!shipping || typeof shipping.amount !== 'number' || shipping.currency !== currency) return null;
  return listing.price.amount + shipping.amount;
}

// Shallow-copies a listing's own fields and adds landedCost - avoids
// hardcoding the worker's listing field names here, and avoids mutating the
// input, since this function (like findCheaperListing) is pure.
function withLandedCost(listing, landedAmount, currency) {
  var result = {};
  for (var key in listing) {
    if (listing.hasOwnProperty(key)) result[key] = listing[key];
  }
  result.landedCost = { amount: landedAmount, currency: currency };
  return result;
}

function findCheaperListing(product, lookupResult) {
  if (!product || !product.hasStrongIdentifier) return null;
  if (!lookupResult || lookupResult.abstained) return null;

  var listings = Array.isArray(lookupResult.listings) ? lookupResult.listings : [];
  if (listings.length === 0) return null;

  // Condition gate: exclude any listing not explicitly recognised as new.
  // This is a backstop even when the worker query filter is active — a
  // silently-ignored or malformed filter must not let a used item through.
  listings = listings.filter(function (listing) {
    return listing && isNewCondition(listing.condition);
  });
  if (listings.length === 0) return null;

  var ownPrice = product.selectedVariant && product.selectedVariant.price;
  if (!ownPrice || typeof ownPrice.amount !== 'number') return null;

  // Stage 1: same currency + numeric price + cheaper on item price alone.
  // Shipping only adds cost, so a listing that isn't even cheaper here can
  // never qualify once shipping is added - no point resolving shipping for
  // listings that were never going to qualify.
  var priceCandidates = listings.filter(function (listing) {
    return (
      listing &&
      listing.price &&
      listing.price.currency === ownPrice.currency &&
      typeof listing.price.amount === 'number' &&
      listing.price.amount < ownPrice.amount
    );
  });
  if (priceCandidates.length === 0) return null;

  // Stage 2: resolve landed cost only for stage-1 survivors, dropping any
  // listing whose shipping cost can't be confidently determined.
  var landedCandidates = [];
  priceCandidates.forEach(function (listing) {
    var landedAmount = resolveLandedAmount(listing, ownPrice.currency);
    if (landedAmount !== null) {
      landedCandidates.push({ listing: listing, landedAmount: landedAmount });
    }
  });
  if (landedCandidates.length === 0) return null;

  // Stage 3: only landed costs that clear the minimum-savings threshold
  // qualify as a genuinely "cheaper" suggestion.
  var qualifying = landedCandidates.filter(function (candidate) {
    return meetsSavingsThreshold(ownPrice.amount - candidate.landedAmount, ownPrice.amount);
  });
  if (qualifying.length === 0) return null;

  var best = qualifying.reduce(function (champion, candidate) {
    return candidate.landedAmount < champion.landedAmount ? candidate : champion;
  });

  return withLandedCost(best.listing, best.landedAmount, ownPrice.currency);
}

var SPEMatchConfidence = {
  MIN_SAVINGS_PERCENT: MIN_SAVINGS_PERCENT,
  MIN_SAVINGS_ABSOLUTE: MIN_SAVINGS_ABSOLUTE,
  isNewCondition: isNewCondition,
  meetsSavingsThreshold: meetsSavingsThreshold,
  findCheaperListing: findCheaperListing,
};

if (typeof module !== 'undefined') {
  module.exports = SPEMatchConfidence;
}
