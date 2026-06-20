// Pure normalization of a Shopify storefront product payload (the object
// returned by /products/{handle}.js) into a stable shape the rest of the
// price-comparison feature consumes. No network, no DOM, no async - the
// live-page adapter that supplies pageContext (currency, selected variant)
// and reads the real document is a separate, later unit.
var SPEGtin = typeof module !== 'undefined' ? require('./gtin') : SPEGtin;

var BLOCK_TAG_PATTERN = /<\/?(p|div|li|ul|ol|h[1-6]|br|tr|table)\b[^>]*>/gi;
var ANY_TAG_PATTERN = /<[^>]+>/g;
var NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeHtmlEntities(str) {
  return str.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (match, entity) {
    if (entity.charAt(0) === '#') {
      var isHex = entity.charAt(1).toLowerCase() === 'x';
      var code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    var key = entity.toLowerCase();
    return NAMED_ENTITIES.hasOwnProperty(key) ? NAMED_ENTITIES[key] : match;
  });
}

// Strips markup to plain text, preserving paragraph/list-item breaks as
// newlines. Pass-through only - no filtering or judgment of the content,
// e.g. unverifiable "exclusive / limited" scarcity wording stays in.
function stripHtmlToText(html) {
  if (typeof html !== 'string' || !html.trim()) return null;
  var withBreaks = html.replace(BLOCK_TAG_PATTERN, '\n');
  var noTags = withBreaks.replace(ANY_TAG_PATTERN, '');
  var decoded = decodeHtmlEntities(noTags);
  var lines = decoded
    .split('\n')
    .map(function (line) {
      return line.replace(/\s+/g, ' ').trim();
    })
    .filter(function (line) {
      return line.length > 0;
    });
  return lines.length > 0 ? lines.join('\n') : null;
}

function normalizeImageUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  if (url.indexOf('//') === 0) return 'https:' + url;
  if (url.indexOf('http://') === 0) return 'https://' + url.slice('http://'.length);
  return url;
}

function minorToMajor(minorUnits) {
  return typeof minorUnits === 'number' ? minorUnits / 100 : null;
}

function normalizeMoney(minorUnits, currency) {
  var amount = minorToMajor(minorUnits);
  return amount === null ? null : { amount: amount, currency: currency };
}

function normalizeVariant(rawVariant, optionNames, currency) {
  var rawBarcode = typeof rawVariant.barcode === 'string' ? rawVariant.barcode.trim() : '';
  var gtin = SPEGtin.isValidGtin(rawBarcode) ? rawBarcode : null;

  var optionValues = {};
  var rawOptionValues = Array.isArray(rawVariant.options) ? rawVariant.options : [];
  optionNames.forEach(function (name, index) {
    if (name) optionValues[name] = rawOptionValues[index] != null ? rawOptionValues[index] : null;
  });

  return {
    id: rawVariant.id,
    title: rawVariant.title,
    optionValues: optionValues,
    price: normalizeMoney(rawVariant.price, currency),
    compareAtPrice: rawVariant.compare_at_price != null ? normalizeMoney(rawVariant.compare_at_price, currency) : null,
    sku: rawVariant.sku || null,
    barcode: rawBarcode || null,
    gtin: gtin,
    hasStrongIdentifier: gtin !== null,
    available: !!rawVariant.available,
  };
}

function extractProduct(productJson, pageContext) {
  var ctx = pageContext || {};
  var currency = ctx.currency != null ? ctx.currency : null;
  var selectedVariantId = ctx.selectedVariantId != null ? ctx.selectedVariantId : null;

  var optionDefs = Array.isArray(productJson.options) ? productJson.options : [];
  var optionNames = optionDefs.map(function (def) {
    return def && typeof def === 'object' ? def.name : def;
  });

  var rawVariants = Array.isArray(productJson.variants) ? productJson.variants : [];
  var variants = rawVariants.map(function (rawVariant) {
    return normalizeVariant(rawVariant, optionNames, currency);
  });

  var selectedVariant =
    selectedVariantId != null
      ? variants.filter(function (v) {
          return v.id === selectedVariantId;
        })[0] || null
      : null;

  var images = (Array.isArray(productJson.images) ? productJson.images : [])
    .map(normalizeImageUrl)
    .filter(Boolean);
  var featuredImage = images.length > 0 ? images[0] : normalizeImageUrl(productJson.featured_image);

  var identifierBasis = selectedVariant || variants[0] || null;
  var identifiers = {
    barcode: identifierBasis ? identifierBasis.barcode : null,
    sku: identifierBasis ? identifierBasis.sku : null,
    gtin: identifierBasis ? identifierBasis.gtin : null,
    mpn: null,
  };

  var hasStrongIdentifier = selectedVariant
    ? selectedVariant.hasStrongIdentifier
    : variants.some(function (v) {
        return v.hasStrongIdentifier;
      });

  return {
    source: 'shopify-product-json',
    title: productJson.title,
    vendor: productJson.vendor || null,
    productType: productJson.type || null,
    tags: Array.isArray(productJson.tags) ? productJson.tags.slice() : [],
    descriptionText: stripHtmlToText(productJson.description),
    url: productJson.url || null,
    featuredImage: featuredImage,
    images: images,
    currency: currency,
    identifiers: identifiers,
    hasStrongIdentifier: hasStrongIdentifier,
    selectedVariant: selectedVariant,
    variants: variants,
  };
}

var SPEExtractProduct = {
  extractProduct: extractProduct,
};

if (typeof module !== 'undefined') {
  module.exports = SPEExtractProduct;
}
