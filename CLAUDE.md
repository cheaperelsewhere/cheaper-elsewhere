# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 browser extension that helps Shopify shoppers find a genuinely cheaper price for the
product they're looking at, via the eBay Browse API — no account, no tracking. On a Shopify
product page it works out what the product is, looks it up against eBay, and surfaces a "cheaper
elsewhere" suggestion only when one honestly exists. Funded by eBay affiliate commission on that
suggestion.

**Pivot note:** an earlier build of this extension detected manipulative e-commerce dark patterns
client-side instead, funded by *decoupled* eBay "similar item" suggestions. That detector
subsystem (`extension/src/detectors/`, its tests, and the `docs/*-gate-results.md` files) was
deleted in Unit A12 — confirmed not used for launch, and it had already been fully unwired from
`manifest.json` since A9. Current work is the eBay-funded price-comparison feature, under
`extension/src/shopify/`, built as a numbered "A-series" (A1, A2, ...).

Project layout:
```
extension/   Manifest V3 extension: Shopify product extraction + live-page adapter
worker/      Cloudflare Worker proxy to the eBay Browse API (deployed at
             shopper-protection-ebay-worker.dwelluma.workers.dev and wired up since A4; runs against
             eBay's sandbox catalog, not production — no EBAY_CAMPAIGN_ID, no EPN enrollment)
scripts/     Dev-only verification tools that load the real unpacked extension in headless Chromium
docs/        Append-only audit reports for the Shopify price-comparison build (e.g. submission-
             readiness audits)
```

## Commands

```
npm test                         # unit tests: extension (jsdom, no browser) + worker (mocked fetch, no real eBay calls)
node --test extension/tests/gtin.test.js   # run a single test file
node --test --test-name-pattern="<regex>" extension/tests/*.test.js   # run tests by name
node --test worker/tests/*.test.js         # worker unit tests only

cd worker && npx wrangler dev     # run the worker locally (no deploy). Needs worker/.dev.vars
                                   #   (copy from .dev.vars.example) for real eBay calls to succeed;
                                   #   without it, every query still abstains/502s correctly.

node scripts/verify-live.js <url> # ad hoc (not in package.json): loads the extension against any
                                   #   live URL, dumps all console output — for diagnosing real sites
                                   #   not covered by fixtures
npm run verify:adapter            # Playwright: loads the extension against real, live Shopify
                                   #   product pages (not local fixtures — needs a real same-origin
                                   #   /products/{handle}.js endpoint and real page markup),
                                   #   confirms the live-page adapter produces a correct
                                   #   NormalizedProduct or abstains

node -c extension/src/shopify/page-adapter.js   # syntax-check a file (there is no bundler/build step)
```

There is no build step. Files are loaded as plain `<script>`s in manifest.json's declared order and
run as classic (non-module) scripts in the page's isolated content-script world.

## Architecture

### Dual-environment source files
Every file under `extension/src/` runs in two environments and must work in both:
- **In the browser**, as a global-scope script (no `require`/`module`) — functions and a namespace
  object (e.g. `SPEGtin`) attach to the shared global scope.
- **In Node**, via `require()` from `extension/tests/*.test.js`, using jsdom for DOM.

The bridging idiom appears at the top and bottom of every such file:
```js
var SPEGtin = typeof module !== 'undefined' ? require('./gtin') : SPEGtin;
...
if (typeof module !== 'undefined') module.exports = { ... };
```
Keep this idiom when adding files in `src/shopify/` — don't introduce ES modules or a bundler;
nothing in the project expects one.

### Shopify product normalization (`extension/src/shopify/`)
`extractProduct(productJson, pageContext)` (`extract-product.js`) normalizes a Shopify storefront
`/products/{handle}.js` payload into a stable shape (money in major units, GTIN-validated barcodes,
HTML-stripped description text). It is pure — no DOM, no network, no async. `page-adapter.js` is
the live-page adapter that fetches `pageContext` (currency, selected variant) from a real document
and calls this function — see the next subsection. Don't conflate the two when extending either:
`extract-product.js` stays pure, all I/O lives in `page-adapter.js`. `gtin.js`'s `isValidGtin`
implements the GS1 check-digit algorithm uniformly across GTIN-8/12/13/14 (right-to-left,
alternating 3-1 weights) — the same function handles all four lengths, there is no length-specific
branch.

