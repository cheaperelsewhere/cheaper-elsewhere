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

const {
  HONEST_CONSENT_FIXTURES,
  TRUE_POSITIVE_CONSENT_FIXTURES,
  RECALL_FIXTURES,
  NEGATIVE_FIXTURES,
} = require('./fixtures/signal-gate-fixtures.js');

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
HONEST_CONSENT_FIXTURES.forEach(({ name, html }) => {
  test('pre-ticked consent gate: ' + name + ' - must NOT fire', () => {
    const result = preTickedConsentClaim(bodyFor(html));
    assert.equal(result.detected, false, 'false fire, matched: ' + JSON.stringify(result.matches));
  });
});

// --- True-positive fixtures (must fire) - each deliberately uses a
// different label-association method, per the task's explicit request to
// report which methods were covered. ---
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

RECALL_FIXTURES.forEach(({ name, text }) => {
  test('recurring-charge recall gate: ' + name + ' - must be found', () => {
    assert.equal(recurringChargeClaim(text), true, 'failed to find disclosure in: "' + text + '"');
  });
});

NEGATIVE_FIXTURES.forEach(({ name, text }) => {
  test('recurring-charge recall gate: ' + name + ' - must NOT fire', () => {
    assert.equal(recurringChargeClaim(text), false, 'false fire on: "' + text + '"');
  });
});
