# Privacy Policy — Shopper Protection

**Last updated:** 2026-06-23

Shopper Protection is a browser extension that helps you find a genuinely cheaper price for the
product you're looking at on a Shopify store, by checking it against eBay listings. This policy
explains what data the extension processes and what it doesn't.

## No accounts, no tracking

Shopper Protection has no user accounts, sets no cookies of its own, and stores nothing
persistently on your device. It does not track you across sites or build a profile of your
browsing.

## What it processes, and when

The extension only activates on pages that look like a Shopify product page (a URL containing
`/products/{handle}`, on a site that fingerprints as Shopify — confirmed by signals such as a
`window.Shopify` object or a `cdn.shopify.com` reference). On any other page, it does nothing.

When it activates, it reads the current product's:
- title
- barcode/GTIN, if the product has a valid one
- currency and selected variant, read from the page

It sends only the **product title, GTIN, and currency** — never the page URL, never any personal
or account information — to our Cloudflare Worker
(`shopper-protection-ebay-worker.dwelluma.workers.dev`), which forwards that query to eBay's
Browse API to search for matching listings. The response (candidate eBay listings and prices)
is used to decide whether to show you a "cheaper elsewhere" badge. If no listing is genuinely
cheaper once shipping is included, nothing is shown.

## What we don't do with that data

The Worker does not log, store, or retain the query or the response anywhere. There is no
database, no analytics pipeline, and no application-level logging in the Worker's code. Each
request is handled and then forgotten.

The one thing outside our control: Cloudflare, as the platform hosting the Worker, may retain
standard infrastructure-level request metadata (e.g. IP address, timestamp) as it would for any
website or API hosted on its network. That's a property of Cloudflare's platform, not something
this extension's code adds, configures, or has access to.

## eBay affiliate links

Listings shown may link to eBay through an affiliate program. Where a listing's link is
affiliate-tracked, the badge discloses that and states that we may earn a commission from a
resulting purchase, at no extra cost to you. Where a listing's link is not affiliate-tracked, the
badge says so explicitly. Either way, whether a listing is shown is never influenced by whether it
happens to be affiliate-tracked — the same "genuinely cheaper" criteria apply regardless.

## Permissions

The extension requests host access only to its own Cloudflare Worker, to send the lookup
described above. It does not request access to your browsing history, bookmarks, other tabs, or
any other site data.

## Changes to this policy

If what the extension processes or how it's handled changes, this page will be updated and the
"Last updated" date above will change accordingly.

## Contact

Questions about this policy: **[contact email — fill in before publishing]**
