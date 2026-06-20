# Conditional-Keep Signal Gate — Results

Two signals were CONDITIONAL KEEP pending a false-fire test: `detectDemandCounter` (urgency-framed
counts) and `detectConfirmshamingPopup` (guilt-trip decline wording). **Both fail their gate.**
Confirmed signal count for v1 from this task: **1** (not 3) - only the unconditional signals stand,
pending planning's decision on what to do about these two failures.

No fixes were applied. This is the map; scoring/next steps are a planning decision.

## Step 0 — grounding against actual code

Read `detectDemandCounter` (`extension/src/detectors/social-proof.js`) and
`detectConfirmshamingPopup` (`extension/src/detectors/confirmshaming.js`) directly before designing
tests. The general claims in the task brief matched the code:

- `detectDemandCounter`: a sold/bought/purchased count only fires when paired with an urgency
  qualifier attached directly, or within a 150-char proximity window (`URGENCY_PROXIMITY_WINDOW`)
  of one, or of a countdown/"ends in" phrase. Confirmed.
- `detectConfirmshamingPopup`: only scans inside a container matching a modal/popup/overlay/lightbox
  class-or-id hint, or `[role="dialog"]`, then checks each button's text against 5 regexes.
  Confirmed - this also means fixtures need that wrapper or the detector never looks at them at all.

**One discrepancy found and documented, not silently worked around:** the task brief's literal
true-positive example for confirmshaming, *"I'd rather pay full price."*, does **not** match any of
the 5 `CONFIRMSHAMING_PATTERNS` - the relevant regex requires "prefer"/"like", not "rather"
(`/no,?\s*i\s*(prefer|like)\s*(to\s*)?pay(ing)?\s*full\s*price/i`). Pinned down in a dedicated test
(`honest-fixture-gate.test.js`, last test in the file) and substituted a corrected true-positive
phrase ("No, I prefer to pay full price.") for the rest of the suite, which does match.

## Test A — demand-counter proximity-rule torture test: **FAIL**

5 of 6 honest fixtures false-fired. All 3 true-positive fixtures still fired correctly.

| Honest fixture | Fired? | Evidence (verbatim) |
|---|---|---|
| Sold count near unrelated shipping-cutoff offer ("...offer ends in 2 hours...") | **FALSE FIRE** | `Page text pairs a sales count with urgency framing: "4,000+ sold"` |
| Sold count near a delivery ETA saying "today" | **FALSE FIRE** | `Page text pairs a sales count with urgency framing: "12,000+ sold"` |
| Best-seller badge near an unrelated seasonal sale countdown | **FALSE FIRE** | `Page text pairs a sales count with urgency framing: "50,000+ sold"` |
| Sold count near an unrelated newsletter-bonus deadline | **FALSE FIRE** | `Page text pairs a sales count with urgency framing: "1,200+ sold"` |
| Historical lifetime count near an honest store-closure urgency message | **FALSE FIRE** | `Page text pairs a sales count with urgency framing: "10,000+ sold"` |
| Sold count near a review-freshness "today" stamp | passed | (no evidence - see caveat below) |

**Caveat on the one pass:** it did not pass because the proximity logic correctly judged the
context honest. It passed because the fixture used "2 million sold" (word-form number), and
`SOLD_COUNT_PATTERN`'s `COUNT` sub-pattern (`\d{1,3}(?:,\d{3})*\+?`) only recognizes digit-form
counts - "2 million" never matches `SOLD_COUNT_PATTERN` at all, so the proximity check never runs.
Verified directly: `'2 million sold since 2015'.match(SOLD_COUNT_PATTERN)` → `null`, vs.
`'4,000+ sold'.match(SOLD_COUNT_PATTERN)` → matches. **Every honest fixture where the count was in
a digit form the detector can parse, false-fired - 100% of the time.** The proximity rule does not
discriminate honest from manipulative context at all; it fires on co-location alone.

True positives (all fired correctly, confirming the mechanism still works when actually
warranted): "12 sold in the last 24 hours"; "Only 12 sold remain - hurry, sale ends in 2 hours!";
"47 sold - selling fast!".

