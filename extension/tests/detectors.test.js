const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { detectCountdownTimer } = require('../src/detectors/countdown-timer.js');
const { detectScarcityMessaging } = require('../src/detectors/scarcity.js');
const { detectDemandCounter } = require('../src/detectors/social-proof.js');
const { detectReferencePriceDisplay } = require('../src/detectors/discount-display.js');
const { detectConfirmshamingPopup } = require('../src/detectors/confirmshaming.js');
const { detectPreselectedAddons } = require('../src/detectors/preselected-addons.js');
const { detectPreselectedConsent } = require('../src/detectors/preselected-consent.js');
const { detectRecurringCharge } = require('../src/detectors/recurring-charge.js');
// index.js (the aggregator) is a content-script-only file - it relies on the
// detectors as shared globals rather than require(). Load it through a
// tiny vm sandbox providing those globals, so its try/catch crash isolation
// can be exercised here too. `overrides` lets a test swap in a throwing stub
// for one detector to prove the others still complete.
const indexSource = require('node:fs').readFileSync(
  require('node:path').join(__dirname, '../src/detectors/index.js'),
  'utf8'
);
function buildIndexSandbox(overrides) {
  const vm = require('node:vm');
  const sandbox = Object.assign(
    {
      detectCountdownTimer,
      detectScarcityMessaging,
      detectDemandCounter,
      detectReferencePriceDisplay,
      detectConfirmshamingPopup,
      detectPreselectedAddons,
      detectPreselectedConsent,
      detectRecurringCharge,
      console,
    },
    overrides
  );
  vm.createContext(sandbox);
  vm.runInContext(indexSource, sandbox);
  return sandbox;
}
function buildRunDetectors(overrides) {
  return buildIndexSandbox(overrides).runDetectors;
}
const runDetectors = buildRunDetectors();
const mergeDetectorResults = buildIndexSandbox().mergeDetectorResults;

function bodyFor(html) {
  return new JSDOM('<!doctype html><body>' + html + '</body>').window.document;
}

test('countdown timer: detects a clock pattern paired with urgency wording', () => {
  const doc = bodyFor('<div class="deal-banner">Offer ends in 00:23:59 - hurry!</div>');
  const result = detectCountdownTimer(doc);
  assert.equal(result.detected, true);
});

test('countdown timer: detects an element carrying a countdown/timer class', () => {
  const doc = bodyFor('<div class="js-countdown-timer">23:59:01</div>');
  const result = detectCountdownTimer(doc);
  assert.equal(result.detected, true);
});

test('countdown timer: a plain product page with no clock or countdown markup is clean', () => {
  const doc = bodyFor('<h1>Wireless Mouse</h1><p>In stock. Ships in 2 days.</p>');
  const result = detectCountdownTimer(doc);
  assert.equal(result.detected, false);
});

test('scarcity messaging: detects "only N left" phrasing', () => {
  const doc = bodyFor('<p>Only 3 left in stock - order soon</p>');
  const result = detectScarcityMessaging(doc);
  assert.equal(result.detected, true);
});

test('scarcity messaging: a normal stock notice is clean', () => {
  const doc = bodyFor('<p>In stock and ready to ship.</p>');
  const result = detectScarcityMessaging(doc);
  assert.equal(result.detected, false);
});

