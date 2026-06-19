// Dev-only tool: loads the real unpacked extension against two fixture pages
// (one full of dark patterns, one clean) served over local HTTP, and confirms
// the six detectors fire exactly where they should - no false positives on a
// clean page, no false negatives on the dark-pattern page. Not shipped.
//
// Usage: node scripts/verify-detectors.js

const { chromium } = require('playwright');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const EXT_PATH = path.resolve(__dirname, '..', 'extension');
const FIXTURES_DIR = path.join(EXT_PATH, 'tests', 'fixtures');
const PROFILE_DIR = path.join(os.tmpdir(), 'spe-verify-detectors-profile');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(FIXTURES_DIR, decodeURIComponent(req.url || '').replace(/^\/+/, ''));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });

  const server = await startServer();
  const port = server.address().port;

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    executablePath: chromium.executablePath(),
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
    ],
  });

  const page = await context.newPage();

  // The detectors run inside the content script's isolated world, so
  // page.evaluate() (main world) can't reach them directly. Instead, capture
  // the structured data straight off the console.debug call content-script.js
  // already makes - Playwright's console message args carry a live handle to
  // the remote object regardless of which world logged it. There are two
  // such messages per load now ("first pass" then "settled" after the fixed
  // 2000ms settle delay) - wait specifically for the settled one, which is
  // the union-merged, final result.
  async function runOn(fixtureFile) {
    const pageErrors = [];
    const errorHandler = (err) => pageErrors.push(String(err));
    page.on('pageerror', errorHandler);

    const observationsPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const detail = pageErrors.length ? ` Page errors seen: ${pageErrors.join('; ')}` : '';
        reject(new Error(`timed out waiting for settled detector output on ${fixtureFile}.${detail}`));
      }, 8000);
      const handler = async (msg) => {
        if (!msg.text().startsWith('[Shopper Protection]') || !msg.text().includes('(settled)') || msg.args().length < 2) return;
        page.off('console', handler);
        clearTimeout(timer);
        resolve(await msg.args()[1].jsonValue());
      };
      page.on('console', handler);
    });
    await page.goto(`http://127.0.0.1:${port}/${fixtureFile}`, { waitUntil: 'load' });
    const result = await observationsPromise;
    page.off('pageerror', errorHandler);
    return { observations: result, pageErrors };
  }

  const dirty = (await runOn('dark-patterns.html')).observations;
  const clean = (await runOn('clean.html')).observations;
  const edgeCases = await runOn('edge-cases.html');
  const cssStrikethrough = (await runOn('css-strikethrough.html')).observations;

  await context.close();
  server.close();

  console.log('--- dark-patterns.html (expect every signal detected) ---');
  let allDirtyDetected = true;
  dirty.forEach((r) => {
    console.log(`${r.detected ? 'PASS' : 'FAIL'} ${r.id}: detected=${r.detected}`, r.evidence);
    if (!r.detected) allDirtyDetected = false;
  });

  console.log('\n--- clean.html (expect zero signals detected) ---');
  let noCleanFalsePositives = true;
  clean.forEach((r) => {
    console.log(`${!r.detected ? 'PASS' : 'FAIL'} ${r.id}: detected=${r.detected}`, r.evidence);
    if (r.detected) noCleanFalsePositives = false;
  });

  console.log('\n--- edge-cases.html (DOM clobbering + SVG: expect no crash, no .error field) ---');
  let noCrashes = edgeCases.pageErrors.length === 0;
  if (edgeCases.pageErrors.length) {
    console.log('FAIL: page errors occurred:', edgeCases.pageErrors);
  }
  edgeCases.observations.forEach((r) => {
    const ok = !r.error;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${r.id}: detected=${r.detected}${r.error ? ' error=' + r.error : ''}`, r.evidence);
    if (!ok) noCrashes = false;
  });

  console.log('\n--- css-strikethrough.html (CSS-class-driven price, no tag/inline style: expect detected) ---');
  const refPrice = cssStrikethrough.find((r) => r.id === 'reference-price-display');
  const cssStrikethroughDetected = !!refPrice && refPrice.detected === true;
  console.log(`${cssStrikethroughDetected ? 'PASS' : 'FAIL'} reference-price-display: detected=${refPrice && refPrice.detected}`, refPrice && refPrice.evidence);

  const ok = allDirtyDetected && noCleanFalsePositives && noCrashes && cssStrikethroughDetected;
  console.log(`\n${ok ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