**Gap type:** logic/false-positive design gap, not timing or obfuscation - this is a hand-authored,
static fixture, no network, no settle-pass timing involved at all. The rule itself is the problem.

## Test B — confirmshaming honest-modal false-fire test: **FAIL**

4 of 8 honest fixtures false-fired - specifically and only the ones targeting the two broad
patterns identified during code-reading. All 3 true positives still fired correctly.

| Honest fixture | Fired? | Evidence (verbatim) |
|---|---|---|
| Plain cookie consent (Accept / Reject) | passed | - |
| Newsletter modal, neutral decline ("No thanks") | passed | - |
| Standard confirm/cancel dialog | passed | - |
| Charity donation modal: emotional body copy, neutral button ("Not now") | passed | - |
| Push-notification opt-in: "No, I don't want notifications" | **FALSE FIRE** | `Popup dismiss option uses guilt-tripping wording: "No, I don't want notifications"` |
| Location-permission prompt: "No, I do not want to share my location" | **FALSE FIRE** | `Popup dismiss option uses guilt-tripping wording: "No, I do not want to share my location"` |
| Feedback survey modal: "No thanks, I don't like surveys" | **FALSE FIRE** | `Popup dismiss option uses guilt-tripping wording: "No thanks, I don't like surveys"` |
| Self-aware/cheeky copy: "No thanks, I hate pop-ups" | **FALSE FIRE** | `Popup dismiss option uses guilt-tripping wording: "No thanks, I hate pop-ups"` |

**Offending logic:** two of the five `CONFIRMSHAMING_PATTERNS` are unbounded after their key verb -
they don't require the refused thing to be money/a-deal/a-discount at all:
```
/no,?\s*i\s*(don'?t|do not)\s*want/i              <- matches "No, I don't want " + ANYTHING
/no\s*thanks?,?\s*i\s*(hate|don'?t like)/i        <- matches "No thanks, I hate/don't like " + ANYTHING
```
Any honest decline phrased in that grammatical shape - refusing notifications, location sharing, a
survey, or even self-deprecating copy about pop-ups in general - matches, regardless of topic. The
other three patterns (pay-full-price, don't-want-to-save, pass-on-this-deal) are correctly scoped to
discount/deal language and did not produce any false fires across this fixture set.

The 4 baseline honest fixtures (cookie consent, newsletter, confirm/cancel, charity) all passed
because none of their button text matches the *grammatical shape* of any of the 5 patterns at all -
not because the detector successfully distinguished topic.

**Gap type:** logic/false-positive design gap (regex scope), same category as Test A - not timing,
not obfuscation.

## Test artifacts

- `extension/tests/honest-fixture-gate.test.js` - the executable fixture set (21 tests: 6 honest +
  3 true-positive for demand-counter, 8 honest + 3 true-positive + 1 documented-discrepancy for
  confirmshaming). Run with `node --test extension/tests/honest-fixture-gate.test.js`.
- This file.

## Summary for planning

| Signal | Gate result | Confirmed cause |
|---|---|---|
| `detectDemandCounter` | **FAIL** | Proximity rule fires on co-location alone; doesn't and structurally can't distinguish honest from manipulative context. Fails on every honest fixture where the count syntax is even recognized. |
| `detectConfirmshamingPopup` | **FAIL** | 2 of 5 regexes are topic-unbounded after "don't want" / "hate or don't like" - fire on any honestly-phrased refusal in that grammatical shape, regardless of subject. |

**v1 signal count from this task: 1**, not 3 - both conditional signals failed their gate as
currently implemented. Neither failure is a timing or obfuscation problem (no network was used in
either test); both are narrowing/scoping problems in the existing regex logic, fixable in principle
(tighten the proximity rule to require a causal/topical link, not just spatial proximity; bound the
two broad confirmshaming patterns to discount/deal-refusal language specifically) - but no fix was
applied here per the task's scope. Decision on whether to fix-and-retest, drop, or ship with a
documented limitation is for planning.
