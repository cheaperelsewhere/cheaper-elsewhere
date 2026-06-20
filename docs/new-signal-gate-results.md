# New Candidate Signal Gate — Results

Pre-build test of two NEW candidate signals' claims-as-worded, before any detector code exists.
**Both candidates clear their gate** against hand-authored fixtures. No detector code was written -
the claim functions below live only in the test file
(`extension/tests/new-signal-gate.test.js`) and are not part of the production source tree.

"Pass" here means **pass-against-hand-authored-fixtures (reasoned-zero + tested-zero), not
proven-zero in the wild** - same standing caveat as the demand-counter/confirmshaming gate. These
claims have never been run against a real page.

## Step 0

`git log --oneline` / `git status` confirmed a clean tree at 3 prior commits before starting. No
existing detector code for either candidate (correctly - these are new). Reused the
`honest-fixture-gate.test.js` pattern (`node:test` + `jsdom`, hand-authored HTML, no network).

## Candidate 1 — pre-ticked consent opt-in: **PASS**

9 honest fixtures, 0 false fires. 4 true-positive fixtures, all fired. 26-test file overall: 0
failures for this candidate.

**Design note, stated plainly:** the consent-language pattern was scoped to require the marketing/
subscription/data-sharing *object* of the phrase, not bare trigger words, before ever running a
test - not loosened after observing a failure. E.g. "sign up for" only matches when followed by
"(the) newsletter/marketing/promotional", specifically because a bare "sign me up" would also match
the honest "Sign me up for SMS delivery alerts for this order" fixture. That fixture was included
and confirmed to NOT fire under the scoped pattern.

| Honest fixture | Fired? |
|---|---|
| Terms & Conditions acknowledgement | No |
| "Remember me on this device" | No |
| "Keep me signed in" | No |
| "Save this address for next time" | No |
| Pre-checked box, no label association at all | No |
| Same T&C text via `aria-label` instead of `<label for>` | No |
| "Sign me up for SMS delivery alerts for this order" (transactional, not marketing) | No |
| "Notify me when this item is back in stock" (transactional) | No |
| "Email me a copy of my receipt" (transactional) | No |

| True positive | Association method used | Fired? |
|---|---|---|
| "Yes, send me marketing emails and special offers" | `<label for>` | Yes |
| "Subscribe me to the newsletter" | wrapping `<label>` | Yes |
| "Share my information with trusted partners" | `aria-label` | Yes |
| "Opt in to receive promotional offers from our partners" | `aria-labelledby` | Yes |

**Label-association methods covered:** all four requested - `<label for>`, wrapping `<label>`,
`aria-label`, `aria-labelledby` - each exercised by at least one true positive, and `<label for>`/
wrapping `<label>`/`aria-label` also exercised on the honest side.

**Forward-looking implementation note (not a Step-0 contradiction - there's no existing detector
for this signal):** the existing shared utility `SPEUtils.speLabelTextFor` (used by
`detectPreselectedAddons`, the closest production analog) does **not** support `aria-label` or
`aria-labelledby` at all - only `<label for>` and wrapping `<label>`. If Candidate 1 is built later
by naively reusing that utility as-is, label resolution will be incomplete. The
`resolveLabelText` function in the test file is a complete reference implementation covering all
four methods; a real build should either extend `speLabelTextFor` or adopt this logic directly.

**Untested, flagged honestly:** consent text that isn't formally associated via any of the four
methods but sits visually adjacent (e.g. plain sibling text with no `for`/wrapping/aria
relationship) was not tested as a *miss* case beyond the single "no label at all" fixture - the
claim correctly does not attempt to read such text, which is the right behavior per the task's
explicit "can't read intent → must not fire" requirement, but real pages may rely on exactly that
informal pattern, which would mean a real miss (not a false fire) in the wild. Recall, not
precision, would be the open question there.

## Candidate 2 — recurring-charge disclosure present: **PASS**

9 of 9 recall fixtures found. 4 of 4 negative fixtures correctly did not fire. 0 failures.

| Recall fixture | Found? |
|---|---|
| "£9.99/month" | Yes |
| "£9.99 per month" | Yes |
| "then £12 a month after your free trial" | Yes |
| "billed annually at £99/year" | Yes |
| "renews automatically at £49.99/yr" | Yes |
| "$14.99/mo after trial" | Yes |
| "auto-renews every month" | Yes |
| "recurring payment of £5 weekly" | Yes |
| "charged £20 each and every month" (number/period separated) | Yes |

| Negative fixture | Fired? |
|---|---|
| "£40 one-time payment" | No |
| "£40" with no period word | No |
| "delivery in 2-3 months" (duration, not billing) | No |
| "12 month warranty" (duration, not billing) | No |

**Design, stated plainly (designed before running, not patched after a failure):** two
independent patterns, either one sufficient: (1) a currency amount directly attached to a period
via `/`, "per", "a", or "each" (e.g. `£9.99/month`, `£12 a month`) - this alone disambiguates from
a bare duration, since a duration never has a currency symbol attached to the period word; (2) a
billing/renewal verb (renews/auto-renews/recurring/billed/charged/subscription) within a 60-
character window of a period word, for phrasings with no currency symbol attached directly (e.g.
"auto-renews every month") or where the amount and period are separated by other words. The
negative fixtures were chosen specifically because a naive `<number> + month` match would wrongly
fire on them - confirmed neither pattern does, because neither a currency symbol nor a billing verb
is present in any of the four negatives.

**Untested, flagged honestly:**
- Currency stated as a word/code rather than a symbol (e.g. "9.99 GBP per month", "9.99 euros
  monthly") - the `CURRENCY` sub-pattern requires a literal `£`/`$`/`€` symbol. Pattern (1) would
  miss these; pattern (2) would only catch them if a billing verb also happens to be nearby. Not
  tested, plausible real-world recall gap.
- A price and its period stated far apart (e.g. in separate table cells, beyond the 60-char
  window) with no billing verb at all. Not tested.
- Multi-currency or non-Latin script pages. Not tested.

## Summary for planning

| Candidate | Gate result | Caveat |
|---|---|---|
| Pre-ticked consent opt-in | **PASS** | Reference label-resolution covers all 4 ARIA/HTML association methods; the existing shared utility does not yet, and would need extending if reused. |
| Recurring-charge disclosure | **PASS** | Recall confirmed only for currency-symbol-led phrasings (£/$/€); word-form currency ("9.99 GBP/month") is untested and a plausible miss. |

Both candidates are cleared to be **built** as real detectors in a later task, against the claim
functions proven here. No detector code or fixes were written in this task. Test artifacts:
`extension/tests/new-signal-gate.test.js` (26 tests, all passing) and this file.
