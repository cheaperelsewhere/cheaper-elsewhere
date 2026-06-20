// Pre-build gate tests for two NEW candidate signals - NOT detector code.
// These claim functions exist only to test the claim against fixtures before
// anyone writes a real detector. If a claim passes here, building it is a
// separate later task. See docs/new-signal-gate-results.md for the narrative.
//
// "Pass" means pass-against-hand-authored-fixtures (reasoned-zero + tested-
// zero), NOT proven-zero in the wild - same standing caveat as the last gate.

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bodyFor(html) {
  return new JSDOM('<!doctype html><body>' + html + '</body>').window.document;
}

// ===================================================================
// Candidate 1 - pre-ticked consent opt-in (PRECISION / false-fire gate)
// ===================================================================
// Claim: a checkbox pre-checked at load, whose associated label text
// contains marketing/subscription/data-sharing consent language. Reads the
// label via all four real association methods: <label for>, wrapping
// <label>, aria-label, aria-labelledby.

function resolveLabelText(input) {
  var doc = input.ownerDocument;

  // aria-labelledby takes precedence in the real accessible-name algorithm,
  // and can reference multiple space-separated ids.
  var labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    var text = labelledBy
      .split(/\s+/)
      .map(function (refId) {
        var el = doc.getElementById(refId);
        return el ? el.textContent : '';
      })
      .join(' ')
      .trim();
    if (text) return text;
  }

  var ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  var id = input.getAttribute('id');
  if (id && doc.querySelector) {
    var labelFor = doc.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]');
    if (labelFor) return (labelFor.textContent || '').trim();
  }

  var ancestorLabel = input.closest ? input.closest('label') : null;
  if (ancestorLabel) return (ancestorLabel.textContent || '').trim();

  return '';
}

var CONSENT_LANGUAGE_PATTERN = new RegExp(
  '\\b(marketing emails?|special offers?|newsletter|subscribe (me )?to|' +
    'sign (me )?up for (the )?(newsletter|marketing|promotional)|' +
    'share my (information|details|data) with|trusted partners|' +
    'promotional (emails?|offers?|messages?)|third[- ]party (offers?|partners?)|' +
    'opt(ed)?[- ]in to receive)\\b',
  'i'
);

function preTickedConsentClaim(root) {
  var checkboxes = root.querySelectorAll('input[type="checkbox"]');
  var matches = [];
  Array.prototype.forEach.call(checkboxes, function (input) {
    if (!input.checked) return;
    var labelText = resolveLabelText(input);
    if (labelText && CONSENT_LANGUAGE_PATTERN.test(labelText)) {
      matches.push(labelText);
    }
  });
  return { detected: matches.length > 0, matches: matches };
}

// --- Honest fixtures (must NOT fire) ---
const HONEST_CONSENT_FIXTURES = [
  {
    name: 'Terms & Conditions acknowledgement (label-for)',
    html: '<input type="checkbox" id="tc" checked><label for="tc">I have read and agree to the Terms &amp; Conditions</label>',
  },
  {
    name: '"Remember me on this device" (wrapping label)',
    html: '<label><input type="checkbox" checked> Remember me on this device</label>',
  },
  {
    name: '"Keep me signed in" (label-for)',
    html: '<input type="checkbox" id="ks" checked><label for="ks">Keep me signed in</label>',
  },
  {
    name: '"Save this address for next time" (wrapping label)',
    html: '<label><input type="checkbox" checked> Save this address for next time</label>',
  },
  {
    name: 'pre-checked box with NO label association at all',
    html: '<input type="checkbox" checked>',
  },
  {
    name: 'aria-label: "I have read and agree to the Terms and Conditions"',
    html: '<input type="checkbox" checked aria-label="I have read and agree to the Terms and Conditions">',
  },
  {
    name: 'transactional: "Sign me up for SMS delivery alerts for this order" (uses "sign me up" but not for marketing)',
    html: '<input type="checkbox" id="sms" checked><label for="sms">Sign me up for SMS delivery alerts for this order</label>',
  },
  {
    name: 'transactional: "Notify me when this item is back in stock"',
    html: '<input type="checkbox" id="restock" checked><label for="restock">Notify me when this item is back in stock</label>',
  },
  {
    name: 'transactional: "Email me a copy of my receipt"',
    html: '<input type="checkbox" id="receipt" checked><label for="receipt">Email me a copy of my receipt</label>',
  },
];

HONEST_CONSENT_FIXTURES.forEach(({ name, html }) => {
  test('pre-ticked consent gate: ' + name + ' - must NOT fire', () => {
    const result = preTickedConsentClaim(bodyFor(html));
    assert.equal(result.detected, false, 'false fire, matched: ' + JSON.stringify(result.matches));
  });
});

