// Dev-only tool: loads the real unpacked extension against live, real Shopify
// product pages (not local fixtures - page-adapter.js needs a real same-origin
// /products/{handle}.js endpoint and real DOM-sourced currency markup) and
// confirms getNormalizedProductFromPage() produces a correct NormalizedProduct,
// or a justified abstain. Not shipped, not part of `npm test` - hits the open
// network, so results can drift if a merchant changes stock/handles.
//
// Usage: node scripts/verify-adapter.js

const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const EXT_PATH = path.resolve(__dirname, '..', 'extension');
const PROFILE_DIR = path.join(os.tmpdir(), 'spe-verify-adapter-profile');

// page-adapter.js logs '[Shopper Protection] adapter normalized product' (with
// a structured arg) or '[Shopper Protection] adapter abstained' on load - mirror
// of how verify-detectors.js reads detector output straight off a console
// message's live remote-object handle, since the isolated content-script
// world isn't reachable via page.evaluate().
function waitForAdapterResult(page, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off('console', handler);
      reject(new Error('timed out waiting for adapter console output'));
    }, timeoutMs);

    const handler = async (msg) => {
      const text = msg.text();
      if (text.indexOf('[Shopper Protection] adapter') !== 0) return;
      page.off('console', handler);
      clearTimeout(timer);
      if (text.indexOf('abstained') !== -1) {
        resolve({ abstained: true, text: text });
        return;
      }
      const args = msg.args();
      const product = args.length > 1 ? await args[1].jsonValue() : null;
      resolve({ abstained: false, product: product });
    };
    page.on('console', handler);
  });
}

async function checkPage(context, label, url) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  const resultPromise = waitForAdapterResult(page, 15000);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  const result = await resultPromise.catch((err) => ({ error: String(err) }));
  await page.close();
  return { label: label, url: url, result: result, pageErrors: pageErrors };
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    executablePath: chromium.executablePath(),
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox'],
  });

  const checks = [
    {
      label: 'cribofart.com (locale-prefixed /en-gb/, no ?variant=)',
      url: 'https://cribofart.com/en-gb/products/moonlight-serenity',
      assert: function (product) {
        return (
          !!product &&
          product.currency === 'GBP' &&
          product.vendor === 'Crib of Art' &&
          product.selectedVariant !== null
        );
      },
    },
    {
      label: 'cribofart.com (explicit ?variant= for the WHITE/S variant)',
      url: 'https://cribofart.com/en-gb/products/moonlight-serenity?variant=49262227784020',
      assert: function (product) {
        return (
          !!product &&
          !!product.selectedVariant &&
          product.selectedVariant.id === 49262227784020 &&
          product.selectedVariant.optionValues.Size === 'S' &&
          product.selectedVariant.optionValues['Frame Color'] === 'WHITE'
        );
      },
    },
    {
      label: 'allbirds.com (no locale prefix)',
      url: 'https://www.allbirds.com/products/womens-tree-dasher-relay-natural-black-twilight-teal',
      assert: function (product) {
        return !!product && product.currency === 'USD' && product.vendor === 'Allbirds';
      },
    },
    {
      label: 'example.com/products/foo (non-Shopify page matched by the broad pattern - must abstain cleanly, no fetch)',
      url: 'https://example.com/products/foo',
      assert: function (product, abstained) {
        return abstained === true;
      },
    },
  ];

  let allOk = true;
  for (const check of checks) {
    const outcome = await checkPage(context, check.label, check.url);
    if (outcome.result.error) {
      console.log(`FAIL ${check.label}: ${outcome.result.error}`);
      if (outcome.pageErrors.length) console.log(`  page errors (context): ${outcome.pageErrors.join('; ')}`);
      allOk = false;
      continue;
    }
    // Real third-party site scripts can throw independently of this
    // extension (confirmed directly: cribofart.com throws the same 3 errors
    // with no extension loaded at all) - page errors are reported for
    // context but don't fail the check on their own. Only the adapter's own
    // console output (already captured above) is what's under test here.
    if (outcome.pageErrors.length) {
      console.log(`  page errors (pre-existing site noise, not this extension): ${outcome.pageErrors.join('; ')}`);
    }
    const product = outcome.result.abstained ? null : outcome.result.product;
    const ok = check.assert(product, outcome.result.abstained);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${check.label}`);
    console.log(`  abstained: ${outcome.result.abstained}`);
    if (product) {
      console.log(
        `  currency=${product.currency} vendor=${product.vendor} selectedVariant.id=${
          product.selectedVariant && product.selectedVariant.id
        } hasStrongIdentifier=${product.hasStrongIdentifier}`
      );
    }
    if (!ok) allOk = false;
  }

  await context.close();
  console.log(`\n${allOk ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
