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
- [x] A3 - eBay Browse API lookup via a Cloudflare Worker (`worker/`): takes a minimal
      `{ gtin, title, currency }` query, builds an eBay Browse API search (GTIN exact-match
      preferred over keyword search), authenticates via OAuth2 client-credentials, and returns
      normalized candidate listings or abstains. Local-only so far (`wrangler dev`) - not deployed,
      and unexercised against the real eBay API since there's no eBay developer account/credentials
      yet. Not yet wired up to the extension.
- [ ] A4+ - match-confidence logic, suggestion UI + affiliate disclosure (gated on a deliberate user
      action, not just page load), wiring the extension to call the Worker

## Detector build (parked)

Steps 1-2 of an earlier 5-step plan are complete and still pass their tests, but are not being
extended:

- [x] Step 1 - extension skeleton (loads, injects an indicator shell, no detection logic)
- [x] Step 2 - detection core (6 DOM signals, pure functions, unit + real-browser tested)
- [ ] Step 3 - three-state UI + expandable report
- [ ] Step 4 - Cloudflare Worker against eBay sandbox
- [ ] Step 5 - suggestion UI wired to the Worker + disclosure

As of A9, the detector content script is no longer registered in `manifest.json` (the shipped
extension presents a single, truthful purpose: price comparison). The detector source under
`extension/src/detectors/` is untouched and still unit-tested, but `npm run verify:detectors`
(which loads the real unpacked extension and depends on that registration) no longer exercises
anything - see **Dev commands** below.

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
worker/      Cloudflare Worker proxy to the eBay Browse API (lookup built, not deployed/wired up yet)
scripts/     Dev-only verification tools (load the real extension in headless Chromium)
```

## Dev commands

```
npm test                  # unit tests for pure logic (extractProduct, page-adapter helpers, parked detectors, etc.)
npm run verify:extension  # SHELVED since A9, same reason as verify:detectors below: the indicator
                          #   badge it checks (parked detector UI) is injected only by the
                          #   now-unregistered detector content script.
npm run verify:detectors  # SHELVED since A9: the detector content script it depends on is no
                          #   longer registered in manifest.json, so this no longer injects
                          #   anything. Re-registering that content_scripts entry would be needed
                          #   to run it again.
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
