# Shopper Protection

Browser extension that helps shoppers on Shopify product pages find a genuinely cheaper price for
what they're looking at, via the eBay Browse API - no account, no tracking. On a product page, it
works out what the product is, looks it up against eBay, and shows a "cheaper elsewhere"
suggestion only when one honestly exists. Funded by eBay affiliate commission on that suggestion.

An earlier build of this extension instead detected manipulative e-commerce dark patterns
client-side, funded by *decoupled* eBay "similar item" suggestions (the suggestion never depended
on what the detector found). That work is parked, not deleted - see **Detector build (parked)**
below.

## Status - price comparison (current focus)

Build is numbered "A1, A2, ..." (A-series). Units complete so far:

- [x] A1 - `extractProduct(productJson, pageContext) -> NormalizedProduct` + `isValidGtin`
      (GS1 check-digit, GTIN-8/12/13/14) in `extension/src/shopify/`. Pure, no DOM/network/async.
- [x] A2 - live-page adapter (`extension/src/shopify/page-adapter.js`): gathers real-page inputs
      (URL, fetched product JSON, DOM-sourced currency), calls `extractProduct`, or abstains when
      it can't determine something confidently. Logs the result to console for now - no UI yet.
- [ ] A3+ - eBay Browse API lookup via a Cloudflare Worker, match-confidence logic, suggestion UI
      + affiliate disclosure (gated on a deliberate user action, not just page load)

## Detector build (parked)

Steps 1-2 of an earlier 5-step plan are complete and still pass their tests, but are not being
extended:

- [x] Step 1 - extension skeleton (loads, injects an indicator shell, no detection logic)
- [x] Step 2 - detection core (6 DOM signals, pure functions, unit + real-browser tested)
- [ ] Step 3 - three-state UI + expandable report
- [ ] Step 4 - Cloudflare Worker against eBay sandbox
- [ ] Step 5 - suggestion UI wired to the Worker + disclosure

## Load the extension (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` directory.
4. Visit any Shopify product page (a `/products/{handle}` URL) and check the console for
   `[Shopper Protection] adapter normalized product` or `... adapter abstained`.

## Project layout

```
extension/   Manifest V3 browser extension: Shopify product extraction + live-page adapter
             (current focus), plus the parked dark-pattern detectors
worker/      Cloudflare Worker proxy to the eBay Browse API (not built yet)
scripts/     Dev-only verification tools (load the real extension in headless Chromium)
```

## Dev commands

```
npm test                  # unit tests for pure logic (extractProduct, page-adapter helpers, parked detectors, etc.)
npm run verify:extension  # loads the real extension, checks indicator + shadow-DOM isolation (parked detector UI)
npm run verify:detectors  # loads the real extension against fixture pages, checks all 6 parked signals fire correctly
npm run verify:adapter    # loads the real extension against live Shopify stores, checks the price-comparison adapter
```
