var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

var MODAL_NAME_HINTS = ['modal', 'popup', 'overlay', 'lightbox'];
var CONFIRMSHAMING_PATTERNS = [
  /no,?\s*i\s*(don'?t|do not)\s*want/i,
  /no,?\s*i\s*(prefer|like)\s*(to\s*)?pay(ing)?\s*full\s*price/i,
  /i\s*don'?t\s*want\s*to\s*save/i,
  /no\s*thanks?,?\s*i\s*(hate|don'?t like)/i,
  /i'?ll\s*pass\s*on\s*(this\s*)?(deal|discount|savings)/i,
];

function detectConfirmshamingPopup(root) {
  var scope = SPEUtils.speRootElement(root);
  var evidence = [];
  if (!scope || !scope.querySelectorAll) {
    return { id: 'confirmshaming-popup', label: 'Exit-intent / confirmshaming popup', detected: false, evidence: evidence };
  }

  var candidates = SPEUtils.speElementsMatchingNameHint(root, MODAL_NAME_HINTS);
  Array.prototype.forEach.call(scope.querySelectorAll('[role="dialog"]'), function (el) {
    if (candidates.indexOf(el) === -1) candidates.push(el);
  });

  candidates.forEach(function (modal) {
    if (!SPEUtils.speIsVisible(modal) || !modal.querySelectorAll) return;

    var buttons = modal.querySelectorAll('button, a, [role="button"]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var text = (btn.textContent || '').trim();
      for (var i = 0; i < CONFIRMSHAMING_PATTERNS.length; i++) {
        if (CONFIRMSHAMING_PATTERNS[i].test(text)) {
          evidence.push('Popup dismiss option uses guilt-tripping wording: "' + text + '"');
          break;
        }
      }
    });
  });

  return { id: 'confirmshaming-popup', label: 'Exit-intent / confirmshaming popup', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectConfirmshamingPopup: detectConfirmshamingPopup };
}
