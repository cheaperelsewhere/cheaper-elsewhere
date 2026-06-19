var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

var ADDON_KEYWORDS_PATTERN = /\b(protection plan|insurance|extended warranty|warranty|membership|subscribe|subscription|donation|priority support|gift wrap)\b/i;

function detectPreselectedAddons(root) {
  var scope = SPEUtils.speRootElement(root);
  var evidence = [];
  if (!scope || !scope.querySelectorAll) {
    return { id: 'preselected-addons', label: 'Pre-checked add-ons near the buy button', detected: false, evidence: evidence };
  }

  var checkboxes = scope.querySelectorAll('input[type="checkbox"]');
  Array.prototype.forEach.call(checkboxes, function (input) {
    if (!input.checked || !SPEUtils.speIsVisible(input)) return;

    var labelText = SPEUtils.speLabelTextFor(input).trim();
    if (ADDON_KEYWORDS_PATTERN.test(labelText)) {
      evidence.push('A pre-checked checkbox adds an extra item: "' + labelText.slice(0, 80) + '"');
    }
  });

  return { id: 'preselected-addons', label: 'Pre-checked add-ons near the buy button', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectPreselectedAddons: detectPreselectedAddons };
}
