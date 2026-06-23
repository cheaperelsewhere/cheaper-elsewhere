# Chrome Web Store listing copy — Shopper Protection

Drafted ahead of submission. **This copy describes the intended production experience** (the
extension comparing against eBay's real listing catalog) — see the caveat at the bottom before
actually publishing, since the build is currently wired to eBay's sandbox catalog only (see
`docs/A10-submission-readiness.md`).

## Short description (≤132 characters, shown in search results)

```
Finds a genuinely cheaper price on eBay for the Shopify product you're viewing. No account, no tracking.
```
(106 characters)

## Detailed description (shown on the listing page)

```
Shopper Protection checks the Shopify product page you're looking at against eBay listings, and
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

Some listings shown may be affiliate links. Where that's the case, the badge tells you so plainly
and discloses that we may earn a commission, at no extra cost to you. Whether a listing is shown
is never influenced by whether it happens to be affiliate-tracked.

See our privacy policy for full details on what's processed and what isn't.
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

## Caveat — don't publish this copy against the current build as-is

This copy describes price comparisons against eBay's **real, production** listing catalog. As of
this writing, the deployed Worker (`worker/wrangler.toml`) is configured against
`https://api.sandbox.ebay.com`, eBay's sandbox/test catalog — not production — and
`EBAY_CAMPAIGN_ID` is unset, so no real affiliate link or commission is currently possible either.
Publishing this listing copy today would describe a capability the build doesn't yet have for a
real shopper. Resolve the production-credentials gap (`docs/A10-submission-readiness.md`) first,
or revise this copy to be honest about the current sandbox-only state if submitting sooner for
review purposes.
