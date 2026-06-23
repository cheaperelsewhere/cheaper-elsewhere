# Cheaper Elsewhere

Browser extension that helps shoppers on Shopify product pages find a genuinely cheaper price for
what they're looking at, via the eBay Browse API - no account, no tracking. On a product page, it
works out what the product is, looks it up against eBay, and shows a "cheaper elsewhere"
suggestion only when one honestly exists. Funded by eBay affiliate commission on that suggestion.

An earlier build of this extension instead detected manipulative e-commerce dark patterns
client-side, funded by *decoupled* eBay "similar item" suggestions (the suggestion never depended
on what the detector found). That subsystem was deleted in Unit A12, confirmed not used for launch.

## Status - price comparison (current focus)

Build is numbered "A1, A2, ..." (A-series). Units complete so far:

- [x] A1 - `extractProduct(productJson, pageContext) -> NormalizedProduct` + `isValidGtin`
      (GS1 check-digit, GTIN-8/12/13/14) in `extension/src/shopify/`. Pure, no DOM/network/async.
- [x] A2 - live-page adapter (`extension/src/shopify/page-adapter.js`): gathers real-page inputs
      (URL, fetched product JSON, DOM-sourced currency), calls `extractProduct`, or abstains when
      it can't determine something confidently. Logs the result to console for now - no UI yet.
- [x] A3 - eBay Browse API lookup via a Cloudflare Worker (`worker/`): takes a minimal
      `{ gtin, title, currency }` query, builds an eBay Browse API search (GTIN exact-match
      preferred over keyword search), authenticates via OAuth2 client-credentials, and returns
      normalized candidate listings or abstains.
- [x] A4 - wired `page-adapter.js` to the deployed Worker
      (`shopper-protection-ebay-worker.dwelluma.workers.dev`, declared in `host_permissions`).
- [x] A5 - match-confidence decision logic (compares landed cost, decides when a result counts as
      genuinely cheaper).
- [x] A6 - "cheaper elsewhere" suggestion badge UI (`price-badge.js`), shadow-DOM isolated.
- [x] A7 - badge compares landed cost (item + shipping), not item price alone.
- [x] A8 - EPN-review readiness pass: always-visible "Ad" tag on the collapsed badge, widened
      live-store verification matrix, permission audit (no manifest changes needed).
- [x] A9 - single-purpose manifest alignment: rewrote the manifest description, removed the
      detector content-script registration so the shipped extension has one truthful purpose.

The Worker is deployed and live, but configured against eBay's **sandbox** catalog
(`EBAY_API_BASE_URL = https://api.sandbox.ebay.com`), not production, and `EBAY_CAMPAIGN_ID` is
unset - so any listing shown links with no real affiliate tracking and matches come from eBay's test
inventory, not real-world listings, pending eBay Partner Network approval and production API access.

## Load the extension (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` directory.
4. Visit any Shopify product page (a `/products/{handle}` URL) and check the console for
   `[Shopper Protection] adapter normalized product` or `... adapter abstained`.

## Project layout

```
extension/   Manifest V3 browser extension: Shopify product extraction + live-page adapter
worker/      Cloudflare Worker proxy to the eBay Browse API (deployed, wired up to the extension,
             running against eBay sandbox - not production)
scripts/     Dev-only verification tools (load the real extension in headless Chromium)
```

## Dev commands

```
npm test                  # unit tests for pure logic (extractProduct, page-adapter helpers, etc.)
npm run verify:adapter    # loads the real extension against live Shopify stores, checks the price-comparison adapter
```

## Worker (eBay lookup)

```
cd worker && npm run dev   # wrangler dev, local-only - no deploy
```

Local dev needs eBay sandbox credentials in `worker/.dev.vars` (gitignored; copy
`worker/.dev.vars.example` and fill in `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` from a sandbox app at
developer.ebay.com). Without them, the worker still runs and abstains/502s correctly - see
`worker/tests/`, which cover all of the worker's logic against mocked eBay responses without needing
real credentials at all.
