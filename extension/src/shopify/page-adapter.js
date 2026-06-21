// Live-page shell for the price-comparison feature: gathers the raw inputs
// extractProduct() needs from a real Shopify product page (URL, fetched
// product JSON, DOM-sourced currency) and calls it. Pure logic - URL parsing,
// variant resolution, currency resolution from a given document - is kept in
// plain functions that take their inputs as arguments and are unit-tested
// directly. Only the genuine I/O (fetch, reading location/document) lives in
// the shell at the bottom, which is exercised by Playwright against real
// pages instead, per the project's pure-core/thin-shell split.
var SPEExtractProduct = typeof module !== 'undefined' ? require('./extract-product') : SPEExtractProduct;
var SPEEbayLookup = typeof module !== 'undefined' ? require('./ebay-lookup') : SPEEbayLookup;

// Matches "/products/{handle}" optionally preceded by a locale root of one
// or more path segments (e.g. "/en-gb", or the real-world "/gb/en" seen on
// mejuri.com) and optionally followed by a trailing slash. A handle with
// anything else trailing (e.g. "/products/foo/reviews") is intentionally not
// matched - that is not a canonical Shopify product URL, so the caller
// abstains rather than guessing.
var PRODUCT_PATH_PATTERN = /^(.*)\/products\/([^\/?#]+)\/?$/;

function parseProductPath(pathname) {
  var match = PRODUCT_PATH_PATTERN.exec(pathname || '');
  if (!match || !match[2]) return null;
  return { localeRoot: match[1] || '', handle: decodeURIComponent(match[2]) };
}

// Primary: a ?variant= query param matched against a variant id in the
// fetched JSON. Fallback: first available variant, else just the first
// variant. Returns the raw id, matching extractProduct's pageContext.selectedVariantId.
function resolveSelectedVariantId(productJson, queryString) {
  var variants = Array.isArray(productJson && productJson.variants) ? productJson.variants : [];
  if (variants.length === 0) return null;

  var requestedParam = new URLSearchParams(queryString || '').get('variant');
  if (requestedParam !== null) {
    var requestedId = Number(requestedParam);
    var matched = variants.filter(function (v) {
      return v.id === requestedId;
    })[0];
    if (matched) return matched.id;
  }

  var firstAvailable = variants.filter(function (v) {
    return v.available === true;
  })[0];
  return firstAvailable ? firstAvailable.id : variants[0].id;
}

// Recursively scans a parsed JSON-LD payload for any "offers.priceCurrency",
// regardless of the enclosing @type. Deliberately not gated on
// @type === "Product": a real store (allbirds.com) was found serving its
// offers under a "ProductGroup" node instead, with no top-level "Product".
// Schema.org has many Product-ish subtypes; matching the shape (an "offers"
// key) rather than guessing every possible type name is the robust choice.
function findOffersCurrency(node) {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var found = findOffersCurrency(node[i]);
      if (found) return found;
    }
    return null;
  }

  if (node.offers) {
    var offers = Array.isArray(node.offers) ? node.offers : [node.offers];
    for (var j = 0; j < offers.length; j++) {
      var currency = offers[j] && typeof offers[j].priceCurrency === 'string' ? offers[j].priceCurrency.trim() : '';
      if (currency) return currency.toUpperCase();
    }
  }

  for (var key in node) {
    if (key === 'offers' || !node.hasOwnProperty(key)) continue;
    var nested = findOffersCurrency(node[key]);
    if (nested) return nested;
  }
  return null;
}

function resolveCurrencyFromJsonLd(doc) {
  if (!doc || !doc.querySelectorAll) return null;
  var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < scripts.length; i++) {
    var parsed;
    try {
      parsed = JSON.parse(scripts[i].textContent);
    } catch (e) {
      continue;
    }
    var currency = findOffersCurrency(parsed);
    if (currency) return currency;
  }
  return null;
}

function resolveCurrencyFromMeta(doc) {
  if (!doc || !doc.querySelector) return null;
  var selectors = ['meta[property="og:price:currency"]', 'meta[property="product:price:currency"]'];
  for (var i = 0; i < selectors.length; i++) {
    var el = doc.querySelector(selectors[i]);
    var content = el && typeof el.getAttribute === 'function' ? (el.getAttribute('content') || '').trim() : '';
    if (content) return content.toUpperCase();
  }
  return null;
}

// Currency is not in /products/{handle}.js. window.Shopify.currency.active is
// the canonical source but lives in the page's main world, unreachable from
// an isolated-world content script without a main-world bridge - out of
// scope for this unit (see page-adapter brief). DOM sources only; abstain
// (null) if neither yields a value rather than guess.
function resolveCurrencyFromDocument(doc) {
  return resolveCurrencyFromJsonLd(doc) || resolveCurrencyFromMeta(doc) || null;
}

// Cheap pre-fetch fingerprint so the broad */*products/* content-script match
// (required since stores live on arbitrary custom domains) doesn't fire a
// guessed-URL fetch against every non-Shopify site with "products" in a path
// segment. All three markers confirmed present on real Shopify storefronts
// (cribofart.com, allbirds.com) during this unit's live verification.
function isLikelyShopifyPage(win, doc) {
  if (win && win.Shopify && typeof win.Shopify === 'object') return true;
  if (!doc || !doc.querySelector) return false;
  if (doc.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]')) return true;
  if (doc.querySelector('meta[name="shopify-digital-wallet"], meta[name="shopify-checkout-api-token"]')) return true;
  return false;
}

// --- impure shell: fetch + live document/location, not unit-tested ---

function fetchProductJson(origin, localeRoot, handle) {
  var url = origin + localeRoot + '/products/' + handle + '.js';
  return fetch(url, { credentials: 'same-origin' })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .catch(function () {
      return null;
    });
}

function getNormalizedProductFromPage() {
  if (!isLikelyShopifyPage(window, document)) return Promise.resolve(null);

  var parsed = parseProductPath(window.location.pathname);
  if (!parsed) return Promise.resolve(null);

  return fetchProductJson(window.location.origin, parsed.localeRoot, parsed.handle).then(function (productJson) {
    if (!productJson) return null;

    var currency = resolveCurrencyFromDocument(document);
    if (!currency) return null;

    var selectedVariantId = resolveSelectedVariantId(productJson, window.location.search);
    return SPEExtractProduct.extractProduct(productJson, { currency: currency, selectedVariantId: selectedVariantId });
  });
}

if (typeof module === 'undefined') {
  getNormalizedProductFromPage().then(
    function (product) {
      if (product) {
        console.log('[Shopper Protection] adapter normalized product', product);
        SPEEbayLookup.lookupCheaperPrice(product, SPEEbayLookup.WORKER_URL).then(function (result) {
          console.log('[Shopper Protection] ebay-lookup result', result);
        });
      } else {
        console.log('[Shopper Protection] adapter abstained');
      }
    },
    function (err) {
      console.log('[Shopper Protection] adapter abstained (error)', err);
    }
  );
}

var SPEPageAdapter = {
  parseProductPath: parseProductPath,
  resolveSelectedVariantId: resolveSelectedVariantId,
  resolveCurrencyFromDocument: resolveCurrencyFromDocument,
  isLikelyShopifyPage: isLikelyShopifyPage,
  getNormalizedProductFromPage: getNormalizedProductFromPage,
};

if (typeof module !== 'undefined') {
  module.exports = SPEPageAdapter;
}
