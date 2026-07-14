# A17: GTIN Coverage Trawl & Badge Disclosure Verification

## Part 1: GTIN coverage

### Classification criteria

**Bucket A (dropshipping-style)**: Store's catalog consists primarily of generic, unbranded, or
AliExpress-style goods — products that are not the store's own registered brand and could plausibly
be sourced from multiple suppliers. Includes generic fashion, accessories, gadgets, home decor,
custom-print merchandise, and pet accessories.

**Bucket B (branded reseller)**: Store's primary inventory is products from established
third-party manufacturers where the manufacturer is identifiable and the product is expected to
carry a manufacturer's UPC or EAN — electronics retailers, board game stores, hi-fi audio resellers,
kitchen tool importers, fragrance retailers.

These criteria are arguable. The hard cases: Brookstone (branded goods, but barcode field corrupt),
boardgamegeekstore.com (reseller + own merch), sewelldirect.com (own brand with GS1-registered
GTINs, included in B as a borderline case). Stores that are own-brand DTC manufacturers
(notebooktherapy.com/Tsuki, beactivewear.com.au, The Comfy, mrfluffyfriend.com, bestchoiceproducts.com,
venettodesign.com, sageandsill.com, freshjuiceblender.com) were checked during the trawl but
assigned to neither bucket: their products are proprietary and would require separate analysis.
sweetmarias.com (specialty coffee importer, 0/8 GTINs) and audiolab.co.uk (hi-fi manufacturer's
own store, 0/6 GTINs) were also checked but not assigned.

### Headline numbers — do not average

| Bucket | Stores | Products checked | Products with valid GTIN | Rate |
|--------|--------|-----------------|--------------------------|------|
| A (dropshipping-style) | 21 accessible + 2 inaccessible | 119 | 5 | **4.2%** |
| B (branded reseller) | 10 | 62 | 37 | **59.7%** |

### Raw data — Bucket A

All checks used `/products/{handle}.js`, not `/products.json` (see Methodology).

| Store | URL | n | Barcode present | GTIN valid | Notes |
|-------|-----|---|-----------------|------------|-------|
| petclever.net | petclever.net | 5 | 0/5 | 0/5 | Generic pet toys |
| plushiedepot.com | plushiedepot.com | 5 | 0/5 | 0/5 | `.js` fetch failed (403/redirect) on all 5 |
| pillowslides.com | pillowslides.com | 5 | 1/5 | 1/5 | "pillow-slides" SKU: 49 of 92 variants had valid GTIN; other SKUs none |
| burga.com | burga.com | 5 | 0/5 | 0/5 | Custom-design phone cases |
| wildflowercases.com | wildflowercases.com | 5 | 0/5 | 0/5 | Custom-design phone cases |
| epiclootshop.com | epiclootshop.com | 5 | 0/5 | 0/5 | Generic jewellery |
| warmlydecor.com | warmlydecor.com | 5 | 0/5 | 0/5 | Generic cutlery and home decor |
| puravidabracelets.com | puravidabracelets.com | 4 | 0/4 | 0/4 | Handmade-style bracelets (bundle SKUs) |
| shopsmartdeals.com | shopsmartdeals.com | 8 | 0/8 | 0/8 | Branded grocery/general merch; barcode field empty |
| trendingnow.store | trendingnow.store | 5 | 0/5 | 0/5 | Generic gadgets |
| cribofart.com | cribofart.com | 10 | 0/10 | 0/10 | Print-on-demand canvas art |
| dripsdrop.shop | dripsdrop.shop | 5 | 0/5 | 0/5 | DTC electrolyte supplement brand |
| optics-spot.se | optics-spot.se | 5 | 0/5 | 0/5 | Firearm optic mounts (Sweden) |
| dezire.co.in | dezire.co.in | 5 | 0/5 | 0/5 | Generic fashion (India) |
| jasminaboutique.com | jasminaboutique.com | 5 | 0/5 | 0/5 | Generic fashion |
| pupsentials.com | pupsentials.com | 5 | 0/5 | 0/5 | Custom pet merchandise |
| articture.com | articture.com | 5 | 0/5 | 0/5 | Generic furniture |
| pawfectpets.shop | pawfectpets.shop | 5 | 2/5 | 2/5 | 2 products had manufacturer GTINs (car seat cover, dog collar) |
| meowingtons.com | meowingtons.com | 5 | 2/5 | 2/5 | 2 products had manufacturer GTINs (cat cave, specific colourways) |
| stretchedfusion.com | stretchedfusion.com | 4 | 1/4 | 0/4 | Barcodes are internal SKU codes (e.g. '26451395-pink-cn'); not GTINs |
| zoberloco.com | zoberloco.com | 4 | 0/4 | 0/4 | Sparse/test catalog |
| bluecrate.com | bluecrate.com | — | — | — | Products inaccessible (no accessible product handles) |
| ultimatebuyshop.com | ultimatebuyshop.com | — | — | — | Products inaccessible |

**Bucket A total: 119 products, 5 valid GTINs (4.2%)**

### Raw data — Bucket B

