# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 browser extension that helps Shopify shoppers find a genuinely cheaper price for the
product they're looking at, via the eBay Browse API — no account, no tracking. On a Shopify
product page it works out what the product is, looks it up against eBay, and surfaces a "cheaper
elsewhere" suggestion only when one honestly exists. Funded by eBay affiliate commission on that
suggestion.

**Pivot note:** an earlier build of this extension detected manipulative e-commerce dark patterns
client-side instead, funded by *decoupled* eBay "similar item" suggestions (the suggestion never
depended on, or was influenced by, what the detector found). That detector code is **parked, not
deleted** — `extension/src/detectors/`, its tests, and the `docs/*-gate-results.md` files
described below are all still in the repo and still pass, but are not being extended. Do not
modify/wire/extend anything under `extension/src/detectors/` unless explicitly asked. Current work
is the eBay-funded price-comparison feature instead, under `extension/src/shopify/`, built as a
numbered "A-series" (A1, A2, ...).

Project layout:
```
extension/   Manifest V3 extension: Shopify product extraction + live-page adapter (current focus),
             plus the parked dark-pattern detectors
worker/      Cloudflare Worker proxy to the eBay Browse API (lookup built; not deployed or wired up
             to the extension yet — A-series)
scripts/     Dev-only verification tools that load the real unpacked extension in headless Chromium
docs/        Append-only gate/audit reports for the (parked) detector-signal build (see "Gate
             before you build") — the newer A-series Shopify work doesn't use this convention
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

npm run verify:extension          # Playwright: loads the real unpacked extension, checks indicator
                                   #   state transitions + shadow-DOM CSS isolation. Usage: [url] [profileDir]
npm run verify:detectors          # Playwright: loads the extension against fixture pages in
                                   #   extension/tests/fixtures/, confirms every detector fires/stays
                                   #   silent where expected (no false pos/neg)
node scripts/verify-live.js <url> # ad hoc (not in package.json): loads the extension against any
                                   #   live URL, dumps all console output — for diagnosing real sites
                                   #   not covered by fixtures
npm run verify:adapter            # Playwright: loads the extension against real, live Shopify
                                   #   product pages (not local fixtures — needs a real same-origin
                                   #   /products/{handle}.js endpoint and real page markup),
                                   #   confirms the live-page adapter produces a correct
                                   #   NormalizedProduct or abstains

node -c extension/src/content/content-script.js   # syntax-check a file (there is no bundler/build step)
```

There is no build step. Files are loaded as plain `<script>`s in manifest.json's declared order and
run as classic (non-module) scripts in the page's isolated content-script world.

## Architecture

### Dual-environment source files
Every file under `extension/src/` runs in two environments and must work in both:
- **In the browser**, as a global-scope script (no `require`/`module`) — functions and a namespace
  object (e.g. `SPEUtils`, `SPEGtin`) attach to the shared global scope.
- **In Node**, via `require()` from `extension/tests/*.test.js`, using jsdom for DOM.

The bridging idiom appears at the top and bottom of every such file:
```js
var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;
...
if (typeof module !== 'undefined') module.exports = { ... };
```
Keep this idiom when adding files in `src/detectors/` or `src/shopify/` — don't introduce ES modules
or a bundler; nothing in the project expects one.

The next two subsections (**Detection pipeline**, **Gate before you build**) describe the
**parked** dark-pattern detector subsystem — accurate to the code as it stands, kept for
reference, not being extended. Current work is under **Shopify product normalization** /
**Live-page adapter** further below.

### Detection pipeline (`extension/src/content/content-script.js` → `detectors/index.js`)
Detection runs **twice**: once at `document_idle`, then again after a fixed `SETTLE_PASS_DELAY_MS`
(2000ms), because the first pass can lose a race against client-side hydration on SPA-heavy
storefronts. `mergeDetectorResults()` unions the two passes per detector (a signal that fired in
either pass stays fired). The indicator badge stays in `"checking"` until the settle pass resolves —
never show a verdict that might change under the user.

Each detector is a pure function `(root) => { id, label, detected, evidence: string[] }`, registered
in `DETECTOR_FNS` in `extension/src/detectors/index.js`. `runDetectors()` wraps every call in
try/catch so one crashing detector never takes down the others (a crash becomes
`{ detected: false, evidence: [], error: ... }`). Adding a new detector means updating **three**
places in lockstep: `index.js`'s `DETECTOR_FNS`, `manifest.json`'s `content_scripts[0].js` array
(load order matters — `utils.js` must load before any detector, and `index.js` must load after all
of them), and `extension/tests/detectors.test.js`'s vm-sandbox global list (it loads `index.js`
through a `vm` context standing in for the browser globals, so it needs every detector name added
there too, or the sandbox throws a `ReferenceError` before any test runs).

