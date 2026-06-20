// Unit 3 re-gate: runs the BUILT detectors (detectPreselectedConsent,
// detectRecurringCharge) against the exact same fixtures the claim
// functions were gated against (shared via fixtures/signal-gate-fixtures.js
// - no copy-paste, so no drift between "what was gated" and "what's
// re-gated"). A claim passing in new-signal-gate.test.js is NOT the same
// as the built detector behaving the same way - this is what closes that
// gap. If a built detector diverges from its claim-function result here,
// that divergence is the finding to report, not something to patch around.

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { detectPreselectedConsent } = require('../src/detectors/preselected-consent.js');
const { detectRecurringCharge } = require('../src/detectors/recurring-charge.js');

const {
  HONEST_CONSENT_FIXTURES,
  TRUE_POSITIVE_CONSENT_FIXTURES,
  RECALL_FIXTURES,
  NEGATIVE_FIXTURES,
} = require('./fixtures/signal-gate-fixtures.js');

function bodyFor(html) {
  return new JSDOM('<!doctype html><body>' + html + '</body>').window.document;
}

HONEST_CONSENT_FIXTURES.forEach(({ name, html }) => {
  test('re-gate detectPreselectedConsent: ' + name + ' - must NOT fire', () => {
    const result = detectPreselectedConsent(bodyFor(html));
    assert.equal(result.detected, false, 'false fire, evidence: ' + JSON.stringify(result.evidence));
  });
});

TRUE_POSITIVE_CONSENT_FIXTURES.forEach(({ name, html }) => {
  test('re-gate detectPreselectedConsent: ' + name + ' - must fire', () => {
    const result = detectPreselectedConsent(bodyFor(html));
    assert.equal(result.detected, true, 'failed to fire on a true positive');
  });
});

RECALL_FIXTURES.forEach(({ name, text }) => {
  test('re-gate detectRecurringCharge: ' + name + ' - must be found', () => {
    const result = detectRecurringCharge(bodyFor('<p>' + text + '</p>'));
    assert.equal(result.detected, true, 'failed to find disclosure in: "' + text + '"');
  });
});

NEGATIVE_FIXTURES.forEach(({ name, text }) => {
  test('re-gate detectRecurringCharge: ' + name + ' - must NOT fire', () => {
    const result = detectRecurringCharge(bodyFor('<p>' + text + '</p>'));
    assert.equal(result.detected, false, 'false fire on: "' + text + '"');
  });
});