// --- True-positive fixtures (must fire) - each deliberately uses a
// different label-association method, per the task's explicit request to
// report which methods were covered. ---
const TRUE_POSITIVE_CONSENT_FIXTURES = [
  {
    name: '"Yes, send me marketing emails and special offers" via <label for>',
    html: '<input type="checkbox" id="mk" checked><label for="mk">Yes, send me marketing emails and special offers</label>',
  },
  {
    name: '"Subscribe me to the newsletter" via wrapping <label>',
    html: '<label><input type="checkbox" checked> Subscribe me to the newsletter</label>',
  },
  {
    name: '"Share my information with trusted partners" via aria-label',
    html: '<input type="checkbox" checked aria-label="Share my information with trusted partners">',
  },
  {
    name: '"Opt in to receive promotional offers from our partners" via aria-labelledby',
    html:
      '<span id="consent-text">Opt in to receive promotional offers from our partners</span>' +
      '<input type="checkbox" checked aria-labelledby="consent-text">',
  },
];

TRUE_POSITIVE_CONSENT_FIXTURES.forEach(({ name, html }) => {
  test('pre-ticked consent gate: ' + name + ' - must fire', () => {
    const result = preTickedConsentClaim(bodyFor(html));
    assert.equal(result.detected, true, 'failed to fire on a true positive');
  });
});

// ===================================================================
// Candidate 2 - recurring-charge disclosure present (RECALL gate)
// ===================================================================
// Not a false-fire gate - presence of clear recurring-billing language is
// itself the honest, desired case (a neutral reading aid, not an
// accusation). The bar is RECALL: does the claim reliably find the
// disclosure across varied phrasing, while not confusing a plain duration
// (warranty length, delivery time) for a billing period.

var CURRENCY = '[£$€]\\s?\\d+(?:\\.\\d{2})?';
var PERIOD_WORD = '(?:month(?:ly)?|mo|year(?:ly)?|yr|week(?:ly)?|wk|day(?:ly)?)';
var PRICE_PERIOD_PATTERN = new RegExp(CURRENCY + '\\s*(?:\\/|per\\s+|a\\s+|each\\s+)\\s*' + PERIOD_WORD + '\\b', 'i');

var BILLING_VERB_PATTERN = /\b(renews?|auto-renews?|recurring|billed|charged|charges?|subscription)\b/gi;
var PERIOD_WORD_LOOSE_PATTERN = /\b(month(?:ly)?|year(?:ly)?|annually|week(?:ly)?|day(?:ly)?)\b/i;
var BILLING_PROXIMITY_WINDOW = 60;

function recurringChargeClaim(bodyText) {
  if (PRICE_PERIOD_PATTERN.test(bodyText)) return true;

  var verbMatch;
  BILLING_VERB_PATTERN.lastIndex = 0;
  while ((verbMatch = BILLING_VERB_PATTERN.exec(bodyText))) {
    var start = Math.max(0, verbMatch.index - BILLING_PROXIMITY_WINDOW);
    var end = Math.min(bodyText.length, verbMatch.index + verbMatch[0].length + BILLING_PROXIMITY_WINDOW);
    if (PERIOD_WORD_LOOSE_PATTERN.test(bodyText.slice(start, end))) return true;
  }
  return false;
}

const RECALL_FIXTURES = [
  { name: '"£9.99/month"', text: 'Just £9.99/month.' },
  { name: '"£9.99 per month"', text: 'Just £9.99 per month.' },
  { name: '"then £12 a month after your free trial"', text: 'Free for 30 days, then £12 a month after your free trial.' },
  { name: '"billed annually at £99/year"', text: 'Billed annually at £99/year.' },
  { name: '"renews automatically at £49.99/yr"', text: 'Renews automatically at £49.99/yr.' },
  { name: '"$14.99/mo after trial"', text: '$14.99/mo after trial.' },
  { name: '"auto-renews every month"', text: 'This subscription auto-renews every month.' },
  { name: '"recurring payment of £5 weekly"', text: 'This is a recurring payment of £5 weekly.' },
  {
    name: 'number and period separated by other words ("charged £20 each and every month")',
    text: "You'll be charged £20 each and every month.",
  },
];

RECALL_FIXTURES.forEach(({ name, text }) => {
  test('recurring-charge recall gate: ' + name + ' - must be found', () => {
    assert.equal(recurringChargeClaim(text), true, 'failed to find disclosure in: "' + text + '"');
  });
});

const NEGATIVE_FIXTURES = [
  { name: '"£40 one-time payment"', text: '£40 one-time payment.' },
  { name: '"£40" with no period word anywhere', text: 'Just £40.' },
  { name: '"delivery in 2-3 months" (duration, not a billing period)', text: 'Allow delivery in 2-3 months.' },
  { name: '"12 month warranty" (duration, not a recurring charge)', text: 'Comes with a 12 month warranty.' },
];

NEGATIVE_FIXTURES.forEach(({ name, text }) => {
  test('recurring-charge recall gate: ' + name + ' - must NOT fire', () => {
    assert.equal(recurringChargeClaim(text), false, 'false fire on: "' + text + '"');
  });
});