### Shared DOM helpers (`extension/src/detectors/utils.js`)
- **Never read `el.id` / `el.className` directly** on scanned page DOM. A real page can have a form
  control named `id` that clobbers `form.id` (DOM clobbering), and `SVGElement.className` returns an
  `SVGAnimatedString`, not a string. Always go through `speAttr(el, 'id')` /
  `speAttr(el, 'class')`, which reads the attribute directly.
- `speLabelTextFor(input)` resolves an input's label with a fixed precedence: `<label for>` →
  wrapping `<label>` → `aria-labelledby` (space-separated ids, concatenated) → `aria-label` →
  parent-element text fallback. Reuse it for any new checkbox/input-based detector rather than
  re-deriving label text.

### Gate before you build (signal-development workflow)
New detector signals are not written straight into `src/detectors/`. The established workflow,
visible across `docs/*-gate-results.md` and the corresponding `extension/tests/*-gate.test.js`
files, is:
1. Write the candidate detection logic as a standalone "claim function" that lives only in a test
   file (e.g. `extension/tests/new-signal-gate.test.js`), not in `src/`.
2. Gate it against hand-authored fixtures split into honest pages (must NOT fire) and
   true-positive pages (must fire). Both directions matter — a signal with no false-positive
   coverage isn't gated, it's untested.
3. Only promote to `src/detectors/` once the gate passes, porting the pattern **byte-identical** —
   do not loosen or "improve" the regex/logic during the port. A re-gate test
   (`v1-detector-re-gate.test.js`) re-runs the same fixtures against the built detector to prove no
   drift happened during the port.
4. Record the result in a new `docs/*.md` file, including failures and known limitations stated
   plainly (e.g. `docs/conditional-signal-gate-results.md` documents that `demand-counter` and
   `confirmshaming-popup` both fail their honest-fixture gate and were kept anyway, pending a
   planning decision — not silently patched or hidden).
5. Where real fixture pages exist (`extension/tests/fixtures/real-pages/`,
   `extension/tests/fixtures/shopify-products/`), they're saved byte-for-byte from a real
   browser/`curl` fetch (see the `SOURCES.md` in each directory) — never hand-edited, so they stay
   honest evidence of real-world structure.

`npm test` currently reports **9 known, pre-existing failures**, all in
`demand-counter`/`confirmshaming-popup` honest-fixture gates (see
`docs/conditional-signal-gate-results.md`). These are documented false positives carried forward by
design, not regressions — don't "fix" them by loosening assertions; a real fix means tightening the
detector pattern itself and re-running the full gate.

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
- Registered as its own `content_scripts` entry in `manifest.json` (not folded into the detector
  entry) so it only runs on product-ish paths, with its own load order:
  `gtin.js` → `extract-product.js` → `page-adapter.js`. Currently logs its result to `console.log`
  only — no UI, no eBay call, no Cloudflare Worker; that's later A-series work.

### Verification tooling (`scripts/`) vs. unit tests (`extension/tests/`)
These check different things and are both needed:
- `extension/tests/*.test.js` (via `npm test`) — pure-logic unit tests against jsdom. Fast, no
  browser, no extension loading.
- `scripts/*.js` (via Playwright) — load the **actual unpacked extension** in real headless
  Chromium with `--load-extension`, exercising things jsdom can't: shadow-DOM CSS isolation against
  a hostile page stylesheet, the content-script isolated-world boundary (detector output is read
  off `console.debug` argument handles, not `page.evaluate()`, since the main world can't reach
  isolated-world state directly), and real timing of the two-pass settle model.

`scripts/verify-adapter.js` is the one exception that hits the open network on purpose: the
adapter's whole job is to fetch from a real same-origin endpoint and read real page markup, so its
checks run against live Shopify stores (cribofart.com, allbirds.com), not local fixtures. Results
can drift if a merchant changes stock/handles — dev-only, not CI-gating. It also reads its result
off `console.log` (not `console.debug`, which the detector pipeline uses), since the adapter logs
through a different code path.
