// Unit A6 - tests for the price-comparison suggestion badge
// (extension/src/shopify/price-badge.js). buildSavingsText is pure text
// formatting, tested directly. mountPriceBadge is DOM construction - jsdom
// can exercise its structure/behavior (elements, click toggling, dismiss),
// but real shadow-DOM CSS isolation against a hostile page stylesheet is
// only meaningfully verified live, via Playwright (see scripts/), the same
// split already used for content/indicator.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { AFFILIATE_DISCLOSURE_TEXT, buildSavingsText, mountPriceBadge } = require('../src/shopify/price-badge.js');

// --- buildSavingsText ---
// Unit A7: buildSavingsText now takes the full listing (price + landedCost),
// not just an item price - the displayed "save" figure must come from
// landedCost (item + shipping), matching the figure findCheaperListing's
// decision was actually made on.

test('buildSavingsText: formats price and (landed) savings in USD', () => {
  const listing = { price: { amount: 11.99, currency: 'USD' }, landedCost: { amount: 11.99, currency: 'USD' } };
  const text = buildSavingsText({ amount: 50, currency: 'USD' }, listing);
  assert.equal(text, 'Found for $11.99 on eBay – save $38.01');
});

test('buildSavingsText: formats price and (landed) savings in GBP', () => {
  const listing = { price: { amount: 12.5, currency: 'GBP' }, landedCost: { amount: 12.5, currency: 'GBP' } };
  const text = buildSavingsText({ amount: 30, currency: 'GBP' }, listing);
  assert.equal(text, 'Found for £12.50 on eBay – save £17.50');
});

test('buildSavingsText: save reflects landed cost (item + shipping), not item price alone', () => {
  const listing = { price: { amount: 11.99, currency: 'USD' }, landedCost: { amount: 14.99, currency: 'USD' } };
  const text = buildSavingsText({ amount: 50, currency: 'USD' }, listing);
  assert.equal(text, 'Found for $11.99 on eBay – save $35.01');
});

test('buildSavingsText: missing ownPrice or listing -> null, no crash', () => {
  const listing = { price: { amount: 10, currency: 'USD' }, landedCost: { amount: 10, currency: 'USD' } };
  assert.equal(buildSavingsText(null, listing), null);
  assert.equal(buildSavingsText({ amount: 10, currency: 'USD' }, null), null);
});

test('buildSavingsText: listing missing landedCost (e.g. pre-A7 shape) -> null, no crash', () => {
  const listing = { price: { amount: 10, currency: 'USD' } };
  assert.equal(buildSavingsText({ amount: 50, currency: 'USD' }, listing), null);
});

test('buildSavingsText: malformed currency code falls back instead of throwing (Intl.NumberFormat rejects non-3-letter codes)', () => {
  const listing = {
    price: { amount: 10, currency: 'NOTACURRENCY' },
    landedCost: { amount: 10, currency: 'NOTACURRENCY' },
  };
  const text = buildSavingsText({ amount: 50, currency: 'NOTACURRENCY' }, listing);
  assert.equal(text, 'Found for NOTACURRENCY 10.00 on eBay – save NOTACURRENCY 40.00');
});

// --- mountPriceBadge ---

function freshDom() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  global.document = dom.window.document;
  return dom;
}

test('mountPriceBadge: mounts a shadow-DOM-isolated host with a collapsed badge and a hidden panel', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  assert.ok(host, 'host element mounted');
  assert.equal(host.shadowRoot.mode, 'open');

  const button = host.shadowRoot.querySelector('.badge-button');
  const panel = host.shadowRoot.querySelector('.panel');
  assert.equal(button.textContent, 'Found for $11.99 on eBay – save $38.01');
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
});

test('mountPriceBadge: clicking the badge toggles the panel open and closed', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  const button = host.shadowRoot.querySelector('.badge-button');
  const panel = host.shadowRoot.querySelector('.panel');

  button.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  assert.equal(panel.getAttribute('aria-hidden'), 'false');
  assert.equal(button.getAttribute('aria-expanded'), 'true');

  button.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('mountPriceBadge: panel contains the eBay link and the exact affiliate disclosure text', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  const link = host.shadowRoot.querySelector('a');
  const disclosure = host.shadowRoot.querySelector('.disclosure');

  assert.equal(link.href, 'https://sandbox.ebay.com/itm/1');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(disclosure.textContent, AFFILIATE_DISCLOSURE_TEXT);
});

test('mountPriceBadge: dismiss button removes the host from the document', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  const dismiss = host.shadowRoot.querySelector('.dismiss');
  dismiss.dispatchEvent(new document.defaultView.MouseEvent('click', { bubbles: true }));

  assert.equal(document.getElementById('shopper-protection-ebay-badge'), null);
});

test('mountPriceBadge: a second mount call is idempotent, returning the existing API instead of stacking a duplicate', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
  };
  const first = mountPriceBadge(listing, { amount: 50, currency: 'USD' });
  const second = mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  assert.equal(first, second);
  assert.equal(document.querySelectorAll('#shopper-protection-ebay-badge').length, 1);
});