### Live-page adapter (`extension/src/shopify/page-adapter.js`)
`getNormalizedProductFromPage()` gathers the inputs `extractProduct` needs from a real Shopify
product page and calls it, or abstains (`null`) when the page isn't a usable Shopify product page
or a required input can't be determined confidently — never a guessed/wrong result.
- **URL → handle + locale root**: matches `/products/{handle}` anywhere in the path, e.g.
  `/products/foo` (`localeRoot: ''`) or `/en-gb/products/foo` (`localeRoot: '/en-gb'`). The locale
  root can be **multi-segment** — confirmed on a real store, mejuri.com redirects to
  `/gb/en/products/...` — so don't assume exactly one path segment. A trailing segment after the
  handle (e.g. `/products/foo/reviews`) doesn't match; that's not a canonical product URL, so the
  caller abstains rather than guessing.
- **Selected variant**: `?variant=` query param matched against the fetched JSON's variant ids;
  falls back to the first `available: true` variant, else the first variant. Only `null` when
  there are zero variants at all.
- **Currency — the one deliberately incomplete piece**: not present in `/products/{handle}.js`.
  The canonical source, `window.Shopify.currency.active`, lives in the page's **main world**,
  unreachable from this isolated-world content script without a main-world bridge — out of scope
  for now (flag to planning if real-store testing shows the DOM sources below are missing too
  often). Currency is instead sourced from the DOM, in order: JSON-LD `offers.priceCurrency`, then
  `<meta property="og:price:currency">` / `<meta property="product:price:currency">`. If neither
  yields a value, **abstain** — a guessed currency would produce a misleading price comparison,
  which this feature must avoid. The JSON-LD lookup matches on **shape** (any node with an
  `offers.priceCurrency`), not on `@type === "Product"` — a real store (allbirds.com) was found
  serving its offers under `"@type": "ProductGroup"` instead, with no top-level `Product` node at
  all, so gating on the type name would have missed a real, valid case.
- **Shopify fingerprint gate**: before fetching anything, `isLikelyShopifyPage()` checks for
  `window.Shopify`, a `cdn.shopify.com` script/link reference, or a `shopify-digital-wallet` /
  `shopify-checkout-api-token` meta tag (all three confirmed present on real Shopify storefronts
  during this unit's live verification). This exists because the content script's `matches`
  pattern (`*://*/*products/*`) is necessarily broad — Shopify stores live on arbitrary custom
  domains and can't be enumerated — so this gate stops a guessed-URL fetch from firing against
  non-Shopify sites that merely have "products" in a path segment.
- Registered as its own `content_scripts` entry in `manifest.json` so it only runs on product-ish
  paths, with its own load order:
  `gtin.js` → `extract-product.js` → `page-adapter.js`. Currently logs its result to `console.log`
  only — no UI, no eBay call, no Cloudflare Worker; that's later A-series work.

### Verification tooling (`scripts/`) vs. unit tests (`extension/tests/`)
These check different things and are both needed:
- `extension/tests/*.test.js` (via `npm test`) — pure-logic unit tests against jsdom. Fast, no
  browser, no extension loading.
- `scripts/*.js` (via Playwright) — load the **actual unpacked extension** in real headless
  Chromium with `--load-extension`, exercising things jsdom can't: shadow-DOM CSS isolation against
  a hostile page stylesheet, the content-script isolated-world boundary (the adapter's output is
  read off a `console.log` argument handle, not `page.evaluate()`, since the main world can't reach
  isolated-world state directly), and real network/timing behavior against live stores.

`scripts/verify-adapter.js` hits the open network on purpose: the adapter's whole job is to fetch
from a real same-origin endpoint and read real page markup, so its checks run against live Shopify
stores (cribofart.com, allbirds.com), not local fixtures. Results can drift if a merchant changes
stock/handles — dev-only, not CI-gating.

**`verify:adapter`'s unhandled-rejection crash (flagged in A10, fixed in A12).** `checkPage()` in
`scripts/verify-adapter.js` used to create the adapter-result promise, `await page.goto()` (up to
30s), and only then chain `.catch()` onto the result promise. If the result promise's own 15s
timeout fired while still waiting on `page.goto()` — a slow real store, or one that redirects off
any `/products/` path so the content script never even injects — it rejected with no handler
attached yet, which Node treats as an unhandled rejection and kills the whole process. Fixed by
chaining `.catch()` on both the result promise and the goto promise synchronously, before either is
awaited, so a single slow/redirecting store now just fails that one check and the run continues.

**`scripts/verify-live.js` stays ad hoc, by design, not wired into `package.json` (decided in
A12).** It takes an arbitrary URL at invocation time and dumps everything for visual triage — that's
the point, it's the tool for a real-world page nothing else covers yet. Giving it real assertions
would mean hardcoding expected fields for specific URLs, which is just `verify-adapter.js`'s job
again; a generic assertion (e.g. "some console message appeared") wouldn't actually prove
correctness over `verify-adapter.js`'s existing per-field checks. Revisit only if a real-store bug
shows up repeatedly that `verify-adapter.js`'s fixed URL list doesn't catch.