test('demand counter: detects a "people viewing" style claim', () => {
  const doc = bodyFor('<p>47 people are viewing this right now</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

test('demand counter: detects a "sold today" style claim', () => {
  const doc = bodyFor('<span>128 sold today</span>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

test('demand counter: a page with no demand claims is clean', () => {
  const doc = bodyFor('<p>Free returns within 30 days.</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, false);
});

test('demand counter: parses comma-grouped, "+"-suffixed counts ("1,200 sold today")', () => {
  const doc = bodyFor('<span>1,200 sold today</span>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

test('demand counter: parses comma-grouped, "+"-suffixed counts in the viewing pattern', () => {
  const doc = bodyFor('<p>2,500+ people are viewing this</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

// Settled trigger logic: a bare aggregate count is an honest popularity
// stat, not a manipulation pattern, on its own - the manipulation is urgency
// framing layered on top. False-firing on honest claims is the costlier
// failure mode for a trust-critical tool, so these stay silent.
test('demand counter: an honest large lifetime count ("2 million sold") with no urgency framing does not fire', () => {
  const doc = bodyFor('<p>Over 2 million sold worldwide since 2015.</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, false);
});

test('demand counter: an honest small count ("12 sold") with no urgency framing does not fire', () => {
  const doc = bodyFor('<p>12 sold</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, false);
});

test('demand counter: a bare "X+ sold" with no urgency framing does not fire', () => {
  const doc = bodyFor('<span>5,000+ sold</span>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, false);
});

test('demand counter: fires when a count is paired with "selling fast"', () => {
  const doc = bodyFor('<p>47 sold - selling fast!</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

test('demand counter: fires on "X people bought this" when paired with a temporal qualifier', () => {
  const doc = bodyFor('<p>143 people bought this in the last 2 hours</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

test('demand counter: "X people bought this" with no urgency framing does not fire', () => {
  const doc = bodyFor('<p>143 people bought this.</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, false);
});

test('demand counter: fires when a bare count sits near a countdown/"ends in" phrase elsewhere on the page', () => {
  const doc = bodyFor('<div class="deal-banner">Ends in 00:10:00</div><p>5,000+ sold</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, true);
});

test('demand counter: a bare count far outside the urgency-proximity window does not fire', () => {
  const filler = 'x'.repeat(400);
  const doc = bodyFor('<div class="deal-banner">Ends in 00:10:00</div>' + filler + '<p>5,000+ sold</p>');
  const result = detectDemandCounter(doc);
  assert.equal(result.detected, false);
});

test('reference price display: detects a <del> element with a crossed-out price', () => {
  const doc = bodyFor('<del>$129.99</del> <strong>$89.99</strong>');
  const result = detectReferencePriceDisplay(doc);
  assert.equal(result.detected, true);
});

test('reference price display: detects an inline line-through style on a price', () => {
  const doc = bodyFor('<span style="text-decoration: line-through">£49.99</span> <span>£29.99</span>');
  const result = detectReferencePriceDisplay(doc);
  assert.equal(result.detected, true);
});

// Regression: a real AliExpress listing crossed out its reference price via
// a CSS-module class (computed text-decoration), with no semantic tag and
// no inline style attribute - the prior checks couldn't see it at all.
// jsdom doesn't apply class-based stylesheet rules to computed style (verified
// directly - it returns "none" even when a matching class rule exists), so
// this stubs getComputedStyle to simulate exactly what a real browser
// reports for that shape: the price leaf itself is plain, its wrapping
// <span> carries the computed line-through. A real-Chrome version of this
// same fixture lives in tests/fixtures/edge-cases.html.
test('reference price display: detects a CSS-class-driven strikethrough with no tag or inline style (computed style)', () => {
  const doc = bodyFor(
    '<span class="price-original-x7f3"><bdi id="orig-price">$129.99</bdi></span>' +
      '<span id="sale-price">$89.99</span>'
  );
  const origPrice = doc.getElementById('orig-price');
  const win = doc.defaultView;
  win.getComputedStyle = (el) => ({
    display: 'block',
    visibility: 'visible',
    textDecorationLine: el === origPrice.parentElement ? 'line-through' : 'none',
  });

  const result = detectReferencePriceDisplay(doc);
  assert.equal(result.detected, true);
  assert.equal(result.evidence.length, 1);
  assert.match(result.evidence[0], /computed CSS/);
  assert.match(result.evidence[0], /parent/);
});

test('reference price display: a <del> tag is not double-counted by the new computed-style scan', () => {
  // jsdom doesn't apply the real browser's default UA stylesheet
  // (text-decoration: line-through for <del>) to computed style, so without
  // this stub the new computed-style path would never fire here at all and
  // the dedup logic wouldn't actually be exercised. Simulate what a real
  // browser reports so this test can catch a regression in `flaggedElements`.
  const doc = bodyFor('<del id="was">$129.99</del> <strong>$89.99</strong>');
  const wasEl = doc.getElementById('was');
  const win = doc.defaultView;
  win.getComputedStyle = (el) => ({
    display: 'block',
    visibility: 'visible',
    textDecorationLine: el === wasEl ? 'line-through' : 'none',
  });

  const result = detectReferencePriceDisplay(doc);
  assert.equal(result.detected, true);
  assert.equal(result.evidence.length, 1);
});

test('reference price display: a plain single price with no strikethrough is clean', () => {
  const doc = bodyFor('<span class="price">$24.99</span>');
  const result = detectReferencePriceDisplay(doc);
  assert.equal(result.detected, false);
});

test('confirmshaming popup: detects guilt-tripping decline wording on a visible modal', () => {
  const doc = bodyFor(
    '<div class="exit-popup">' +
      '<button>Yes, sign me up!</button>' +
      '<button>No, I don\'t want to save money</button>' +
      '</div>'
  );
  const result = detectConfirmshamingPopup(doc);
  assert.equal(result.detected, true);
});

test('confirmshaming popup: a normal modal with neutral decline wording is clean', () => {
  const doc = bodyFor('<div role="dialog"><button>Subscribe</button><button>No thanks</button></div>');
  const result = detectConfirmshamingPopup(doc);
  assert.equal(result.detected, false);
});

test('confirmshaming popup: a hidden popup is not flagged', () => {
  const doc = bodyFor(
    '<div class="modal" style="display:none">' +
      '<button>No, I don\'t want to save money</button>' +
      '</div>'
  );
  const result = detectConfirmshamingPopup(doc);
  assert.equal(result.detected, false);
});

test('pre-checked add-ons: detects a checked checkbox labelled as an add-on', () => {
  const doc = bodyFor(
    '<input type="checkbox" id="ins" checked>' +
      '<label for="ins">Add Extended Warranty for $4.99</label>'
  );
  const result = detectPreselectedAddons(doc);
  assert.equal(result.detected, true);
});

test('pre-checked add-ons: an unchecked add-on checkbox is not flagged', () => {
  const doc = bodyFor(
    '<input type="checkbox" id="ins">' + '<label for="ins">Add Extended Warranty for $4.99</label>'
  );
  const result = detectPreselectedAddons(doc);
  assert.equal(result.detected, false);
});

test('pre-checked add-ons: a checked checkbox unrelated to add-ons is not flagged', () => {
  const doc = bodyFor('<input type="checkbox" id="gift" checked>' + '<label for="gift">This is a gift</label>');
  const result = detectPreselectedAddons(doc);
  assert.equal(result.detected, false);
});

// Regression: a real Shopify product page (cribofart.myshopify.com, Impulse
// theme) crashed detectCountdownTimer with "(el.id || '').toLowerCase is not
// a function". Root cause: <select name="id"> inside a <form> triggers DOM
// clobbering, so form.id resolves to the <select> element instead of a
// string. jsdom doesn't implement that specific named-getter quirk, so this
// reproduces the exact real-world shape and relies on getAttribute() (which
// is unaffected by clobbering) rather than the .id property to prove the fix.
test('countdown timer: a form whose .id is DOM-clobbered by a name="id" control does not crash', () => {
  const doc = bodyFor(
    '<form>' +
      '<select name="id"><option>S</option><option>M</option></select>' +
      '<div class="countdown-banner">Offer ends in 00:10:00 - hurry!</div>' +
      '</form>'
  );
  assert.doesNotThrow(() => detectCountdownTimer(doc));
  assert.equal(detectCountdownTimer(doc).detected, true);
});

test('countdown timer: an SVG element with a class hint (SVGAnimatedString className) does not crash', () => {
  const doc = bodyFor(
    '<svg id="timer-icon" class="countdown-icon"><circle cx="12" cy="12" r="10"></circle></svg>'
  );
  assert.doesNotThrow(() => detectCountdownTimer(doc));
  const result = detectCountdownTimer(doc);
  assert.equal(result.detected, true);
  assert.match(result.evidence[0], /countdown\/timer class or id/);
});

test('countdown timer: id/className properties directly overridden to non-strings do not crash (simulated clobbering)', () => {
  const doc = bodyFor('<div class="countdown-banner" id="real-id">Offer ends in 00:10:00 - hurry!</div>');
  const el = doc.querySelector('div');
  Object.defineProperty(el, 'id', { value: {}, configurable: true });
  Object.defineProperty(el, 'className', { value: {}, configurable: true });

  assert.doesNotThrow(() => detectCountdownTimer(doc));
  assert.equal(detectCountdownTimer(doc).detected, true);
});

test('runDetectors: one detector throwing does not stop the others from running', () => {
  const throwingRunDetectors = buildRunDetectors({
    detectCountdownTimer: () => {
      throw new Error('simulated crash');
    },
  });
  const doc = bodyFor('<p>Only 2 left in stock</p>');

  const results = throwingRunDetectors(doc);

  assert.equal(results.length, 8);
  const crashed = results.find((r) => r.id === 'detectCountdownTimer');
  assert.equal(crashed.detected, false);
  assert.ok(crashed.error.includes('simulated crash'));
  const scarcity = results.find((r) => r.id === 'scarcity-messaging');
  assert.equal(scarcity.detected, true);
});

function makeResult(id, detected, evidence) {
  return { id, label: id, detected, evidence: evidence || [] };
}

test('mergeDetectorResults: a signal detected in pass one but not pass two stays detected (union, not replace)', () => {
  const first = [makeResult('confirmshaming-popup', true, ['popup was open'])];
  const second = [makeResult('confirmshaming-popup', false, [])];

  const merged = mergeDetectorResults(first, second);

  assert.equal(merged[0].detected, true);
  assert.deepEqual(merged[0].evidence, ['popup was open']);
});

test('mergeDetectorResults: a signal that only appears in pass two (settled after hydration) is detected', () => {
  const first = [makeResult('demand-counter', false, [])];
  const second = [makeResult('demand-counter', true, ['47 sold today'])];

  const merged = mergeDetectorResults(first, second);

  assert.equal(merged[0].detected, true);
  assert.deepEqual(merged[0].evidence, ['47 sold today']);
});

test('mergeDetectorResults: detected in both passes keeps the later (richer) evidence', () => {
  const first = [makeResult('scarcity-messaging', true, ['only 5 left'])];
  const second = [makeResult('scarcity-messaging', true, ['only 5 left', 'low stock'])];

  const merged = mergeDetectorResults(first, second);

  assert.equal(merged[0].detected, true);
  assert.deepEqual(merged[0].evidence, ['only 5 left', 'low stock']);
});

test('mergeDetectorResults: detected in neither pass stays undetected', () => {
  const first = [makeResult('preselected-addons', false, [])];
  const second = [makeResult('preselected-addons', false, [])];

  const merged = mergeDetectorResults(first, second);

  assert.equal(merged[0].detected, false);
  // .evidence is fabricated inside the vm sandbox here (the "[]" literal on
  // the not-detected branch), so it's an Array from a different realm than
  // this file's - deepEqual against a same-realm [] fails on reference
  // identity even though both are structurally empty. Check length instead.
  assert.equal(merged[0].evidence.length, 0);
});

test('mergeDetectorResults: a detector that crashed in pass one but succeeded in pass two recovers', () => {
  const first = [{ id: 'detectCountdownTimer', label: 'detectCountdownTimer', detected: false, evidence: [], error: 'boom' }];
  const second = [makeResult('countdown-timer', true, ['00:10:00'])];

  const merged = mergeDetectorResults(first, second);

  assert.equal(merged[0].detected, true);
  assert.deepEqual(merged[0].evidence, ['00:10:00']);
});
