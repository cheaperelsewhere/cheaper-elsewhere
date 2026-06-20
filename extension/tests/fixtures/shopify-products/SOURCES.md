# Real Shopify product-JSON sources

Saved verbatim via `curl` against the live storefront `/products/{handle}.js` endpoint -
committed byte-for-byte as fetched, no editing, no trimming, no hand-authoring.

| File | Source URL | Fetched | Notes |
|---|---|---|---|
| `moonlight-serenity.json` | `https://cribofart.com/en-gb/products/moonlight-serenity.js` | 2026-06-20 | Genuine dropshipping product, 20 variants (Size x Frame Color), every variant `barcode` is `""` or `null` - no GTIN anywhere on this listing. Description HTML includes an unverified "Exclusive & Limited to 250 pieces" claim, kept verbatim as a reminder that extraction must pass description text through with no judgment about scarcity/exclusivity wording. |
