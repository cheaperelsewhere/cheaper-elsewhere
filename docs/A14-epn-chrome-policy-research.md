# A14 — EPN / Chrome Web Store policy research

Research only, no code changes. Resolves (as far as public documentation allows) the three OPEN
third-party policy questions A10 flagged but didn't answer:

1. Does EPN review require a build with demonstrably working affiliate tracking?
2. Are production Browse API access and EPN affiliate-tracking enrollment the same grant or two
   separate ones?
3. Does Chrome's affiliate-ads policy (enforced 10 Jun 2025) require the listing description
   itself, not just in-UI disclosure, to state the affiliate relationship up front?

All findings below are sourced from eBay's and Google's own current published pages (fetched
2026-06-23), not from training-data memory — this area moves fast enough (Chrome's policy itself
was a March 2025 update, enforced June 2025) that anything older than a few months needs
re-verification before being relied on again.

## Question 1 — does EPN testing require a working build?

**Leans yes, for this specific track.** eBay's "Software: Applications and Downloadable Tools"
page (the track that covers a browser extension) states the applicant must confirm:

> "...your software is fully integrated or will be integrated within the next week for testing by
> the Operation Support Team."

and separately that software "may not attempt to evade testing or attempt to conceal its
practices." Read together, eBay's Operation Support Team actually installs/tests the real software
within about a week of the application — not just a written description of it. A build that is
genuinely sandbox-only (no real eBay links, no real commission possible) risks failing that test,
since there would be nothing real for them to verify.

Countervailing data point: a developer-forum thread title ("How to register for EPN without an app
developed") suggests some applicants get into EPN's *general* affiliate program by demoing against
sandbox/Marketplace Insights first, then building out later. That looks like a path into EPN
broadly, not specifically through the "Software: Applications and Downloadable Tools" track's own
testing requirement — the two may not be the same gate. Not fully resolved; flagged honestly as a
remaining gap rather than asserted either way.

## Question 2 — is production Browse API access the same grant as EPN, or separate?

**Functionally coupled, not two independent paths.** eBay's Buy APIs Requirements page states
production Buy API use (which includes Browse) "is intended for eBay partners only, and you must
apply for production access through the eBay Partner Network." Sandbox/Explorer access to Browse
is open to any eBay Developer account holder, but the move to production for this kind of
consumer-facing buying integration routes through EPN, not around it.

**Practical implication for this project:** there is no realistic path to swap
`worker/wrangler.toml`'s `EBAY_API_BASE_URL` to production ahead of EPN approval. The EPN
application is the actual next concrete action, not a parallel/independent step that can be done
first to make the EPN application more impressive.

## Question 3 — must the Chrome listing itself (not just in-UI) disclose the affiliate relationship?

**Confirmed yes**, directly from Chrome's official Affiliate Ads policy page:

> "Any affiliate program must be described prominently in the product's Chrome Web Store page,
> user interface, and before installation."

Three required locations, all mandatory, not alternatives: the Store listing page, the in-extension
UI, and a before-install disclosure. This directly resolves A10's open question — `docs/chrome-
listing-copy.md`'s affiliate paragraph isn't optional flavor text, it's a policy requirement. (It's
now also fixed to drop a "may earn" hedge that contradicted this project's own settled wording rule
— see that file's history.)

Additional Chrome policy detail surfaced during this research, relevant to this build's design
(not a new question, but worth recording): affiliate links/cookies must only be inserted when there
is "a direct and transparent user benefit... at that moment" (a real discount, cashback, or
donation) — "a coupon extension must not inject an affiliate link if no valid coupon or discount is
available" is the policy's own example of a violation. This build's existing design (the badge only
ever appears, and only ever carries a link, when `findCheaperListing` found a genuinely cheaper
landed cost) already satisfies this by construction, not by coincidence — worth keeping in mind as
a real compliance reason not to loosen the abstain-by-default behavior later, beyond the trust
reasons already documented elsewhere.

Not resolved by Chrome's published policy text (checked the FAQ specifically): whether a hedged
"may earn a commission" wording is itself a violation, or whether Chrome is silent on that and it's
governed only by general advertising-truthfulness law (ASA-style precedent, which is the basis this
project already uses internally — see A7/A10). Chrome's own FAQ doesn't address wording
specificity at all, so this project's existing "definite, present-tense" house rule remains the
better bar to hold to than anything Chrome's policy itself mandates.

## Bottom line — what's actually next

The next concrete, unblocking action toward either submission is **applying to the eBay Partner
Network under the "Software: Applications and Downloadable Tools" track.** This is an external,
business-side action (not a code task) — done at partnernetwork.ebay.com, not in this repo. Two
things worth knowing going in, both sourced above:

- Expect eBay's Operation Support Team to actually test the installed extension within about a
  week of applying — the extension already works end-to-end against sandbox data, so it's
  testable today, but a tester probing for real affiliate links/commission would currently find
  none.
- There's no independent way to get production Browse API access first to make the application
  stronger — production access is granted *through* EPN approval, not before it.

This doesn't change anything about the A10 finding that the build can't yet demonstrate a real
working affiliate flow — it explains *why* that gap can't be worked around with more code, and
narrows "what's next" to a specific external action rather than an open-ended list.

## Sources

- [Software Applications and Downloadable Tools | eBay Partner Network](https://partnernetwork.ebay.com/page/software-applications-and-downloadable-tools)
- [Buy APIs Requirements | eBay Developers Program](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html)
- [Affiliate Ads | Chrome Web Store - Program Policies | Chrome for Developers](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads)
- [Affiliate Ads FAQ | Chrome Web Store - Program Policies | Chrome for Developers](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads-faq)
- [Chrome Web Store policy updates: Strengthening our policies on affiliate programs in Chrome Extensions](https://developer.chrome.com/blog/cws-policy-update-affiliate-ads-2025)
- [How to register for EPN without an app developed - eBay Developer Forums](https://forums.developer.ebay.com/questions/35753/how-to-register-for-epn-without-an-app-developed.html)
