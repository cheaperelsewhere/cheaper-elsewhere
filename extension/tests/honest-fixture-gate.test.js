// Conditional-keep gate: detectDemandCounter and detectConfirmshamingPopup
// only ship in v1 if they pass these adversarial honest-fixture tests.
// Fixtures are hand-authored, no network. See docs/conditional-signal-gate-results.md
// for the narrative results and the one documented discrepancy with the task brief.

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { detectDemandCounter } = require('../src/detectors/social-proof.js');
const { detectConfirmshamingPopup } = require('../src/detectors/confirmshaming.js');

function bodyFor(html) {
  return new JSDOM('<!doctype html><body>' + html + '</body>').window.document;
}

// detectConfirmshamingPopup only scans containers matching a modal/popup/
// overlay/lightbox name hint or [role="dialog"] - fixtures must use one of
// these wrappers, otherwise a "doesn't fire" result would be meaningless
// (we'd never have looked at the buttons at all).
function modalDoc(buttonsHtml, extraBodyHtml) {
  return bodyFor('<div class="modal" role="dialog">' + (extraBodyHtml || '') + buttonsHtml + '</div>');
}

// ===================================================================
// Test A - demand-counter proximity-rule torture test
// ===================================================================
// Claim under test: detectDemandCounter fires on a sold/bought/purchased
// count only when paired with urgency framing (attached qualifier, or
// within ~150 chars of a countdown/"ends in" phrase) - never on a bare
// count. Risk: an HONEST count sitting near an UNRELATED countdown/urgency
// phrase trips the proximity rule anyway.

const HONEST_DEMAND_FIXTURES = [
  {
    name: 'sold count near an unrelated shipping-cutoff offer ("ends in")',
    html: '<p>4,000+ sold.</p><p>Free next-day shipping offer ends in 2 hours - order soon to qualify.</p>',
  },
  {
    name: 'sold count near a delivery ETA that happens to say "today"',
    html: '<p>12,000+ sold worldwide.</p><p>Your order ships today if placed in the next 3 hours.</p>',
  },
  {
    name: 'best-seller badge near an unrelated site-wide seasonal sale countdown',
    html: '<p>Best Seller - 50,000+ sold.</p><p>Black Friday site-wide sale ends in 3 days.</p>',
  },
  {
    name: 'sold count near an unrelated newsletter-signup bonus deadline',
    html: '<p>Trending now: 1,200+ sold this month.</p><p>Newsletter signup bonus ends in 24 hours.</p>',
  },
  {
    name: 'sold count near a review-freshness "today" stamp (unrelated to sales urgency)',
    html: '<p>2 million sold since 2015.</p><p>Reviewed today: 4.8 out of 5 stars based on recent feedback.</p>',
  },
  {
    name: 'historical lifetime count near a genuinely honest store-closure urgency message',
    html:
      '<p>10,000+ sold over the years.</p>' +
      '<p>Store closing - hurry to claim your loyalty discount before we shut for renovations.</p>',
  },
];

HONEST_DEMAND_FIXTURES.forEach(({ name, html }) => {
  test('demand-counter honest-fixture gate: ' + name + ' - must NOT fire', () => {
    const result = detectDemandCounter(bodyFor(html));
    assert.equal(result.detected, false, 'false fire, evidence: ' + JSON.stringify(result.evidence));
  });
});

const TRUE_POSITIVE_DEMAND_FIXTURES = [
  {
    name: '"12 sold in the last 24 hours" (directly attached temporal qualifier)',
    html: '<p>12 sold in the last 24 hours.</p>',
  },
  {
    name: 'count explicitly tied to a scarcity countdown ("hurry... sale ends in")',
    html: '<p>Only 12 sold remain - hurry, sale ends in 2 hours!</p>',
  },
  {
    name: '"selling fast" directly attached to a count',
    html: '<p>47 sold - selling fast!</p>',
  },
];

TRUE_POSITIVE_DEMAND_FIXTURES.forEach(({ name, html }) => {
  test('demand-counter true-positive gate: ' + name + ' - must still fire', () => {
    const result = detectDemandCounter(bodyFor(html));
    assert.equal(result.detected, true, 'failed to fire on a true positive');
  });
});

