# Chrome Web Store listing copy — Cheaper Elsewhere

Two versions in this doc, for two different stages — use the right one, don't mix them up:

1. **Sandbox-stage copy** (below, "USE NOW") — honest about today's build, for the **Unlisted**
   listing needed so eBay's EPN Operation Support Team has a real install link to test within
   their ~1 week window.
2. **Production copy** (further down, "FUTURE — DO NOT USE YET") — describes the intended
   real-catalog experience, for once the sandbox/production gap actually closes.

## USE NOW — Sandbox-stage copy (for the Unlisted listing)

### Short description (≤132 characters)

```
Compares your Shopify product against eBay listings for a genuinely cheaper price. In development — limited to eBay's test catalog.
```
(132 characters)

### Detailed description

```
Cheaper Elsewhere checks the Shopify product page you're viewing against eBay listings, and shows
a badge only when a genuinely cheaper price actually exists — including shipping, not just the
item price.

Current status: this build is wired to eBay's sandbox (test) environment while we pursue eBay
Partner Network approval and production API access. The comparison logic runs for real end-to-end,
but matches currently come from eBay's small seeded test inventory, not real-world listings — so
you likely won't see a badge reflecting an actual real product yet. This listing is unlisted and
exists for development/review purposes during that process, not as a finished consumer release.

How it works:
• On a Shopify product page, it identifies the product (using its barcode/GTIN when available,
  for an exact match).
• It checks that product against eBay listings.
• If — and only if — eBay has the same product for less once shipping is included, you'll see a
  small badge with the price and a link.
• If nothing is genuinely cheaper, you won't see anything.

What it doesn't do:
• No account required.
• No browsing history collected, no profile built, no tracking across sites.
• No data retained — each price check is handled and forgotten.

No affiliate tracking is active in this build yet (no eBay Partner Network campaign ID is
configured). The badge says so explicitly. If/when that changes, any affiliate-tracked listing
will carry a visible "Ad" tag and a plain, present-tense commission disclosure — both in the
extension and updated here.

Privacy policy: https://cheaperelsewhere.github.io/cheaper-elsewhere/
```

## Category

Shopping

## Single-purpose description (Chrome Web Store Developer Dashboard field)

```
Compares the Shopify product page the user is viewing against eBay listings and shows a badge
when a genuinely cheaper price (including shipping) exists for the same product.
```

## Permission justification (host_permissions: shopper-protection-ebay-worker.dwelluma.workers.dev)

```
This is the extension's own backend (a Cloudflare Worker) that proxies eBay Browse API lookups.
The extension sends it only a product title, GTIN, and currency to search for matching eBay
listings — no browsing history, no personal data, no other site access is requested.
```

## FUTURE — DO NOT USE YET (production copy, once the sandbox gap closes)

This version describes price comparisons against eBay's **real, production** listing catalog —
written for once `EBAY_CAMPAIGN_ID` is set and `worker/wrangler.toml`'s `EBAY_API_BASE_URL` points
at `api.ebay.com` instead of sandbox. Publishing this version today would describe a capability the
build doesn't have yet for a real shopper — switch the live Chrome listing to this copy only once
that's actually true, then update the listing from Unlisted to Public at the same time.

### Short description (≤132 characters)

```
Finds a genuinely cheaper price on eBay for the Shopify product you're viewing. No account, no tracking.
```
(106 characters)

### Detailed description

```
Cheaper Elsewhere checks the Shopify product page you're looking at against eBay listings, and
shows you a badge only when a genuinely cheaper price actually exists — including shipping, not
just the item price.

How it works:
• On a Shopify product page, it identifies the product (using its barcode/GTIN when available,
  for an exact match).
• It checks that product against eBay listings.
• If — and only if — eBay has the same product for less once shipping is included, you'll see a
  small badge with the price and a link.
• If nothing is genuinely cheaper, you won't see anything. No false alarms, no generic "similar
  items" padding.

What it doesn't do:
• No account required.
• No browsing history collected, no profile built, no tracking across sites.
• No data retained — each price check is handled and forgotten.

Some listings shown are affiliate-tracked. Where that's the case, the badge marks it with a visible
"Ad" tag and states plainly that we earn a commission if you buy through that link, at no extra
cost to you — never a hedged "may earn" (a real commission is always earned once a listing is
affiliate-tracked, so saying otherwise would be misleading). Whether a listing is shown is never
influenced by whether it happens to be affiliate-tracked.

See our privacy policy for full details on what's processed and what isn't:
https://cheaperelsewhere.github.io/cheaper-elsewhere/
```

## Why the affiliate paragraph is here, not optional

Confirmed via Chrome's official Affiliate Ads policy:
"Any affiliate program must be described prominently in the product's Chrome Web Store page, user
interface, and before installation." Whichever version is live, the disclosure isn't optional
flavor copy — the listing page itself is one of the three places Chrome's policy requires it,
alongside the in-extension UI (already handled by the badge's "Ad" tag) and a before-install
disclosure. The sandbox-stage copy satisfies this today by being explicit that no tracking is
active at all yet, which is simply true; the production copy satisfies it once tracking is real.
