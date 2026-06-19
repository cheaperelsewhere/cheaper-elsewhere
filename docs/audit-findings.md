# Six-Signal Reality Audit — Findings (PAUSED, INCOMPLETE)

Paused mid-audit due to session budget. This is a map of what was found before stopping, not a
finished audit. No fixes were applied in this pass (by design — map only).

## Build-state map

The audit prompt named six target signals. Only three have any implementation; one of those
three is complete, two are partial.

| Target signal | Build state | Detail |
|---|---|---|
| Pre-ticked add-on checkboxes | **Full** | `detectPreselectedAddons` in `extension/src/detectors/preselected-addons.js` |
| Hardcoded/static scarcity numbers | **Partial** | `detectScarcityMessaging` exists but only does phrase detection ("only 3 left"). No check for whether the number is static/hardcoded across reloads - that half was never built. |
| Countdown-timer reset | **Partial** | `detectCountdownTimer` exists but only does presence detection (clock pattern + urgency wording, or a countdown-named class). No reset-on-revisit check (e.g. comparing timestamps across visits via `localStorage`) - that half was never built. |
| Fake live-sale popup loop ("Jane from Leeds bought this...") | **None** | No code anywhere under any name. Confirmed via exhaustive repo-wide grep for app names (Fomo/ProveSource/Nudgify/Sales Pop), "minutes ago" patterns, and popup/toast detection logic - zero hits. |
| Unlinked "as seen on" badges | **None** | No code anywhere. Zero grep hits for any related keyword. |
| Third-party review-import footprint | **None** | No code anywhere. Zero grep hits for Yotpo/Loox/Judge.me/Trustpilot/Okendo/Stamped/Reviews.io or any review-import concept. |

The repo has exactly 6 detector functions total (also includes `detectDemandCounter` and
`detectReferencePriceDisplay` and `detectConfirmshamingPopup`, which fall outside this prompt's
six names but are part of the original signal set this build started from).

## Live findings (this audit pass)

### 1. `detectCountdownTimer` vs. an honest site — **LIVE-TESTED, CONFIRMED FALSE POSITIVE**

Tested against **humblebundle.com** (a well-known, legitimate, charity-linked storefront whose
bundle countdowns are genuinely real and enforced - not manipulative urgency), under the current
settle-pass model (waited specifically for the merged `(settled)` result).

- First load: `humblebundle.com/bundle/books` 404'd, landing on Humble Bundle's own fallback page
  (which itself lists upcoming bundle rotations with real countdowns). Result: `detected: true`,
  29 evidence entries.
- Second load, to rule out the 404 page as an artifact: the real homepage,
  `https://www.humblebundle.com/`. Result: `detected: true`, **54** evidence entries.

Sample verbatim evidence from the homepage run:
```
"Element with a countdown/timer class or id: \"10:05:49:43\""
"Element with a countdown/timer class or id."
```

This is a confirmed, repeatable false positive on a legitimate site. The detector's class/id-hint
matching (`countdown`/`timer` substring) and clock-pattern text matching both fire on Humble
Bundle's real, honest "bundle rotates in N days" countdowns exactly as readily as on a
manipulative one - the detector has no way to distinguish them, by design (it only checks
structural presence, never enforcement/honesty, which isn't DOM-observable anyway).

### 2. `detectScarcityMessaging` vs. an honest site — **ATTEMPTED, INCOMPLETE**

Goal: find a genuinely honest scarcity claim (e.g. a one-of-a-kind handmade item where "only 1
available" is literally true) and check for a false positive, mirroring the countdown test.

What happened:
- Etsy search and category pages: blocked (HTTP 403 via direct fetch; blank/bot-challenge page
  via headless browser - 1269 bytes of HTML, no visible text, generic "etsy.com" title).
- A specific real Etsy listing URL found via web search (a one-of-a-kind original painting
  listed as "Only 1 available") was also blocked the same way when loaded with the extension.
- Bandcamp search: returned a "Client Challenge" bot-detection page.

**This test was not completed.** I could not get past bot-detection in this headless environment
to reach a real honest-scarcity page in the time available.

Separately worth flagging regardless of the block: `SCARCITY_PATTERNS` in `scarcity.js` has no
pattern matching "available" phrasing at all (only "left"/"in stock"/"low stock"/"limited
stock"). So even had the Etsy test gone through, "Only 1 available" specifically would likely
have been a true-negative-by-accident (missed because the wording doesn't match any pattern) -
not evidence that the detector correctly distinguishes honest from manipulative claims. This is
a real-world-robustness coverage gap independent of the honest/dishonest question, and applies
to manipulative pages using "available" wording too, not just honest ones.

### 3. `detectPreselectedAddons` real-world test — **NOT ATTEMPTED**

No live test was run against a real travel-booking-style flow (e.g. pre-checked insurance/add-on
checkboxes) in this pass. Build state is confirmed (full implementation, see map above) but its
real-world robustness is **unknown** - inspected-only, not live-tested, in this audit.

### Real-world-robustness on manipulative pages — recalled, not freshly re-tested

Earlier in this overall build (Step 2's crash-fix and detector-accuracy work, prior to this audit
prompt), `detectCountdownTimer` and `detectScarcityMessaging` were live-tested against real
manipulative pages (a live AliExpress listing, a live Shopify store) and fired correctly there.
That testing is **not being re-cited here as part of this audit** without caveat: some of it
predates the current settle-pass/merge model and the demand-counter narrowing, and none of it
was re-run fresh in this specific pass. Treat prior-session evidence as background only: this
audit pass focused on the honest-page false-positive question, which was the explicit priority,
and did not get to re-confirming real-world-robustness against manipulative pages under the
current model before pausing.

## Exact emitted strings (verbatim, read from source - not paraphrased)

**`detectPreselectedAddons`** (`preselected-addons.js`):
```
'A pre-checked checkbox adds an extra item: "' + labelText.slice(0, 80) + '"'
```

**`detectScarcityMessaging`** (`scarcity.js`):
```
'Page text claims limited stock: "' + match[0] + '"'
```

**`detectCountdownTimer`** (`countdown-timer.js`), two distinct emission sites:
```
'Element with a countdown/timer class or id' + (text ? ': "' + text + '"' : '.')
'Page text shows a clock-style countdown ("' + clockMatch[0] + '") next to urgency wording.'
```

All three read as neutral observations on their face ("Page text claims...", "Element with...",
"Page text shows..."), not accusations - that framing question is separate from the false-positive
finding above, which is about *whether* the observation is true on honest pages, not about *how*
it's worded.

## What's left when this resumes

- Finish the honest-scarcity false-positive test (need a non-bot-gated source - consider a
  smaller independent store rather than a major bot-hardened platform).
- Live-test `detectPreselectedAddons` against a real pre-checked-addon flow (travel booking is a
  classic real-world example).
- Re-confirm real-world-robustness of `detectCountdownTimer` / `detectScarcityMessaging` on
  manipulative pages specifically under the current settle-pass model (not just recalled from
  earlier in the build).
- Decide what to do about the confirmed Humble-Bundle-style false positive on countdown-timer -
  no fix was applied or proposed in code; this is a scope/design decision for planning.
