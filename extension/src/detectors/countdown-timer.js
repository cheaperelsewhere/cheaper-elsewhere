var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

var COUNTDOWN_NAME_HINTS = ['countdown', 'timer'];
var COUNTDOWN_CLOCK_PATTERN = /\b\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?\b/;
var COUNTDOWN_URGENCY_PATTERN = /\b(countdown|ends in|offer ends|sale ends|deal ends|hurry|time left|time remaining)\b/i;

function detectCountdownTimer(root) {
  var evidence = [];

  SPEUtils.speElementsMatchingNameHint(root, COUNTDOWN_NAME_HINTS).forEach(function (el) {
    if (!SPEUtils.speIsVisible(el)) return;
    var text = (el.textContent || '').trim().slice(0, 80);
    evidence.push('Element with a countdown/timer class or id' + (text ? ': "' + text + '"' : '.'));
  });

  var bodyText = SPEUtils.speTextOf(root);
  var clockMatch = bodyText.match(COUNTDOWN_CLOCK_PATTERN);
  if (clockMatch && COUNTDOWN_URGENCY_PATTERN.test(bodyText)) {
    evidence.push('Page text shows a clock-style countdown ("' + clockMatch[0] + '") next to urgency wording.');
  }

  return { id: 'countdown-timer', label: 'Countdown timer', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectCountdownTimer: detectCountdownTimer };
}
