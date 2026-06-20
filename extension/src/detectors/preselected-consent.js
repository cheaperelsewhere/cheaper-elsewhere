var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

// Ported verbatim from the pre-build gate (extension/tests/new-signal-gate.test.js,
// docs/new-signal-gate-results.md) - scoped to require the marketing/subscription/
// data-sharing object, not bare trigger words (e.g. "sign up for" only matches when
// followed by newsletter/marketing/promotional, so an honest "sign me up for SMS
// delivery alerts for this order" does not false-fire). Do not loosen.
var CONSENT_LANGUAGE_PATTERN = new RegExp(
  '\\b(marketing emails?|special offers?|newsletter|subscribe (me )?to|' +
    'sign (me )?up for (the )?(newsletter|marketing|promotional)|' +
    'share my (information|details|data) with|trusted partners|' +
    'promotional (emails?|offers?|messages?)|third[- ]party (offers?|partners?)|' +
    'opt(ed)?[- ]in to receive)\\b',
  'i'
);

function detectPreselectedConsent(root) {
  var scope = SPEUtils.speRootElement(root);
  var evidence = [];
  if (!scope || !scope.querySelectorAll) {
    return { id: 'preselected-consent', label: 'Pre-ticked marketing/consent opt-in', detected: false, evidence: evidence };
  }

  var checkboxes = scope.querySelectorAll('input[type="checkbox"]');
  Array.prototype.forEach.call(checkboxes, function (input) {
    if (!input.checked || !SPEUtils.speIsVisible(input)) return;

    var labelText = SPEUtils.speLabelTextFor(input).trim();
    if (labelText && CONSENT_LANGUAGE_PATTERN.test(labelText)) {
      evidence.push('A pre-checked box opts in to marketing or data-sharing: "' + labelText.slice(0, 80) + '"');
    }
  });

  return { id: 'preselected-consent', label: 'Pre-ticked marketing/consent opt-in', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectPreselectedConsent: detectPreselectedConsent };
}
