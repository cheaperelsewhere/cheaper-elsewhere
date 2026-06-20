# Real-page sources

Saved verbatim via Playwright's `page.content()` after real Chrome fully loaded and rendered
each page (so client-side-inserted markup is captured, not just the initial server response).
Files are committed byte-for-byte as fetched - no editing, no trimming, no hand-authoring.

| File | Source URL | Fetched | Result |
|---|---|---|---|
| `amazon-airpods-honest.html` | `https://www.amazon.com/dp/B0BDHB9Y8H` | 2026-06-20 | 1 checkbox, unchecked, no associated label text |
| `amazon-laptop-honest.html` | `https://www.amazon.com/dp/B0CX23V2ZK` | 2026-06-20 | 1 checkbox, unchecked, no associated label text |
| `cribofart-honest.html` | `https://cribofart.com/en-gb/collections/all/products/2-bridges` | 2026-06-20 | 0 checkboxes at all |

All three are genuine honest-set pages: real retailer product pages, none with a pre-ticked
paid add-on. See `docs/anchor-live-test-results.md` for the full Unit 1 report, including the
~10 real sites tried while searching for a true-positive (pre-ticked paid add-on) page and why
none could be sourced in this environment.
