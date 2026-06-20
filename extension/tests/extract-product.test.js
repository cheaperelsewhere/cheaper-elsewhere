// Unit A1 - extractProduct() over a real Shopify /products/{handle}.js
// payload (extension/tests/fixtures/shopify-products/moonlight-serenity.json,
// see SOURCES.md for provenance) plus two synthetic fixtures isolating the
// GTIN-driven hasStrongIdentifier path.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { extractProduct } = require('../src/shopify/extract-product.js');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'shopify-products', 'moonlight-serenity.json');
const moonlight = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

const FIRST_VARIANT_ID = 49262226866516; // S / UNFRAMED POSTER - 3000 / compareAt 7600, barcode ""
const WHITE_S_VARIANT_ID = 49262227784020; // S / WHITE - 10500 / compareAt 22700, barcode ""

test('extractProduct: real fixture - every variant barcode is empty/null, so no strong identifier anywhere', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(product.hasStrongIdentifier, false);
});

test('extractProduct: real fixture - vendor, productType, identifiers.gtin, identifiers.sku', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(product.vendor, 'Crib of Art');
  assert.equal(product.productType, '2:3 framed paintings');
  assert.equal(product.identifiers.gtin, null);
  assert.ok(product.identifiers.sku, 'identifiers.sku should be present (non-null/non-empty)');
  assert.equal(product.identifiers.mpn, null);
});

test('extractProduct: real fixture - all 20 variants normalized, prices converted minor -> major units', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(product.variants.length, moonlight.variants.length);
  assert.equal(product.variants.length, 20);

  const first = product.variants.find((v) => v.id === FIRST_VARIANT_ID);
  assert.ok(first, 'expected to find the S / UNFRAMED POSTER variant');
  assert.equal(first.price.amount, 30);
  assert.equal(first.compareAtPrice.amount, 76);
  assert.equal(first.barcode, null);
  assert.equal(first.gtin, null);
  assert.equal(first.hasStrongIdentifier, false);
});

test('extractProduct: real fixture - currency comes only from pageContext, never guessed from the /en-gb/ URL', () => {
  const withCurrency = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(withCurrency.currency, 'GBP');
  assert.equal(withCurrency.variants[0].price.currency, 'GBP');

  const withoutCurrency = extractProduct(moonlight, { currency: null, selectedVariantId: null });
  assert.ok(moonlight.url.indexOf('/en-gb/') !== -1, 'fixture sanity check - url really does contain /en-gb/');
  assert.equal(withoutCurrency.currency, null);
  assert.equal(withoutCurrency.variants[0].price.currency, null);
});

test('extractProduct: real fixture - a given selectedVariantId resolves selectedVariant with its option values', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: WHITE_S_VARIANT_ID });
  assert.ok(product.selectedVariant);
  assert.equal(product.selectedVariant.id, WHITE_S_VARIANT_ID);
  assert.deepEqual(product.selectedVariant.optionValues, { Size: 'S', 'Frame Color': 'WHITE' });
  assert.equal(product.selectedVariant.price.amount, 105);
  assert.equal(product.selectedVariant.compareAtPrice.amount, 227);
});

test('extractProduct: real fixture - selectedVariantId null resolves selectedVariant to null', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(product.selectedVariant, null);
});

test('extractProduct: real fixture - featuredImage is the first image, normalized to https; images holds all of them', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.ok(moonlight.images[0].indexOf('//') === 0, 'fixture sanity check - raw URLs really are protocol-relative');
  assert.equal(product.featuredImage, 'https:' + moonlight.images[0]);
  assert.equal(product.images.length, moonlight.images.length);
  product.images.forEach((url) => assert.equal(url.indexOf('https://'), 0));
});

test('extractProduct: real fixture - descriptionText is plain text, entities decoded, no judgment applied to scarcity wording', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(typeof product.descriptionText, 'string');
  assert.ok(!/[<>]/.test(product.descriptionText), 'no leftover HTML tags');
  assert.ok(product.descriptionText.indexOf('"Moonlight Serenity" by Crib of Art') !== -1);
  // &amp; decoded to & - and the unverifiable scarcity claim passes through
  // unfiltered; A1 extracts, it never judges.
  assert.ok(product.descriptionText.indexOf('Exclusive & Limited to 250 pieces per design') !== -1);
});

test('extractProduct: real fixture - source tag is set', () => {
  const product = extractProduct(moonlight, { currency: 'GBP', selectedVariantId: null });
  assert.equal(product.source, 'shopify-product-json');
});

// --- Synthetic fixtures isolating the GTIN -> hasStrongIdentifier path ---

function syntheticProduct(barcode) {
  return {
    title: 'Synthetic Test Product',
    vendor: 'Test Vendor',
    type: 'Test Type',
    tags: [],
    description: '<p>A synthetic product for GTIN-path testing.</p>',
    url: '/products/synthetic-test-product',
    images: [],
    featured_image: null,
    options: [{ name: 'Title', position: 1, values: ['Default Title'] }],
    variants: [
      {
        id: 1,
        title: 'Default Title',
        options: ['Default Title'],
        sku: 'SYN-001',
        barcode: barcode,
        price: 1999,
        compare_at_price: null,
        available: true,
      },
    ],
  };
}

test('extractProduct: synthetic fixture - a valid EAN-13 barcode yields hasStrongIdentifier:true and a populated gtin', () => {
  const product = extractProduct(syntheticProduct('4006381333931'), { currency: 'USD', selectedVariantId: null });
  assert.equal(product.hasStrongIdentifier, true);
  assert.equal(product.identifiers.gtin, '4006381333931');
  assert.equal(product.variants[0].hasStrongIdentifier, true);
  assert.equal(product.variants[0].gtin, '4006381333931');
});

test('extractProduct: synthetic fixture - garbage barcodes (N/A, short numeric, letters) yield hasStrongIdentifier:false and gtin:null', () => {
  ['N/A', '12345', 'ABCDEFGHIJKLM'].forEach((garbage) => {
    const product = extractProduct(syntheticProduct(garbage), { currency: 'USD', selectedVariantId: null });
    assert.equal(product.hasStrongIdentifier, false, 'barcode: ' + garbage);
    assert.equal(product.identifiers.gtin, null, 'barcode: ' + garbage);
    assert.equal(product.variants[0].hasStrongIdentifier, false, 'barcode: ' + garbage);
  });
});
