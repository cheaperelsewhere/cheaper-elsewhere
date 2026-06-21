// Dev-only, deterministic end-to-end demo of the eBay-funded "cheaper
// elsewhere" badge (A4-A7). Loads the *real* unpacked extension via
// Playwright (same load-extension pattern as verify-adapter.js) against a
// local static fixture page that mimics a Shopify product page, and stubs
// only the network call to the deployed eBay-lookup Worker
// (extension/src/shopify/ebay-lookup.js's WORKER_URL) via page.route() with a
// hand-computed mock response. Nothing else is stubbed: extract-product.js,
// page-adapter.js, match-confidence.js and price-badge.js all run for real,
// unmodified, exactly as they do on a live Shopify store. No live eBay call,
// no live worker call, no worker/.dev.vars.
//
// Not part of `npm test` and not wired into CI - dev-only, like verify-adapter.js.
// Usage: node scripts/demo-cheaper-elsewhere.js

const { chromium } = require('playwright');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');

const EXT_PATH = path.resolve(__dirname, '..', 'extension');
const FIXTURES_DIR = path.resolve(__dirname, '..', 'extension', 'fixtures', 'demo-site');
const PROFILE_DIR = path.join(os.tmpdir(), 'spe-demo-cheaper-elsewhere-profile');
const WORKER_URL = 'https://shopper-protection-ebay-worker.dwelluma.workers.dev';

// Demo product: £50.00 GBP (5000 minor units in demo-widget.product.json).
const OWN_PRICE = { amount: 50, currency: 'GBP' };

// Scenario A: cheaper on item price AND landed cost (item £40 + ship £0 =
// landed £40) -> save £10 / 20%, clears both the 10% and £3 thresholds in
// match-confidence.js -> badge must appear with that exact saving.
const SCENARIO_A_RESPONSE = {
  listings: [
    {
      itemId: 'demo-1',
      title: 'Demo Widget (Open Box)',
      price: { amount: 40, currency: 'GBP' },
      url: 'https://www.ebay.co.uk/itm/demo-1',
      image: null,
      condition: 'New',
      seller: 'demo-seller',
      shippingCost: { amount: 0, currency: 'GBP' },
    },
  ],
  abstained: false,
};
const EXPECTED_BADGE_TEXT_A = 'Found for £40.00 on eBay – save £10.00';

// Scenario B: cheaper on item price alone (£44 < £50) but NOT on landed cost
// once £8 shipping is added (landed £52 > £50) -> must NOT badge. This is the
// exact case A7 exists to prevent: a misleading "cheaper" claim based on item
// price alone.
const SCENARIO_B_RESPONSE = {
  listings: [
    {
      itemId: 'demo-2',
      title: 'Demo Widget (Used)',
      price: { amount: 44, currency: 'GBP' },
      url: 'https://www.ebay.co.uk/itm/demo-2',
      image: null,
      condition: 'Used',
      seller: 'demo-seller-2',
      shippingCost: { amount: 8, currency: 'GBP' },
    },
  ],
  abstained: false,
};

const ROUTES = {
  '/products/demo-widget': { file: 'demo-widget.html', contentType: 'text/html' },
  '/products/demo-widget.js': { file: 'demo-widget.product.json', contentType: 'application/json' },
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = req.url.split('?')[0];
      const route = ROUTES[pathname];
      if (!route) {
        res.writeHead(404).end('not found');
        return;
      }
      const body = fs.readFileSync(path.join(FIXTURES_DIR, route.file));
      res.writeHead(200, { 'Content-Type': route.contentType }).end(body);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Mirrors verify-adapter.js's waitForAdapterResult: page-adapter.js's own
// impure shell logs '[Shopper Protection] match-confidence result' (with the
// decision as a structured arg) right before deciding whether to call
// mountPriceBadge - reading that line tells us decisioning has finished.
function waitForDecision(page, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off('console', handler);
      reject(new Error('timed out waiting for match-confidence result'));
    }, timeoutMs);

    const handler = async (msg) => {
      const text = msg.text();
      if (text.indexOf('[Shopper Protection] match-confidence result') !== 0) return;
      page.off('console', handler);
      clearTimeout(timer);
      const args = msg.args();
      const decision = args.length > 1 ? await args[1].jsonValue() : null;
      resolve(decision);
    };
    page.on('console', handler);
  });
}

async function runScenario(context, baseUrl, label, workerResponse) {
  const page = await context.newPage();
  await page.route(WORKER_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(workerResponse) })
  );

  const decisionPromise = waitForDecision(page, 15000);
  await page.goto(baseUrl + '/products/demo-widget', { waitUntil: 'load', timeout: 30000 });
  const decision = await decisionPromise.catch((err) => ({ error: String(err) }));

  // mountPriceBadge runs synchronously right after the logged line, in the
  // same page-adapter.js callback - this just gives the DOM mutation a beat
  // to land before we read it back.
  await page.waitForTimeout(250);

  const badge = await page.evaluate(() => {
    const host = document.getElementById('shopper-protection-ebay-badge');
    if (!host || !host.shadowRoot) return null;
    const button = host.shadowRoot.querySelector('.badge-button');
    return { present: true, text: button ? button.textContent : null };
  });

  await page.close();
  return { label, decision, badge };
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });

  const server = await startServer();
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    executablePath: chromium.executablePath(),
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--no-sandbox'],
  });

  let allOk = true;

  try {
    const a = await runScenario(context, baseUrl, 'Scenario A (item £40 + ship £0 = landed £40, save £10/20%)', SCENARIO_A_RESPONSE);
    const aOk = !!a.badge && a.badge.present && a.badge.text === EXPECTED_BADGE_TEXT_A;
    console.log(`${aOk ? 'PASS' : 'FAIL'} ${a.label}`);
    console.log(`  decision: ${JSON.stringify(a.decision)}`);
    console.log(`  badge: ${JSON.stringify(a.badge)}`);
    console.log(`  expected badge text: "${EXPECTED_BADGE_TEXT_A}"`);
    if (!aOk) allOk = false;

    const b = await runScenario(
      context,
      baseUrl,
      'Scenario B (item £44 < £50 but +£8 ship = landed £52 > £50, no badge)',
      SCENARIO_B_RESPONSE
    );
    const bOk = b.decision === null && b.badge === null;
    console.log(`${bOk ? 'PASS' : 'FAIL'} ${b.label}`);
    console.log(`  decision: ${JSON.stringify(b.decision)}`);
    console.log(`  badge: ${JSON.stringify(b.badge)}`);
    if (!bOk) allOk = false;
  } finally {
    await context.close();
    server.close();
  }

  console.log(`\n${allOk ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