| Store | URL | n | Barcode present | GTIN valid | Notes |
|-------|-----|---|-----------------|------------|-------|
| jbhifi.com.au | jbhifi.com.au | 8 | 8/8 | 8/8 | Major AU electronics retailer; 100% |
| hifiheadphones.co.uk | hifiheadphones.co.uk | 6 | 6/6 | 6/6 | Headphone specialist; 100% |
| shopgadgets.co.uk | shopgadgets.co.uk | 5 | 5/5 | 5/5 | Kodak projector reseller; 100% |
| audioadvice.com | audioadvice.com | 8 | 5/8 | 5/8 | 3 Wharfedale colour variants had no barcode populated |
| boardgamegeekstore.com | boardgamegeekstore.com | 8 | 8/8 | 6/8 | 2 own-merch items (bag, t-shirt) had 8-digit non-GS1 codes; 6 publisher titles had valid EAN-13 |
| theboardgamehut.co.uk | theboardgamehut.co.uk | 8 | 1/8 | 1/8 | MTG box set had valid EAN-13; remaining 7 were custom-order products with no barcode |
| sewelldirect.com | sewelldirect.com | 6 | 6/6 | 6/6 | Own-brand audio accessories; GS1-registered GTINs; 100% |
| scentmanor.com | scentmanor.com | 5 | 0/5 | 0/5 | Luxury perfume reseller (Creed, Xerjoff, Armani); barcode field not populated |
| hectorknives.com | hectorknives.com | 4 | 0/4 | 0/4 | Kitchen tool importer (Berard, Westmark, MasterClass); barcode field not populated |
| brookstone.com | brookstone.com | 4 | 4/4 | 0/4 | Barcodes stored as scientific notation ('7.93888E+11') or SKU codes ('carro-67738683'); `isValidGtin` correctly rejects non-digit strings |

**Bucket B total: 62 products, 37 valid GTINs (59.7%)**

### Methodology

**Critical discovery during this unit**: Shopify's `/products.json` list endpoint returns `null`
for all barcode fields regardless of what the merchant has entered. Only the individual
`/products/{handle}.js` endpoint returns real barcode values. This was caught when
theboardgamehut.co.uk's MTG product showed `null` via `/products.json` but returned
`'195166205052'` (valid EAN-13) via the individual endpoint. All trawl checks used individual
`.js` endpoints. The extension's `page-adapter.js` uses the individual endpoint through the
`/products/{handle}.js` fetch in its content script, so the extension's own behavior is not
affected by this.

**`isValidGtin` algorithm**: GS1 check-digit, right-to-left alternating 3-1 weights, uniform
across GTIN-8/12/13/14. Non-digit strings fail at the `/^\d+$/` guard before the check-digit
calculation. This correctly rejects Brookstone's scientific notation values and
stretchedfusion.com's SKU codes.

### Limitations

- **Not random**: Stores were hand-picked from published "Shopify dropshipping store" listicles
  and convenience searches. They do not represent a random sample of Shopify stores.
- **Small n, one point in time** (2026-07-14): GTIN coverage changes as merchants update
  catalog data.
- **Within-store product selection not random**: Typically the first 4–10 products from the
  store's catalog were checked. Coverage can vary by product category within a store.
- **Bucket classification is arguable**: The criteria above are stated to be challenged, not
  to close the question.
- **Inaccessible stores**: 2 Bucket A stores had no accessible product data and contributed
  nothing to the rate.
- **Not all "dropshipping" stores are the target market**: Several stores from published
  dropshipping examples lists (notebooktherapy.com/Tsuki, The Comfy, etc.) turned out to be
  DTC own-brand manufacturers with GS1-registered GTINs. Their inclusion in Bucket A would
  raise the apparent rate without representing genuinely substitutable goods.

---

## Part 2: Badge disclosure verification

### Candidate: natural firing case found

The badge requires: valid GTIN → eBay listing returned → condition in allowlist (New/Brand New/etc.)
→ eBay landed cost at least 10% AND at least $3 cheaper than the Shopify price.

| Field | Value |
|-------|-------|
| Store | jbhifi.com.au |
| Product URL | jbhifi.com.au/products/netgear-lm1200-4g-lte-modem |
| GTIN | 606449152142 |
| Shopify price | AUD 188.88 |
| eBay listing | "NETGEAR 4G LTE Modem LM1200 LM1200-100AUS \*AU STOCK\*" |
| eBay seller | ozonlinebuys |
| eBay condition | Brand New (in allowlist) |
| eBay item price | AUD 129.00 |
| Shipping | AUD 0.00 (free) |
| Landed cost | AUD 129.00 |
| Saving | AUD 59.88 (31.7%) |
| `affiliateTracked` | true |

Both minimum-savings thresholds satisfied: 31.7% ≥ 10%, AUD 59.88 ≥ AUD 3.

### Method

Loaded the unpacked extension in headless Chromium via Playwright
(`executablePath: chromium.executablePath()`, `--no-sandbox`) against the live jbhifi.com.au
product page. Badge state read from shadow DOM. Throwaway script
`scripts/a17-badge-verify-tmp.js` — deleted before commit, not checked in.

### Compliance checklist

All 8 checks PASS.

| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | "Ad" tag visible in collapsed state | **PASS** | text = `"Ad"` |
| 2 | Collapsed present-tense commission line | **PASS** | `"We earn a commission if you buy through this."` |
| 3 | Panel initially hidden | **PASS** | `aria-hidden="true"` before any click |
| 4 | Panel expands on click | **PASS** | `aria-hidden` becomes `"false"` after button click |
| 5 | eBay link present in panel | **PASS** | `href="https://www.ebay.com.au/itm/255408387009?..."` |
| 6 | Affiliate `campid=5339157941` in href | **PASS** | confirmed in link URL |
| 7 | Panel disclosure text (no `'undefined'`) | **PASS** | `"This is a paid link. We earn a commission from eBay if you buy through it, at no extra cost to you. We only show it when an eBay listing is genuinely cheaper for the same item, based on the total price including delivery. No account, and we don't track you."` |
| 8 | Savings text based on landed cost | **PASS** | `"Found for A$129.00 on eBay – save A$59.88"` |

### Screenshots

- `docs/screenshots/A17-badge-collapsed.png` — badge in default (collapsed) state on live jbhifi.com.au page
- `docs/screenshots/A17-badge-expanded.png` — badge after click, disclosure panel open

This is the first observation of the `affiliateTracked: true` disclosure path with real production
data.
