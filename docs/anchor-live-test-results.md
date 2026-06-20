# Unit 1 — Anchor Live-Test Results (`detectPreselectedAddons`)

## Outcome: anchor does NOT materially fail on real pages tested. True-positive firing is
## UNVERIFIED, not failed - no real page with a genuine pre-ticked paid add-on could be sourced
## in this environment after ~10 good-faith attempts across distinct retail categories.

This is reported plainly per the task's explicit instruction, rather than substituting a
hand-authored page and calling it "live-tested."

## Honest set (real pages, true negatives): 3/3 PASS, no crash

| File | Source | Result |
|---|---|---|
| `amazon-airpods-honest.html` | `amazon.com/dp/B0BDHB9Y8H` | `detected: false`, no crash |
| `amazon-laptop-honest.html` | `amazon.com/dp/B0CX23V2ZK` | `detected: false`, no crash |
| `cribofart-honest.html` | `cribofart.com/.../2-bridges` | `detected: false`, no crash |

All three are genuine, unedited real pages (saved via Playwright's `page.content()` after full
real-Chrome rendering, so any client-JS-inserted markup is captured - see
`extension/tests/fixtures/real-pages/SOURCES.md`). Two Amazon product pages each had exactly one
unchecked checkbox with no resolvable label text; the cribofart page had none at all. The detector
correctly stayed silent on all three and did not throw despite each page being large (1.2-1.3MB),
complex, real-world markup - jsdom logged harmless "Could not parse CSS stylesheet" warnings
(jsdom's CSS engine choking on modern syntax it doesn't support) but these did not affect the
detector's correctness or cause a crash.

Verified via `extension/tests/anchor-live-test.test.js` (3/3 passing).

## True-positive search: not found, reported plainly

Goal: a real, live page with a genuine pre-ticked PAID add-on checkbox (warranty, insurance,
protection plan, etc.), to confirm the anchor actually fires under real conditions, not just
hand-authored ones.

Sites attempted and what happened:

| Site / approach | Category | Result |
|---|---|---|
| Best Buy (AirPods product page) | Electronics, protection plan | `net::ERR_HTTP2_PROTOCOL_ERROR` - blocked |
| GoDaddy (domain search/cart) | Domain registrar, classic upsell offender | "Access Denied" - blocked |
| Extend's own Shopify App Store listing | Warranty-widget vendor | Marketing page only, no live widget DOM, no named customer found with a working URL |
| Currys (UK electronics, named in a 2024 CMA enforcement case re: extended warranty sales) | Electronics, protection plan | Cloudflare "Attention Required!" - blocked |
| Namecheap (domain cart) | Domain registrar | Cloudflare "Just a moment..." - blocked |
| Bed Bath & Beyond / Overstock (named in a 2024 press release re: adding Extend protection) | Big-box retail, protection plan | Homepage loaded; product and search pages returned "There was an error processing your request" (consistent with automation detection) |
| Walmart (AirPods Pro product page) | Big-box retail, protection plan | "Robot or human?" - blocked |
| Amazon (2 product pages, electronics most likely to show an Asurion protection plan) | Big-box retail, protection plan | Pages loaded fully and cleanly, but neither showed an Asurion/protection-plan widget at all in this logged-out, automated session - became the honest-set fixtures instead |

**Conclusion:** every major retailer or vendor with a documented or plausible pre-ticked-add-on
pattern either blocked automated/headless access outright, or (for the two that did load -
Amazon, twice) didn't surface the protection-plan widget in a logged-out automated session at
all. This is a genuine environmental limitation of this sandbox, not evidence the pattern no
longer exists in the wild (the Currys CMA case and the BBB/Extend press release are both real,
documented instances of this exact pattern - they just couldn't be reached here to verify
*current* live behavior).

## Gate assessment

Per the task: "if the anchor materially fails on real pages, STOP and report." **It did not
materially fail** - zero false fires, zero crashes, across every real page actually reachable.
The gap is on the unverified true-positive side, which is a coverage gap in this testing attempt,
not a detector failure. Proceeding to Units 2 and 3 as the task's stop condition was not
triggered. Flagging for planning: real-world true-positive confirmation for this anchor is still
open, and worth revisiting from an environment without this sandbox's bot-detection exposure (a
real browser session, or network conditions that don't trip automation detection) if a stronger
guarantee is wanted before wider rollout.

**Standing caveat:** "pass" on the honest set means pass-against-these-three-real-pages, not
proven-zero across all real honest pages in the wild.
