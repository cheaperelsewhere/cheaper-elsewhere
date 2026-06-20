var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

// Neutral reading aid, not an accusation - surfaces "this page mentions a
// recurring charge" so a vulnerable user doesn't miss it. Ported verbatim
// from the pre-build gate (extension/tests/new-signal-gate.test.js,
// docs/new-signal-gate-results.md): two independent ways to find a
// disclosure, either is sufficient.
//
// Currency detection is symbol-led only (£/$/€) - word-form or ISO-code
// currency ("9.99 GBP per month", "9.99 EUR/mo") is a DOCUMENTED known
// limitation, not an oversight. Scope is US + UK; € is kept because it's
// cheap and common enough to be worth it, but ISO-code matching was
// deliberately not added - see docs/new-signal-gate-results.md.
var CURRENCY = '[£$€]\\s?\\d+(?:\\.\\d{2})?';
var PERIOD_WORD = '(?:month(?:ly)?|mo|year(?:ly)?|yr|week(?:ly)?|wk|day(?:ly)?)';
var PRICE_PERIOD_PATTERN = new RegExp(CURRENCY + '\\s*(?:\\/|per\\s+|a\\s+|each\\s+)\\s*' + PERIOD_WORD + '\\b', 'i');

// Catches phrasings with no currency symbol attached to the period at all
// ("auto-renews every month"), or where the amount and period are
// separated by other words ("charged £20 each and every month") - a
// billing/renewal verb within a bounded window of a period word. This is
// what keeps a plain duration ("12 month warranty", "delivery in 2-3
// months") from false-firing: neither a currency symbol nor a billing verb
// is present in a plain duration mention.
var BILLING_VERB_PATTERN_SOURCE = '\\b(renews?|auto-renews?|recurring|billed|charged|charges?|subscription)\\b';
var PERIOD_WORD_LOOSE_PATTERN = /\b(month(?:ly)?|year(?:ly)?|annually|week(?:ly)?|day(?:ly)?)\b/i;
var BILLING_PROXIMITY_WINDOW = 60;

function detectRecurringCharge(root) {
  var bodyText = SPEUtils.speTextOf(root);
  var evidence = [];

  var priceMatch = bodyText.match(PRICE_PERIOD_PATTERN);
  if (priceMatch) {
    evidence.push('Page text mentions a recurring charge: "' + priceMatch[0] + '"');
  } else {
    var billingVerbPattern = new RegExp(BILLING_VERB_PATTERN_SOURCE, 'gi');
    var verbMatch;
    while ((verbMatch = billingVerbPattern.exec(bodyText))) {
      var start = Math.max(0, verbMatch.index - BILLING_PROXIMITY_WINDOW);
      var end = Math.min(bodyText.length, verbMatch.index + verbMatch[0].length + BILLING_PROXIMITY_WINDOW);
      var nearby = bodyText.slice(start, end);
      if (PERIOD_WORD_LOOSE_PATTERN.test(nearby)) {
        evidence.push('Page text mentions a recurring charge: "' + nearby.trim().slice(0, 80) + '"');
        break;
      }
    }
  }

  return { id: 'recurring-charge', label: 'Recurring-charge disclosure present', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectRecurringCharge: detectRecurringCharge };
}
