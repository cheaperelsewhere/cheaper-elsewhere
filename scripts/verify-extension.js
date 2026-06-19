// Dev-only tool: loads the unpacked extension in real (headless) Chromium and
// reports what actually rendered. Not part of the shipped extension.
//
// Usage: node scripts/verify-extension.js [url] [profileDir]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXT_PATH = path.resolve(__dirname, '..', 'extension');
const URL = process.argv[2] || 'https://example.com';
const PROFILE_DIR = process.argv[3] || path.join(require('os').tmpdir(), 'spe-verify-profile');

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

  const errors = [];
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(URL, { waitUntil: 'load' });

  // The indicator must start in "checking" - never a premature verdict - and
  // only resolve once the settle pass (fixed 2000ms delay) completes.
  await page.waitForTimeout(200);
  const stateBeforeSettle = await page.evaluate(() => {
    const host = document.getElementById('shopper-protection-root');
    const badge = host && host.shadowRoot ? host.shadowRoot.querySelector('.badge') : null;
    return badge ? badge.dataset.state : null;
  });

  await page.waitForTimeout(2500);

  const indicator = await page.evaluate(() => {
    const host = document.getElementById('shopper-protection-root');
    if (!host) return { found: false };

    const shadow = host.shadowRoot;
    const badge = shadow ? shadow.querySelector('.badge') : null;
    const panel = shadow ? shadow.querySelector('.panel') : null;

    const baselineBg = badge ? getComputedStyle(badge).backgroundColor : null;

    const hostile = document.createElement('style');
    hostile.textContent = '* { background: lime !important; color: lime !important; }';
    document.head.appendChild(hostile);
    const bgUnderHostileStyle = badge ? getComputedStyle(badge).backgroundColor : null;
    hostile.remove();

    return {
      found: true,
      shadowRootAttached: !!shadow,
      shadowMode: shadow ? shadow.mode : null,
      hostLightDomEmpty: host.innerHTML === '',
      badgeFoundInShadow: !!badge,
      badgeStateAfterSettle: badge ? badge.dataset.state : null,
      badgeBackgroundBaseline: baselineBg,
      badgeBackgroundUnderHostileStyle: bgUnderHostileStyle,
      cssIsolationHolds: !!badge && baselineBg === bgUnderHostileStyle && bgUnderHostileStyle !== 'rgb(0, 255, 0)',
      panelPresent: !!panel,
      panelOpen: panel ? panel.getAttribute('aria-hidden') !== 'true' : null,
      panelText: panel ? panel.textContent.trim() : null,
    };
  });

  console.log(
    JSON.stringify(
      { url: URL, badgeStateBeforeSettle: stateBeforeSettle, indicator, consoleErrors: errors },
      null,
      2
    )
  );

  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
