// Unit 1 - live-test the anchor detectPreselectedAddons against REAL saved
// retailer pages (not hand-authored fixtures). See
// extension/tests/fixtures/real-pages/SOURCES.md for provenance and
// docs/anchor-live-test-results.md for the full report, including the
// search for a real true-positive page (not found - reported plainly,
// not substituted with a hand-authored stand-in).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { detectPreselectedAddons } = require('../src/detectors/preselected-addons.js');

const REAL_PAGES_DIR = path.join(__dirname, 'fixtures', 'real-pages');

const HONEST_REAL_PAGES = ['amazon-airpods-honest.html', 'amazon-laptop-honest.html', 'cribofart-honest.html'];

HONEST_REAL_PAGES.forEach((file) => {
  test('anchor live-test: real honest page ' + file + ' - must NOT fire', () => {
    const html = fs.readFileSync(path.join(REAL_PAGES_DIR, file), 'utf8');
    const doc = new JSDOM(html).window.document;

    let result;
    assert.doesNotThrow(() => {
      result = detectPreselectedAddons(doc);
    });
    assert.equal(result.detected, false, 'false fire on a real honest page, evidence: ' + JSON.stringify(result.evidence));
  });
});
