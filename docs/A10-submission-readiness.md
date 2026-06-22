# A10 — Submission-readiness audit (EPN + Chrome Web Store)

Audit only. No features added. Scope: establish ground truth about what exists in this repo right
now versus what eBay Partner Network (EPN) review and a Chrome Web Store listing each require, with
evidence for every claim. Where a claim depends on a third party's current policy text, it is marked
`OPEN` rather than stated from memory.

## Step 0 — Foundation check

- `git log --oneline -8` at the start of this unit: HEAD `8f31be1` ("Unit A9: single-purpose manifest
  alignment for an EPN/Chrome review build") — matches the expected tip. `git status`: clean.
- `npm test`: extension **213 tests / 204 pass / 9 fail**; worker **28/28 pass**. The 9 extension
  failures are the known `demand-counter` (5) / `confirmshaming-popup` (4) honest-fixture gate
  failures documented in `docs/conditional-signal-gate-results.md` — matches the expected baseline
  exactly (CLAUDE.md states the same 9/204/213 split).
- Baseline matched. Proceeded to Step 1.

## Step 1 — Inventory

### 1.1 Manifest reality

Full contents of `extension/manifest.json` at the start of this unit:

```json
{
  "manifest_version": 3,
  "name": "Shopper Protection",
  "version": "0.1.0",
  "description": "Checks the Shopify product page you're viewing against eBay listings and shows a badge when a genuinely cheaper price exists. No account, no tracking.",
  "host_permissions": ["https://shopper-protection-ebay-worker.dwelluma.workers.dev/*"],
  "content_scripts": [
    {
      "matches": ["*://*/*products/*", "*://*/products/*"],
      "js": [
        "src/shopify/gtin.js",
        "src/shopify/extract-product.js",
        "src/shopify/ebay-lookup.js",
        "src/shopify/match-confidence.js",
        "src/shopify/price-badge.js",
        "src/shopify/page-adapter.js"
      ],
      "run_at": "document_idle"
    }
  ]
}
```

- **A9's claims confirmed**: exactly one `content_scripts` entry (the detector entry is gone), and
  the description string is the price-comparison copy, verbatim as above.
- **No `permissions` array, no `icons` field, no `web_accessible_resources`.** Icons: confirmed
  absent both as a manifest field and as files — `find extension -iname "*icon*" -o -iname "*logo*"`
  returns nothing anywhere in the repo.
- **Redundant match pattern found and fixed** (see Step 4): `"*://*/products/*"` is a strict subset
  of `"*://*/*products/*"` (the leading `*` in the first pattern matches zero characters too, so it
  already covers the second). Removed the redundant entry; re-verified live against a real,
  non-locale-prefixed Shopify URL afterward (see Step 4) and re-ran `npm test` — no change.

### 1.2 Does the badge feature run end-to-end in an installed build?

Traced and **live-tested** the real path: content script (`page-adapter.js`) → `extractProduct` →
`ebay-lookup.js` → Cloudflare Worker → `match-confidence.js` → `price-badge.js`.

- **Deployed worker URL**: `https://shopper-protection-ebay-worker.dwelluma.workers.dev` — this is
  the literal value of `WORKER_URL` in `extension/src/shopify/ebay-lookup.js` and of
  `host_permissions` in the manifest. **Confirmed live**, not assumed: a direct `curl POST` against
  it during this unit returned a real JSON listings payload (HTTP 200).
- **The worker has only ever run against eBay sandbox, confirmed directly, not inferred.** The curl
  response's listing URLs were all `https://sandbox.ebay.com/itm/...` with image hosts on
  `i.ebayimg.sandbox.ebay.com`. `worker/wrangler.toml` sets
  `EBAY_API_BASE_URL = "https://api.sandbox.ebay.com"` under `[vars]` with a comment confirming this
  is deliberate ("Switch to https://api.ebay.com only once production credentials exist"). There is
  no evidence anywhere in the repo, wrangler config, or commit history of a production keyset ever
  being used.
- **`EBAY_CAMPAIGN_ID` is unset.** Confirmed in both `worker/.dev.vars.example` (blank) and the local,
  gitignored `worker/.dev.vars` (blank) — `worker/.dev.vars` was never committed (`git log --all
  --diff-filter=A -- worker/.dev.vars` returns nothing). The live curl response's listing URLs carry
  no affiliate/campaign tracking parameters, consistent with the deployed worker also having no
  campaign ID bound.
- **The full pipeline genuinely executes end-to-end against a real, live Shopify store** —
  re-verified live in this unit with `scripts/verify-live.js` against
  `https://cribofart.com/en-gb/products/moonlight-serenity`: console output showed, in order,
  `adapter normalized product` → `ebay-lookup result {listings: [], abstained: false}` →
  `match-confidence result null` (no cheaper match this time, so no badge — itself a correct
  abstain, not a bug). A second live run against
  `https://www.allbirds.com/products/...` (used to verify the manifest fix, see Step 4) also showed
  a clean `adapter normalized product` → `ebay-lookup result` → `match-confidence result null` chain.
  **The mechanism works.** What it returns is governed by eBay's *sandbox* test catalog, which is
  unrelated to the real product being viewed — so a real shopper would essentially never see a
  badge that reflects an actual cheaper real-world listing. This is the central finding of this
  audit: not "the feature doesn't run," but "the feature runs and is structurally incapable of
  producing a real result yet."
- **Stale documentation found and corrected** (Step 4): both `CLAUDE.md` and `README.md` stated the
  worker was "not deployed... not yet wired up to the extension," contradicted directly by the
  evidence above and by the A4 commit message itself ("Unit A4: wire page-adapter to the **deployed**
  eBay lookup Worker... Live-verified against a real allbirds.com page hitting the deployed worker
  end-to-end"). The worker has been deployed and wired up since A4 (five units ago); the docs were
  simply never updated. Fixed in both files.

### 1.3 Which verification harnesses are live vs. shelved — confirmed by running them, not just reading them

| Harness | Depends on | Ran it | Result |
|---|---|---|---|
| `npm run verify:extension` | `#shopper-protection-root` indicator badge, injected only by the removed detector content-script entry | Yes | `{"indicator": {"found": false}}` — confirmed broken, exactly as A9 documented. |
| `npm run verify:detectors` | Same removed detector content-script entry, via local fixtures | Yes | `Error: timed out waiting for settled detector output` — confirmed broken. |
| `npm run verify:adapter` | The still-registered Shopify content-script entry | Yes | **Crashed** with an unrelated bug: `waitForAdapterResult`'s internal 15s timeout can fire and reject before `page.goto()` (up to 30s) resolves and a `.catch` is attached, producing an unhandled promise rejection that kills the whole Node process on the very first slow-loading real site, rather than failing that one check and continuing. This is independent of A9 — it's a latent race condition in the harness itself. **Not fixed in this unit** (not a one-line, unambiguous change; fixing a promise race correctly needs its own verification pass) — flagged as a gap instead, per this unit's "when in doubt, report, don't fix" instruction. |
| `node scripts/verify-live.js <url>` (ad hoc, not in `package.json`) | Same registered entry, but dumps all console output with no assertions to time out on | Yes (twice) | **This is the only harness that currently exercises the real installed extension end-to-end without erroring.** Used it in this unit to produce the two live traces in 1.2 above. |

**Bottom line**: no harness in `package.json`'s `scripts` currently exercises the real installed
extension successfully. The one ad hoc script that does work (`verify-live.js`) is explicitly
"not shipped... not part of `npm test`" and was only used here as an audit tool, not as a
release-gating check.

### 1.4 Permissions audit

| Declared | Used by | Verdict |
|---|---|---|
| `host_permissions: ["https://shopper-protection-ebay-worker.dwelluma.workers.dev/*"]` | `ebay-lookup.js`'s `WORKER_URL`, fetched via `fetch(workerUrl, ...)` | Exact 1:1 match. Scoped, not `<all_urls>`. Keep. |
| `content_scripts[0].matches: ["*://*/*products/*", "*://*/products/*"]` | Drives when `page-adapter.js` et al. inject | Broad by necessity (Shopify merchants live on arbitrary custom domains; runtime-gated by `isLikelyShopifyPage()` before any fetch — re-confirmed live in A8 and again in this unit). **Redundant second entry removed in Step 4** (see 1.1). |
| No `permissions` array | — | `grep -rn "chrome\." extension/src` returns zero matches — no Chrome extension API used anywhere, so nothing is missing. Re-confirms A8's finding still holds. |
| No `web_accessible_resources` | — | Nothing in source references a `chrome-extension://` resource path; badge CSS is inline. No gap. |

No unused permissions, no used-but-undeclared permissions, beyond the one redundant match-pattern
string fixed in Step 4.

## Step 2 — Submission checklists

### A) eBay Partner Network (EPN) — "Software: Applications and Downloadable Tools" track

| Item | Exists? | Evidence | Gap |
|---|---|---|---|
| Working affiliate links in the review build | **No** | `EBAY_CAMPAIGN_ID` unset everywhere it's read (`.dev.vars`, `.dev.vars.example`); live worker response carries no campaign/tracking params (Step 1.2) | **Blocking.** If EPN review needs to see a build with functioning affiliate links, this build cannot demonstrate that — there is no campaign ID to attach. |
| Build demonstrates a genuine eBay integration at all | Partial | Pipeline runs end-to-end against a real deployed worker (Step 1.2) | Technically yes, but only against eBay's sandbox catalog — not real listings. Whether EPN review requires production-catalog results is unverified (see below). |
| "Production Browse access is gated behind EPN approval" | **OPEN — UNVERIFIED in this project.** | No file, comment, or commit in this repo establishes this claim either way. It may be true, or production keyset access and EPN affiliate-tracking enrollment may be two separate, independently obtainable grants. | `OPEN — verify against developer.ebay.com / partner.ebay.com at submission time.` Do not resolve by assertion. |
| EPN's current Application/Network Agreement requirements (refreshed Jan 2026 per prior planning notes) | Not checked here | Third-party policy text, drifts over time | `OPEN — verify against developer.ebay.com / partner.ebay.com at submission time.` |
| No impersonation of eBay | **Yes** | Disclosure strings (quoted verbatim in Step 3) say only "This extension links to eBay listings" — never claims partnership, endorsement, or being part of eBay. `grep` across all source and tests for impersonation-adjacent phrases ("affiliated with eBay", "part of eBay") returns nothing. | None found. |

### B) Chrome Web Store listing

| Item | Exists? | Evidence | Gap |
|---|---|---|---|
| Single-purpose story (manifest description + in-UI disclosure tell one honest story) | **Yes, consistent** | Manifest: *"Checks the Shopify product page you're viewing against eBay listings and shows a badge when a genuinely cheaper price exists. No account, no tracking."* Badge disclosure (always-visible "Ad" tag + collapsible panel text, quoted in Step 3) tells the same story. No mention of the parked detector anywhere in either. | None found in the build itself — listing copy (separate from manifest) doesn't exist yet, see below. |
| Icons | **No** | No `icons` field in manifest; no icon/logo files anywhere in the repo (`find` across the whole tree) | **Real pre-submission work.** Chrome Web Store requires a 128×128 store icon at minimum; the toolbar/extensions-page icon is also currently the Chrome default puzzle-piece. Not fixed here — requires actual asset creation, outside this audit's mandate. |
| Privacy policy page | **No** | `find -iname "*privacy*"` returns nothing in the repo | **Real pre-submission work.** The worker is network-facing (fetches keyword/GTIN to a third party), which is exactly the kind of data flow Chrome's listing flow asks a privacy policy to cover. |
| Listing copy / screenshots / promo assets | **No** | `find -iname "*listing*" -o -iname "*screenshot*" -o -iname "*promo*"` returns nothing | **Real pre-submission work.** |
| Data-handling disclosure — what would it have to say | See evidence | `worker/src/index.js`, `ebay-client.js`, `ebay-auth.js`, `ebay-query.js`, `ebay-response.js`: `grep -rn "console\."` across all of `worker/src` returns **zero matches** — the worker's own code logs nothing about the query. It transiently holds the shopper's search keyword/GTIN and currency (sent to eBay's Browse API to get listings) and the requesting IP (visible to Cloudflare's platform infrastructure, as with any Workers deployment — outside this codebase's control, not application-level logging). | A privacy policy would need to state: no accounts, no cookies, no persistent storage; the worker forwards product keyword/GTIN/currency to eBay's Browse API per-request and does not log or store it; standard platform-level (Cloudflare) request metadata applies as it would for any Workers deployment. This is a factual statement the repo supports — writing the actual policy page is still pre-submission work, not done here per this unit's scope (a copy/compliance judgement call). |
| Permissions | Carried from Step 1.4 | — | Minimal, scoped, fully justified; one redundant match-pattern string fixed in Step 4. No blocking permission issue. |
| $5 developer-fee / Developer Dashboard account | Not applicable to code | — | External gate, not a code item. Not checked here. |
| Affiliate-ads policy (enforced 10 Jun 2025) | Partially addressed | Manifest description doesn't mention "affiliate" or "commission" at all; badge discloses the eBay link and currently states no commission is earned (true at this build stage, see Step 3) | Whether the *Chrome listing description itself* (separate from the manifest, written at submission time in the Developer Dashboard) needs to disclose the affiliate relationship up front is a copy/compliance judgement call for the listing author at submission time, not resolved here. |

## Step 3 — The pre-EPN disclosure decision (surfaced, not resolved)

Quoted verbatim from `extension/src/shopify/price-badge.js`, current state, unedited in this unit:

```js
// Accurate for the current (sandbox, no EPN enrollment) build stage.
var AFFILIATE_DISCLOSURE_TEXT = 'This extension links to eBay listings. No affiliate commission is earned at this stage.';

// Parked (kept, not used) until eBay Partner Network production credentials exist
var AFFILIATE_DISCLOSURE_TEXT_FUTURE_EPN =
  'This extension earns a commission from eBay purchases made through this link, at no extra cost to you.';
```

`AFFILIATE_DISCLOSURE_TEXT` (the live string) is the one a reviewer's installed build would actually
display today, inside the badge's collapsible panel, alongside an always-visible "Ad" tag on the
collapsed button (added in A8 specifically so the affiliate-relationship marker is visible
*before* any click, not just after expanding the panel).

This is internally consistent with what the build actually does right now: `EBAY_CAMPAIGN_ID` is
unset, the worker's responses carry no affiliate tracking, so "No affiliate commission is earned at
this stage" is true today, not aspirational.

The tension this unit surfaces, not resolves: the settled house rule (from prior planning) is that
"may earn a commission" wording is itself misleading under ASA precedent where commission is
*always* earned once a campaign ID exists — so the parked `..._FUTURE_EPN` string is written as an
unconditional "earns," not a hedged "may earn." That string is correct for *after* EPN enrollment,
but showing it *before* enrollment (i.e., in a review build submitted today) would itself be a false
claim, since no commission is currently possible. The two strings are mutually exclusive truths for
two different build stages, and the current code already picks the truthful one for the current
stage. The options for what to do at actual EPN/Chrome submission time, stated factually:

1. **Keep the current honest pre-EPN copy** (`AFFILIATE_DISCLOSURE_TEXT`) in the submitted build.
   Trade-off: if EPN reviewers specifically expect to see a *working* affiliate flow to approve the
   integration, a build that visibly says "no commission is earned at this stage" may undercut that
   demonstration — this is exactly the open question flagged in Step 2A about whether EPN review
   requires demonstrated working tracking.
2. **Gate the badge dev-only until EPN enrollment completes**, submitting a build without the
   eBay-comparison feature visible/active for this review cycle. Trade-off: removes the disclosure
   tension entirely, but means the EPN application and the Chrome listing can't showcase the actual
   feature being built for.
3. **Other** (e.g., submit to Chrome with the honest pre-EPN copy now, and treat EPN enrollment as a
   separate, later step that swaps in `AFFILIATE_DISCLOSURE_TEXT_FUTURE_EPN` once true) — this is
   what the parked constant's existence already implies as the intended path, but is a planning
   decision, not a code conclusion.

No disclosure copy was edited in this unit. This is handed back for a planning decision.

## Step 4 — Honest small fixes made in this unit

All four fixes below are factual corrections or a proven-redundant manifest entry — no copy
judgement calls, no credentials, no new features, no harness revival.

1. **`extension/manifest.json`**: removed the redundant content-script match pattern
   `"*://*/products/*"` (a strict subset of the remaining `"*://*/*products/*"`, since that pattern's
   leading `*` already matches zero characters). Verified empirically before keeping the change: ran
   `npm test` before/after (213/204/9, 28/28 — unchanged), and ran `node scripts/verify-live.js` against
   a real, non-locale-prefixed Shopify product page (`allbirds.com/products/...`) with only the
   broader pattern present — content script still injected and the adapter still normalized the
   product correctly.
2. **`CLAUDE.md`**: corrected the worker project-layout line, which stated the worker was "not
   deployed or wired up to the extension yet" — false since A4 (confirmed deployed and live in Step
   1.2 of this audit).
3. **`README.md`**: corrected the same stale claim in two places — the A3/A4+ status checklist
   (A4 through A9 were already done but left unchecked) and the project-layout line — to match the
   verified state (deployed, wired up, sandbox-only).
4. **`package.json`** (root): corrected the npm package `description` field, which still read
   "Browser extension that detects manipulative e-commerce tactics client-side" — the pre-pivot
   framing, contradicting the manifest's actual current single-purpose description.

Nothing else met the bar for an in-unit fix. The `verify:adapter` race-condition bug (Step 1.3) and
all Chrome listing assets (icons, privacy policy, listing copy) are reported as gaps, not fixed.

## Blocking vs. non-blocking gaps — summary

### (i) Structural blockers a polish pass cannot fix
- **No production eBay credentials, no EPN enrollment, no campaign ID.** The deployed worker only
  ever talks to eBay's sandbox catalog. Confirmed by direct live test, not inferred.
- **The price-comparison feature cannot show a real shopper a real cheaper price right now** — the
  pipeline runs end-to-end correctly, but against fixture/test inventory unrelated to the real
  product on the page. This is a functional blocker, not a cosmetic one: submitting today means
  submitting a build that cannot do the thing it claims to do for a real user.
- **No npm-scripted harness currently exercises the real installed extension successfully**
  (`verify:extension` / `verify:detectors` shelved by design since A9; `verify:adapter` crashes on a
  pre-existing race condition, confirmed by running it in this unit). The only thing that currently
  proves the live pipeline works is the ad hoc, unshipped `verify-live.js`, used manually in this
  audit.

### (ii) Genuine pre-submission work that exists to do (not blocked on credentials)
- Store icon(s) — entirely absent, manifest and filesystem both confirm.
- Privacy policy page — entirely absent.
- Chrome listing copy, screenshots, promo assets — entirely absent.
- A planning decision on the pre-EPN disclosure question (Step 3) — three factual options laid out,
  none chosen here.
- Optionally, fixing the `verify:adapter` race condition so there's at least one CI-style harness
  that can exercise the real build without a person watching console output by hand.

### (iii) OPEN — third-party facts to verify at submission time, not resolved here
- Whether EPN review requires a build with demonstrably working affiliate tracking.
- Whether production Browse API access and EPN affiliate-tracking enrollment are the same grant or
  two separate ones.
- The current text of eBay's Network Agreement (refreshed Jan 2026 per prior planning notes) and EPN
  "Software: Applications and Downloadable Tools" track requirements.
- Whether Chrome's affiliate-ads policy (enforced 10 Jun 2025) requires the *listing description*
  itself (not just in-UI disclosure) to state the affiliate relationship up front.

**Direct answer to "can I send either application right now?": No.** Not for cosmetic reasons — the
mechanism runs correctly end-to-end — but because there is no production eBay/EPN credential path yet,
which means neither submission can currently demonstrate (or even produce) a real, working
affiliate-funded price comparison for a real user. Icons, a privacy policy, and listing copy are real
but separate work that doesn't require waiting on EPN. The disclosure-copy question in Step 3 is a
planning decision, not an engineering blocker, and should be made before either submission goes out.
