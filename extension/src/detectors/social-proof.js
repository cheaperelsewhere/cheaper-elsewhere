var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

// Counts in the wild are often comma-grouped and/or "+"-suffixed (e.g.
// "5,000+ sold"), not bare digits.
var COUNT = '\\d{1,3}(?:,\\d{3})*\\+?';

// "X people are viewing this" / "X in your cart" describe a live, present
// state rather than a historical aggregate, so they fire on the bare count
// regardless of wording.
var DEMAND_COUNTER_PATTERNS = [
  new RegExp('\\b' + COUNT + '\\s+(people\\s+)?(are\\s+)?(viewing|looking at)\\s+this\\b', 'i'),
  new RegExp('\\b' + COUNT + '\\s+in\\s+(their|your)\\s+cart\\b', 'i'),
];

// A bare aggregate count ("5,000+ sold", "2 million sold", "12 sold") is a
// popularity stat, not a manipulation pattern - honest listings show these
// too. The manipulation is urgency framing layered on top, so a sold/bought
// count only fires this signal when paired with one: either attached
// directly ("sold today", "selling fast") or sitting near a countdown/
// "ends in" phrase elsewhere on the page.
var SOLD_COUNT_PATTERN = new RegExp('\\b' + COUNT + '\\s+(sold|bought|purchased|people\\s+bought\\s+this)\\b', 'i');
var URGENCY_QUALIFIER_PATTERN = /\b(today|this week|in the last \d+\s*(hours?|minutes?)|right now|selling fast|going fast|almost (sold out|gone))\b/i;
var COUNTDOWN_PHRASE_PATTERN = /\b(ends? in|countdown|hurry|limited time|offer ends|sale ends|deal ends)\b/i;
var URGENCY_PROXIMITY_WINDOW = 150;

function detectDemandCounter(root) {
  var bodyText = SPEUtils.speTextOf(root);
  var evidence = [];

  DEMAND_COUNTER_PATTERNS.forEach(function (pattern) {
    var match = bodyText.match(pattern);
    if (match) {
      evidence.push('Page text shows a real-time demand counter: "' + match[0] + '"');
    }
  });

  var soldMatch = bodyText.match(SOLD_COUNT_PATTERN);
  if (soldMatch) {
    var start = Math.max(0, soldMatch.index - URGENCY_PROXIMITY_WINDOW);
    var end = Math.min(bodyText.length, soldMatch.index + soldMatch[0].length + URGENCY_PROXIMITY_WINDOW);
    var nearby = bodyText.slice(start, end);
    if (URGENCY_QUALIFIER_PATTERN.test(nearby) || COUNTDOWN_PHRASE_PATTERN.test(nearby)) {
      evidence.push('Page text pairs a sales count with urgency framing: "' + soldMatch[0] + '"');
    }
  }

  return { id: 'demand-counter', label: 'Real-time demand / social-proof counter', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectDemandCounter: detectDemandCounter };
}
