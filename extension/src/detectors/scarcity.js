var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

var SCARCITY_PATTERNS = [
  /\bonly\s+\d+\s+left\b/i,
  /\bjust\s+\d+\s+left\b/i,
  /\b\d+\s+left\s+in\s+stock\b/i,
  /\blow\s+stock\b/i,
  /\blimited\s+stock\b/i,
  /\bselling\s+fast\b/i,
  /\balmost\s+gone\b/i,
  /\bhurry,?\s+only\s+a\s+few\s+left\b/i,
];

function detectScarcityMessaging(root) {
  var bodyText = SPEUtils.speTextOf(root);
  var evidence = [];

  SCARCITY_PATTERNS.forEach(function (pattern) {
    var match = bodyText.match(pattern);
    if (match) {
      evidence.push('Page text claims limited stock: "' + match[0] + '"');
    }
  });

  return { id: 'scarcity-messaging', label: 'Low-stock / scarcity messaging', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectScarcityMessaging: detectScarcityMessaging };
}
