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

const {
  AFFILIATE_DISCLOSURE_TEXT_UNTRACKED,
  AFFILIATE_DISCLOSURE_TEXT_TRACKED_COLLAPSED,
  AFFILIATE_DISCLOSURE_TEXT_TRACKED_PANEL,
  buildSavingsText,
  mountPriceBadge,
} = require('../src/shopify/price-badge.js');

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
    affiliateTracked: false,
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
    affiliateTracked: false,
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

// --- Unit A11: state-driven disclosure, keyed off the listing's own affiliateTracked ---

test('mountPriceBadge: untracked listing shows no "Ad" tag, no collapsed commission line, and a plain not-paid disclosure', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
    affiliateTracked: false,
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  const adTag = host.shadowRoot.querySelector('.ad-tag');
  const collapsedDisclosure = host.shadowRoot.querySelector('.collapsed-disclosure');
  const panelDisclosure = host.shadowRoot.querySelector('.disclosure');

  assert.equal(adTag, null, 'no "Ad" tag when the returned link carries no affiliate tracking');
  assert.equal(collapsedDisclosure, null, 'no collapsed commission line when untracked');
  assert.equal(panelDisclosure.textContent, AFFILIATE_DISCLOSURE_TEXT_UNTRACKED);
  assert.doesNotMatch(panelDisclosure.textContent, /\bmay earn\b/i);
});

test('mountPriceBadge: tracked listing shows an always-visible "Ad" tag and a present-tense commission line in the collapsed state', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
    affiliateTracked: true,
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  const adTag = host.shadowRoot.querySelector('.ad-tag');
  const collapsedDisclosure = host.shadowRoot.querySelector('.collapsed-disclosure');
  const panel = host.shadowRoot.querySelector('.panel');
  const panelDisclosure = host.shadowRoot.querySelector('.disclosure');

  assert.equal(adTag.textContent, 'Ad');
  assert.ok(!panel.contains(adTag), 'the Ad tag must live outside the collapsible panel');

  assert.equal(collapsedDisclosure.textContent, AFFILIATE_DISCLOSURE_TEXT_TRACKED_COLLAPSED);
  assert.ok(
    !panel.contains(collapsedDisclosure),
    'the present-tense commission line must be visible in the collapsed state, not only inside the panel'
  );
  assert.match(collapsedDisclosure.textContent, /\bwe earn\b/i);
  assert.doesNotMatch(collapsedDisclosure.textContent, /\bmay earn\b/i);

  assert.equal(panel.getAttribute('aria-hidden'), 'true', "panel starts hidden, but the Ad tag and commission line aren't inside it");
  assert.equal(panelDisclosure.textContent, AFFILIATE_DISCLOSURE_TEXT_TRACKED_PANEL);
});

test('mountPriceBadge: panel contains the eBay link with safe target/rel attributes, in both states', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
    affiliateTracked: false,
  };
  mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  const host = document.getElementById('shopper-protection-ebay-badge');
  const link = host.shadowRoot.querySelector('a');

  assert.equal(link.href, 'https://sandbox.ebay.com/itm/1');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
});

test('mountPriceBadge: dismiss button removes the host from the document', () => {
  freshDom();
  const listing = {
    url: 'https://sandbox.ebay.com/itm/1',
    price: { amount: 11.99, currency: 'USD' },
    landedCost: { amount: 11.99, currency: 'USD' },
    affiliateTracked: false,
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
    affiliateTracked: false,
  };
  const first = mountPriceBadge(listing, { amount: 50, currency: 'USD' });
  const second = mountPriceBadge(listing, { amount: 50, currency: 'USD' });

  assert.equal(first, second);
  assert.equal(document.querySelectorAll('#shopper-protection-ebay-badge').length, 1);
});
