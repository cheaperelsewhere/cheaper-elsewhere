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

// Unit A11: disclosure is state-driven off each listing's own
// `affiliateTracked` flag (set by the worker - see worker/src/ebay-response.js),
// not a build-time constant swapped by hand at EPN-launch time. That hand-swap
// would create a drift window where a re-released extension and the live
// worker could disagree about whether commission is earned - exactly the
// false/under-disclosure this design exists to prevent. With
// EBAY_CAMPAIGN_ID still unset, every listing's affiliateTracked is false, so
// the untracked strings below are what a reviewer installing today sees.

// Untracked state: there is no ad, no affiliate link, no money - so no "Ad"
// label and no future/conditional commission language ("may earn" etc).
var AFFILIATE_DISCLOSURE_TEXT_UNTRACKED = "We're not paid for this link.";

// Tracked state, collapsed line: must be definite, present-tense, and live
// alongside the always-visible "Ad" tag in the collapsed badge (not only in
// the expandable panel) - the ASA treats "may earn" as misleading where a
// commission is always earned once tracking exists.
var AFFILIATE_DISCLOSURE_TEXT_TRACKED_COLLAPSED = 'We earn a commission if you buy through this.';

// Tracked state, panel line: the deeper "why am I seeing this?" reassurance,
// shown only once expanded.
var AFFILIATE_DISCLOSURE_TEXT_TRACKED_PANEL =
  'This is a paid link. We earn a commission from eBay if you buy through it, at no extra cost to ' +
  'you. We only show it when an eBay listing is genuinely cheaper for the same item, based on the ' +
  "total price including delivery. No account, and we don't track you.";

var BADGE_CSS =
  ':host { all: initial; }' +
  '* { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; }' +
  '.badge-wrap { position: relative; display: inline-block; }' +
  '.ad-tag { position: absolute; top: -8px; left: -6px; background: #555; color: #fff; font-size: 9px;' +
  ' font-weight: 700; letter-spacing: 0.4px; padding: 1px 5px; border-radius: 4px; line-height: 1.4; pointer-events: none; }' +
  '.badge-button { font-size: 13px; line-height: 1.3; color: #fff; background: #2a8703; border: none;' +
  ' border-radius: 8px; padding: 10px 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);' +
  ' max-width: 260px; text-align: left; display: block; }' +
  '.panel { font-size: 12px; line-height: 1.4; color: #222; background: #fff; border-radius: 8px;' +
  ' box-shadow: 0 2px 12px rgba(0,0,0,0.3); padding: 12px; max-width: 280px; margin-top: 6px; }' +
  '.panel[aria-hidden="true"] { display: none; }' +
  '.panel a { color: #2a52be; }' +
  '.disclosure { color: #666; margin: 8px 0 0; font-size: 11px; }' +
  '.collapsed-disclosure { display: block; max-width: 260px; color: #fff; opacity: 0.92; font-size: 10px;' +
  ' line-height: 1.3; margin: 4px 0 0; }' +
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

  // Unit A11: which of the two states below applies is keyed off this one
  // listing's own affiliateTracked flag, not a build-time constant - see the
  // comment above AFFILIATE_DISCLOSURE_TEXT_UNTRACKED.
  var tracked = Boolean(cheaperListing && cheaperListing.affiliateTracked);

  // A8/A11: the deeper disclosure paragraph lives inside the collapsible
  // panel, hidden until the user clicks the badge - so on its own it doesn't
  // satisfy the compliance floor of disclosing the affiliate relationship
  // *before* any click. In the tracked state, the "Ad" tag and the
  // present-tense commission line both sit outside the panel, always visible
  // alongside the collapsed button. In the untracked state neither exists:
  // there is no ad to disclose.
  var wrap = document.createElement('div');
  wrap.className = 'badge-wrap';

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'badge-button';
  button.setAttribute('aria-expanded', 'false');
  button.textContent = buildSavingsText(ownPrice, cheaperListing) || 'Found cheaper on eBay';

  if (tracked) {
    var adTag = document.createElement('span');
    adTag.className = 'ad-tag';
    adTag.textContent = 'Ad';
    wrap.appendChild(adTag);
  }

  wrap.appendChild(button);

  if (tracked) {
    var collapsedDisclosure = document.createElement('p');
    collapsedDisclosure.className = 'collapsed-disclosure';
    collapsedDisclosure.textContent = AFFILIATE_DISCLOSURE_TEXT_TRACKED_COLLAPSED;
    wrap.appendChild(collapsedDisclosure);
  }

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
  disclosure.textContent = tracked ? AFFILIATE_DISCLOSURE_TEXT_TRACKED_PANEL : AFFILIATE_DISCLOSURE_TEXT_UNTRACKED;

  panel.appendChild(dismiss);
  panel.appendChild(link);
  panel.appendChild(disclosure);

  button.addEventListener('click', function () {
    var isOpen = panel.getAttribute('aria-hidden') !== 'true';
    panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  shadow.appendChild(wrap);
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
  AFFILIATE_DISCLOSURE_TEXT_UNTRACKED: AFFILIATE_DISCLOSURE_TEXT_UNTRACKED,
  AFFILIATE_DISCLOSURE_TEXT_TRACKED_COLLAPSED: AFFILIATE_DISCLOSURE_TEXT_TRACKED_COLLAPSED,
  AFFILIATE_DISCLOSURE_TEXT_TRACKED_PANEL: AFFILIATE_DISCLOSURE_TEXT_TRACKED_PANEL,
  buildSavingsText: buildSavingsText,
  mountPriceBadge: mountPriceBadge,
};

if (typeof module !== 'undefined') {
  module.exports = SPEPriceBadge;
}
