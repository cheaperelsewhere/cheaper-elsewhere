# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 browser extension that detects manipulative e-commerce dark patterns purely
client-side and shows a neutral, fact-based indicator — no account, no tracking. It is funded by
eBay affiliate commission on optional "similar item" suggestions that are decoupled from the
detection verdict (the suggestion never depends on, or is influenced by, what the detector found).

Project layout:
```
extension/   Manifest V3 extension: content script, detectors, Shopify product normalization
worker/      Cloudflare Worker proxy to the eBay Browse API — not built yet (planned, see README Step 4)
scripts/     Dev-only verification tools that load the real unpacked extension in headless Chromium
docs/        Append-only gate/audit reports for each detector-signal build (see "Gate before you build")
```

## Commands

```
npm test                         # unit tests: node --test extension/tests/*.test.js (jsdom, no browser)
node --test extension/tests/gtin.test.js   # run a single test file
node --test --test-name-pattern="<regex>" extension/tests/*.test.js   # run tests by name

npm run verify:extension          # Playwright: loads the real unpacked extension, checks indicator
                                   #   state transitions + shadow-DOM CSS isolation. Usage: [url] [profileDir]
npm run verify:detectors          # Playwright: loads the extension against fixture pages in
                                   #   extension/tests/fixtures/, confirms every detector fires/stays
                                   #   silent where expected (no false pos/neg)
node scripts/verify-live.js <url> # ad hoc (not in package.json): loads the extension against any
                                   #   live URL, dumps all console output — for diagnosing real sites
                                   #   not covered by fixtures

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
HTML-stripped description text). It is pure — no DOM, no network, no async. The live-page adapter
that fetches `pageContext` (currency, selected variant) from a real document is a separate, later
unit; don't conflate the two when extending this file. `gtin.js`'s `isValidGtin` implements the GS1
check-digit algorithm uniformly across GTIN-8/12/13/14 (right-to-left, alternating 3-1 weights) — the
same function handles all four lengths, there is no length-specific branch.

### Verification tooling (`scripts/`) vs. unit tests (`extension/tests/`)
These check different things and are both needed:
- `extension/tests/*.test.js` (via `npm test`) — pure-logic unit tests against jsdom. Fast, no
  browser, no extension loading.
- `scripts/*.js` (via Playwright) — load the **actual unpacked extension** in real headless
  Chromium with `--load-extension`, exercising things jsdom can't: shadow-DOM CSS isolation against
  a hostile page stylesheet, the content-script isolated-world boundary (detector output is read
  off `console.debug` argument handles, not `page.evaluate()`, since the main world can't reach
  isolated-world state directly), and real timing of the two-pass settle model.
