// Unit A2 - pure-helper tests for the live-page Shopify adapter
// (extension/src/shopify/page-adapter.js). Hand-authored inputs only, no
// network - the impure shell (fetch, location, document) is exercised
// separately via scripts/verify-adapter.js against real pages.

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const {
  parseProductPath,
  resolveSelectedVariantId,
  resolveCurrencyFromDocument,
  isLikelyShopifyPage,
} = require('../src/shopify/page-adapter.js');

function docFor(html) {
  return new JSDOM('<!doctype html><html><head></head><body>' + html + '</body></html>').window.document;
}

// --- parseProductPath ---

test('parseProductPath: no locale prefix', () => {
  assert.deepEqual(parseProductPath('/products/moonlight-serenity'), {
    localeRoot: '',
    handle: 'moonlight-serenity',
  });
});

test('parseProductPath: single-segment locale prefix', () => {
  assert.deepEqual(parseProductPath('/en-gb/products/moonlight-serenity'), {
    localeRoot: '/en-gb',
    handle: 'moonlight-serenity',
  });
});

test('parseProductPath: multi-segment locale root (real-world shape seen on mejuri.com: /gb/en/products/...)', () => {
  assert.deepEqual(parseProductPath('/gb/en/products/custom-nameplate-moulin'), {
    localeRoot: '/gb/en',
    handle: 'custom-nameplate-moulin',
  });
});

test('parseProductPath: trailing slash is stripped from the handle', () => {
  assert.deepEqual(parseProductPath('/products/moonlight-serenity/'), {
    localeRoot: '',
    handle: 'moonlight-serenity',
  });
});

test('parseProductPath: URL-encoded handle is decoded', () => {
  assert.deepEqual(parseProductPath('/products/foo%20bar'), { localeRoot: '', handle: 'foo bar' });
});

test('parseProductPath: not a product page at all -> null', () => {
  assert.equal(parseProductPath('/collections/all'), null);
});

test('parseProductPath: extra trailing path segment after the handle -> null (not a canonical product URL)', () => {
  assert.equal(parseProductPath('/products/moonlight-serenity/reviews'), null);
});

test('parseProductPath: empty/missing pathname -> null', () => {
  assert.equal(parseProductPath(''), null);
  assert.equal(parseProductPath(undefined), null);
});

// --- resolveSelectedVariantId ---

function variantsProduct(variants) {
  return { variants: variants };
}

test('resolveSelectedVariantId: ?variant= matches an existing variant id', () => {
  const product = variantsProduct([
    { id: 1, available: true },
    { id: 2, available: true },
  ]);
  assert.equal(resolveSelectedVariantId(product, '?variant=2'), 2);
});

test('resolveSelectedVariantId: ?variant= references an id not present -> falls back to first available', () => {
  const product = variantsProduct([
    { id: 1, available: false },
    { id: 2, available: true },
  ]);
  assert.equal(resolveSelectedVariantId(product, '?variant=999'), 2);
});

test('resolveSelectedVariantId: no ?variant= param -> first available variant, even if it is not first in the array', () => {
  const product = variantsProduct([
    { id: 1, available: false },
    { id: 2, available: true },
  ]);
  assert.equal(resolveSelectedVariantId(product, ''), 2);
});

test('resolveSelectedVariantId: no ?variant= param and nothing available -> first variant regardless', () => {
  const product = variantsProduct([
    { id: 1, available: false },
    { id: 2, available: false },
  ]);
  assert.equal(resolveSelectedVariantId(product, ''), 1);
});

test('resolveSelectedVariantId: no variants at all -> null', () => {
  assert.equal(resolveSelectedVariantId(variantsProduct([]), '?variant=1'), null);
});

// --- resolveCurrencyFromDocument ---

test('resolveCurrencyFromDocument: JSON-LD Product with a single offers object', () => {
  const doc = docFor(
    '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Product', offers: { '@type': 'Offer', priceCurrency: 'gbp' } }) +
      '</script>'
  );
  assert.equal(resolveCurrencyFromDocument(doc), 'GBP');
});

test('resolveCurrencyFromDocument: JSON-LD Product with offers as an array (real shape seen on cribofart.com)', () => {
  const doc = docFor(
    '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'Product',
        offers: [
          { '@type': 'Offer', priceCurrency: 'GBP', price: 30 },
          { '@type': 'Offer', priceCurrency: 'GBP', price: 53 },
        ],
      }) +
      '</script>'
  );
  assert.equal(resolveCurrencyFromDocument(doc), 'GBP');
});

test('resolveCurrencyFromDocument: JSON-LD with no "Product" @type anywhere, offers nested under "ProductGroup" (real shape seen on allbirds.com)', () => {
  const doc = docFor(
    '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'ProductGroup',
        offers: { '@type': 'Offer', priceCurrency: 'USD', price: 67 },
        hasVariant: [{ '@type': 'Product', url: '/products/foo' }],
      }) +
      '</script>'
  );
  assert.equal(resolveCurrencyFromDocument(doc), 'USD');
});

test('resolveCurrencyFromDocument: malformed JSON-LD does not throw, falls through to a meta tag', () => {
  const doc = docFor(
    '<script type="application/ld+json">{ not valid json</script>' +
      '<meta property="og:price:currency" content="EUR">'
  );
  assert.doesNotThrow(() => {
    assert.equal(resolveCurrencyFromDocument(doc), 'EUR');
  });
});

test('resolveCurrencyFromDocument: JSON-LD takes precedence over a meta tag when both present', () => {
  const doc = docFor(
    '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Product', offers: { priceCurrency: 'GBP' } }) +
      '</script>' +
      '<meta property="og:price:currency" content="USD">'
  );
  assert.equal(resolveCurrencyFromDocument(doc), 'GBP');
});

test('resolveCurrencyFromDocument: og:price:currency meta tag alone (no JSON-LD)', () => {
  const doc = docFor('<meta property="og:price:currency" content="usd">');
  assert.equal(resolveCurrencyFromDocument(doc), 'USD');
});

test('resolveCurrencyFromDocument: product:price:currency meta tag used when og: variant is absent', () => {
  const doc = docFor('<meta property="product:price:currency" content="CAD">');
  assert.equal(resolveCurrencyFromDocument(doc), 'CAD');
});

test('resolveCurrencyFromDocument: neither JSON-LD nor meta tags present -> null (abstain, no guessing)', () => {
  const doc = docFor('<p>No currency markup here.</p>');
  assert.equal(resolveCurrencyFromDocument(doc), null);
});

// --- isLikelyShopifyPage ---

test('isLikelyShopifyPage: window.Shopify global present', () => {
  const doc = docFor('<p>no markers</p>');
  assert.equal(isLikelyShopifyPage({ Shopify: { shop: 'example.myshopify.com' } }, doc), true);
});

test('isLikelyShopifyPage: cdn.shopify.com script reference present', () => {
  const doc = docFor('<script src="https://cdn.shopify.com/s/files/1/foo.js"></script>');
  assert.equal(isLikelyShopifyPage({}, doc), true);
});

test('isLikelyShopifyPage: shopify-digital-wallet meta tag present', () => {
  const doc = docFor('<meta name="shopify-digital-wallet" content="/123/digital_wallets/dialog">');
  assert.equal(isLikelyShopifyPage({}, doc), true);
});

test('isLikelyShopifyPage: no markers at all -> false', () => {
  const doc = docFor('<p>a perfectly ordinary non-Shopify page</p>');
  assert.equal(isLikelyShopifyPage({}, doc), false);
});