// ===================================================================
// Test B - confirmshaming honest-modal false-fire test
// ===================================================================
// Claim under test: detectConfirmshamingPopup fires on guilt-trip wording on
// a decline control inside a modal/dialog, with no honest version. Risk:
// two of the five CONFIRMSHAMING_PATTERNS are broader than "refusing a
// discount" - they match "no, I don't want X" and "no thanks, I [hate /
// don't like] X" for ANY X, not just money/deals. Honest declines phrased
// that way for unrelated reasons (notifications, location, surveys) would
// false-fire.

const HONEST_CONFIRMSHAMING_FIXTURES = [
  {
    name: 'plain cookie consent (Accept / Reject)',
    buttons: '<button>Accept</button><button>Reject</button>',
  },
  {
    name: 'newsletter modal with neutral decline ("No thanks")',
    buttons: '<button>Subscribe</button><button>No thanks</button>',
  },
  {
    name: 'standard confirm/cancel dialog',
    buttons: '<button>OK</button><button>Cancel</button>',
  },
  {
    name: 'charity donation modal: emotional body copy is legitimate, decline button is neutral ("Not now")',
    buttons: '<button>Donate now</button><button>Not now</button>',
    extra: '<p>Your gift changes lives.</p>',
  },
  {
    name: 'push-notification opt-in: honest decline phrased "No, I don\'t want notifications"',
    buttons: '<button>Yes, notify me</button><button>No, I don\'t want notifications</button>',
  },
  {
    name: 'location-permission prompt: honest decline phrased "No, I do not want to share my location"',
    buttons: '<button>Share location</button><button>No, I do not want to share my location</button>',
  },
  {
    name: 'feedback survey modal: honest decline phrased "No thanks, I don\'t like surveys"',
    buttons: '<button>Take survey</button><button>No thanks, I don\'t like surveys</button>',
  },
  {
    name: 'self-aware/cheeky honest copy: "No thanks, I hate pop-ups"',
    buttons: '<button>Sign up</button><button>No thanks, I hate pop-ups</button>',
  },
];

HONEST_CONFIRMSHAMING_FIXTURES.forEach(({ name, buttons, extra }) => {
  test('confirmshaming honest-fixture gate: ' + name + ' - must NOT fire', () => {
    const result = detectConfirmshamingPopup(modalDoc(buttons, extra));
    assert.equal(result.detected, false, 'false fire, evidence: ' + JSON.stringify(result.evidence));
  });
});

const TRUE_POSITIVE_CONFIRMSHAMING_FIXTURES = [
  {
    name: '"No thanks, I hate saving money." (canonical confirmshaming)',
    buttons: '<button>Yes, save 15%!</button><button>No thanks, I hate saving money.</button>',
  },
  {
    name: '"No, I prefer to pay full price." (matches the existing regex - see results doc re: the task\'s literal example)',
    buttons: '<button>Get my discount</button><button>No, I prefer to pay full price.</button>',
  },
  {
    name: '"I\'ll pass on this discount, thanks."',
    buttons: '<button>Claim discount</button><button>I\'ll pass on this discount, thanks.</button>',
  },
];

TRUE_POSITIVE_CONFIRMSHAMING_FIXTURES.forEach(({ name, buttons }) => {
  test('confirmshaming true-positive gate: ' + name + ' - must still fire', () => {
    const result = detectConfirmshamingPopup(modalDoc(buttons));
    assert.equal(result.detected, true, 'failed to fire on a true positive');
  });
});

// Documented discrepancy (see docs/conditional-signal-gate-results.md): the
// task brief's literal true-positive example, "I'd rather pay full price.",
// does NOT match any CONFIRMSHAMING_PATTERNS - the regex requires
// "prefer"/"like", not "rather". Reported as a finding, not silently
// substituted - this test pins down and documents that exact gap.
test('confirmshaming: documents that "I\'d rather pay full price." (task\'s literal example) does NOT match the current regex', () => {
  const result = detectConfirmshamingPopup(
    modalDoc('<button>Get my discount</button><button>I\'d rather pay full price.</button>')
  );
  assert.equal(result.detected, false);
});
