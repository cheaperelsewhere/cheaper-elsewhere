# Unit 3 — Build + Re-Gate Results

Built `detectPreselectedConsent` and `detectRecurringCharge` as real production detectors,
porting the proven claim functions from `extension/tests/new-signal-gate.test.js` verbatim (no
loosening), then re-gated the BUILT detectors against the exact same fixtures the claims were
gated against.

## What was built

- `extension/src/detectors/preselected-consent.js` - `detectPreselectedConsent`. Uses the
  Unit-2-extended `SPEUtils.speLabelTextFor` for label resolution (all four association methods).
  Consent-language pattern ported byte-identical from the gate - not loosened.
- `extension/src/detectors/recurring-charge.js` - `detectRecurringCharge`. Both proven patterns
  ported (currency-attached-to-period; billing-verb-within-60-chars-of-a-period-word).
  Symbol-led only (£/$/€); a code comment documents the word-form/ISO-code currency limitation
  so it isn't mistaken for an oversight later.
- Wired into `extension/src/detectors/index.js`'s `DETECTOR_FNS` (appended, nothing removed -
  demand-counter and confirmshaming-popup are untouched per the task's explicit scope reminder)
  and into `extension/manifest.json`'s content script load order.
- Updated `extension/tests/fixtures/dark-patterns.html` to include a genuine example of each (a
  pre-ticked marketing-consent checkbox, a "$9.99/month" subscription mention), since that
  fixture's purpose is "every wired-in signal fires here" and it predated these two detectors.

## Re-gate: built detectors vs. the exact same gate fixtures - PASS, exact match

Fixture data was extracted into a shared module
(`extension/tests/fixtures/signal-gate-fixtures.js`) that both the original claim-gate test
(`new-signal-gate.test.js`) and the new re-gate test (`v1-detector-re-gate.test.js`) import - no
copy-paste, so no possibility of drift between "what was gated" and "what was re-gated".

| Detector | Fixtures run | Result |
|---|---|---|
| `detectPreselectedConsent` | 9 honest, 4 true-positive | **0 honest fires, all 4 true-positives fire** - exact match with the claim function |
| `detectRecurringCharge` | 9 recall, 4 negative | **all 9 found, 0 negatives fire** - exact match with the claim function |

No divergence between built detector and gated claim was found on any of the 26 re-gate fixtures.

## Regressions caught and fixed during this unit

Wiring the two new detectors into `index.js`'s `DETECTOR_FNS` broke
`extension/tests/detectors.test.js`'s vm-sandbox loader, which provides `index.js`'s global
dependencies manually and didn't yet know about the two new ones - this crashed the entire test
file at load time (a `ReferenceError` inside the vm context, before any test even registered).
Fixed by adding both to the sandbox's provided globals, and updated a hardcoded
`results.length === 6` assertion (in the "one detector throwing doesn't stop the others" test) to
`8`, matching the new total detector count. Full suite before this fix: 86 tests/76 pass/**10**
fail (1 new, unexpected). After: 123 tests/114 pass/**9** fail (back to exactly the known
pre-existing demand-counter/confirmshaming gate failures, no new ones).

Also caught and fixed: the real-browser fixture suite (`scripts/verify-detectors.js`) initially
showed `preselected-consent` and `recurring-charge` both `FAIL` against `dark-patterns.html` -
not a detector bug, the fixture simply predated these detectors and didn't contain their
patterns. Fixed by adding genuine examples to the fixture (see above), confirmed via
`npm run verify:detectors`: all checks pass in real Chrome, including the two new detectors
firing correctly on the dirty fixture and staying silent on the clean one.

## Full suite state

- `npm test`: 123 tests, 114 pass, 9 fail (all 9 are the pre-existing, intentionally-failing
  demand-counter/confirmshaming gate from a prior task - unrelated, unchanged, not regressed).
- `npm run verify:detectors`: ALL CHECKS PASSED (real Chrome, real extension, all 8 wired
  detectors).
- `npm run verify:extension`: indicator state machine (checking → none) and shadow-DOM isolation
  both confirmed unaffected.

## Confirmed built-and-re-gated v1 signal list

For Step 3 (observation-list UI) to design against:

| # | Detector | Status |
|---|---|---|
| 1 | `detectCountdownTimer` | Built, wired, in pipeline (real-world false-positive against Humble Bundle previously documented - unresolved, separate from this task) |
| 2 | `detectScarcityMessaging` | Built, wired, in pipeline |
| 3 | `detectReferencePriceDisplay` | Built, wired, in pipeline |
| 4 | `detectPreselectedAddons` | Built, wired, in pipeline - live-tested against 3 real pages this session (Unit 1), true-positive side unverified in the wild (search exhausted, reported plainly) |
| 5 | `detectPreselectedConsent` | **New this task** - built, wired, re-gated exact match |
| 6 | `detectRecurringCharge` | **New this task** - built, wired, re-gated exact match |
| - | `detectDemandCounter` | In pipeline but FAILED its honest-fixture gate (prior task) - out of scope here, untouched |
| - | `detectConfirmshamingPopup` | In pipeline but FAILED its honest-fixture gate (prior task) - out of scope here, untouched, "separate later fix-and-re-gate task" per this task's scope reminders |

**Standing caveat, restated:** every "pass" above means pass-against-hand-authored-or-the-3-real
pages-actually-tested, not proven-zero across all real pages in the wild. None of this task's
testing used live network fixtures for the two new detectors (the gate and re-gate were both
hand-authored static HTML, no network, per the task's explicit constraints) - that's a real
limitation worth a future live-test pass, the same caveat already on record for every other
signal in this project.
