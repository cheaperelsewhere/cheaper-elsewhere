// Dev-only tool: loads the real unpacked extension against a live external URL
// and reports console output (all levels) plus whether the indicator injected.
// Not shipped. Usage: node scripts/verify-live.js <url>

const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const EXT_PATH = path.resolve(__dirname, '..', 'extension');
const URL = process.argv[2];
const PROFILE_DIR = path.join(os.tmpdir(), 'spe-verify-live-profile');

if (!URL) {
  console.error('Usage: node scripts/verify-live.js <url>');
  process.exit(1);
}

async function main() {
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });

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
  const consoleLog = [];
  page.on('console', (msg) => {
    consoleLog.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleLog.push({ type: 'pageerror', text: String(err) });
  });

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 }).catch((err) => {
    consoleLog.push({ type: 'navigation-error', text: String(err) });
  });
  await page.waitForTimeout(2000);

  const pageTitle = await page.title().catch(() => '(unavailable)');
  const indicatorPresent = await page
    .evaluate(() => !!document.getElementById('shopper-protection-root'))
    .catch(() => false);

  console.log('URL:', URL);
  console.log('Page title:', pageTitle);
  console.log('Indicator host present in DOM:', indicatorPresent);
  console.log('Console output (' + consoleLog.length + ' messages):');
  consoleLog.forEach((entry) => console.log(`  [${entry.type}] ${entry.text}`));

  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
