# Shopper Protection

Browser extension that detects manipulative e-commerce tactics (dark patterns) purely
client-side, and shows a neutral, fact-based report. Funded solely by eBay affiliate
commission on optional "similar item" suggestions, which are decoupled from the
detection verdict.

## Status

Build in progress. Steps complete so far:

- [x] Step 1 - extension skeleton (loads, injects an indicator shell, no detection logic)
- [x] Step 2 - detection core (6 DOM signals, pure functions, unit + real-browser tested)
- [ ] Step 3 - three-state UI + expandable report
- [ ] Step 4 - Cloudflare Worker against eBay sandbox
- [ ] Step 5 - suggestion UI wired to the Worker + disclosure

## Load the extension (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` directory.
4. Visit any `http(s)://` page - a small grey dot appears bottom-right, confirming the
   content script injected. It has no behavior yet beyond that.

## Project layout

```
extension/   Manifest V3 browser extension (content script, detection, UI)
worker/      Cloudflare Worker proxy to the eBay Browse API (added in step 4)
scripts/     Dev-only verification tools (load the real extension in headless Chromium)
```

## Dev commands

```
npm test               # unit tests for pure logic (detectors, etc.) via node:test + jsdom
npm run verify:extension   # loads the real extension, checks indicator + shadow-DOM isolation
npm run verify:detectors   # loads the real extension against fixture pages, checks all 6 signals fire correctly
```
