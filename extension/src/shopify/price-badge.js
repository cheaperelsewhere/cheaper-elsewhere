// The actual visible UI for the price-comparison feature: a small,
// dismissible, shadow-DOM-isolated badge shown only when match-confidence.js
// found a genuinely cheaper, confidently-matched eBay listing. Decoupled
// from the (parked) dark-pattern detector's own indicator badge - separate
// host element, separate file, mounted in the opposite corner so the two
// features can never visually collide if both ever run on the same page.
//
// `:host { all: initial; }` is the same CSS-isolation technique used by
// content/indicator.js: it resets every inherited CSS property a hostile or
// just-unusual host page might otherwise leak into the shadow tree (font,
// color, line-height, etc.) before this file's own rules apply.

// Parked (kept, not used) until eBay Partner Network production credentials
// exist - see CLAUDE.md and worker/.dev.vars.example. EBAY_CAMPAIGN_ID is
// currently unset (confirmed in worker/.dev.vars during this unit's live
// verification), so links carry no affiliate tracking and no commission is
// actually earned yet - showing this text now would be a false claim.
var AFFILIATE_DISCLOSURE_TEXT_FUTURE_EPN =
  'This extension earns a commission from eBay purchases made through this link, at no extra cost to you.';

// Accurate for the current (sandbox, no EPN enrollment) build stage.
var AFFILIATE_DISCLOSURE_TEXT = 'This extension links to eBay listings. No affiliate commission is earned at this stage.';

var BADGE_CSS =
  ':host { all: initial; }' +
  '* { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; }' +
  '.badge-button { font-size: 13px; line-height: 1.3; color: #fff; background: #2a8703; border: none;' +
  ' border-radius: 8px; padding: 10px 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);' +
  ' max-width: 260px; text-align: left; display: block; }' +
  '.panel { font-size: 12px; line-height: 1.4; color: #222; background: #fff; border-radius: 8px;' +
  ' box-shadow: 0 2px 12px rgba(0,0,0,0.3); padding: 12px; max-width: 280px; margin-top: 6px; }' +
  '.panel[aria-hidden="true"] { display: none; }' +
  '.panel a { color: #2a52be; }' +
  '.disclosure { color: #666; margin: 8px 0 0; font-size: 11px; }' +
  '.dismiss { background: none; border: none; color: #888; cursor: pointer; float: right;' +
  ' font-size: 16px; line-height: 1; padding: 0; margin: 0 0 4px 8px; }';

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
  } catch (e) {
    return currency + ' ' + amount.toFixed(2);
  }
}

// Pure text-building, kept separate from DOM construction so it is
// unit-testable without jsdom.
//
// Unit A7: takes the full listing (not just its item price) because the
// "save" figure must come from listing.landedCost (item price + shipping -
// see match-confidence.js's findCheaperListing), the figure the cheaper-
// match decision was actually made on. Showing an item-only saving here
// would tell the user a number that doesn't match the decision behind it.
function buildSavingsText(ownPrice, listing) {
  if (!ownPrice || !listing || !listing.price || !listing.landedCost) return null;
  var savings = ownPrice.amount - listing.landedCost.amount;
  return (
    'Found for ' + formatMoney(listing.price.amount, listing.price.currency) + ' on eBay – save ' +
    formatMoney(savings, listing.landedCost.currency)
  );
}

// Idempotent like indicator.js's mountIndicator - a second call (e.g. if the
// settle pass somehow re-ran) returns the already-mounted API rather than
// stacking a duplicate badge.
function mountPriceBadge(cheaperListing, ownPrice) {
  var existing = document.getElementById('shopper-protection-ebay-badge');
  if (existing) return existing.__speApi;

  var host = document.createElement('div');
  host.id = 'shopper-protection-ebay-badge';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.bottom = '16px';
  host.style.left = '16px';
  document.documentElement.appendChild(host);

  var shadow = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = BADGE_CSS;
  shadow.appendChild(style);

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'badge-button';
  button.setAttribute('aria-expanded', 'false');
  button.textContent = buildSavingsText(ownPrice, cheaperListing) || 'Found cheaper on eBay';

  var panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('aria-hidden', 'true');

  var dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', function (event) {
    event.stopPropagation();
    host.remove();
  });

  var link = document.createElement('a');
  link.href = cheaperListing.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'View on eBay';

  var disclosure = document.createElement('p');
  disclosure.className = 'disclosure';
  disclosure.textContent = AFFILIATE_DISCLOSURE_TEXT;

  panel.appendChild(dismiss);
  panel.appendChild(link);
  panel.appendChild(disclosure);

  button.addEventListener('click', function () {
    var isOpen = panel.getAttribute('aria-hidden') !== 'true';
    panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  shadow.appendChild(button);
  shadow.appendChild(panel);

  var api = {
    remove: function () {
      host.remove();
    },
  };
  host.__speApi = api;
  return api;
}

var SPEPriceBadge = {
  AFFILIATE_DISCLOSURE_TEXT: AFFILIATE_DISCLOSURE_TEXT,
  AFFILIATE_DISCLOSURE_TEXT_FUTURE_EPN: AFFILIATE_DISCLOSURE_TEXT_FUTURE_EPN,
  buildSavingsText: buildSavingsText,
  mountPriceBadge: mountPriceBadge,
};

if (typeof module !== 'undefined') {
  module.exports = SPEPriceBadge;
}
