// Detection runs twice: once now (document_idle) and once more after a fixed
// settle delay, because the first pass can lose a race against client-side
// hydration on SPA-heavy storefronts - when the DOM nodes don't exist yet at
// scan time, no detector logic can help. The indicator stays in "checking"
// until the settle pass resolves, so the user never sees a premature verdict
// that then changes under them.
var SETTLE_PASS_DELAY_MS = 2000;

(function () {
  var indicator = mountIndicator();

  var firstPass = runDetectors(document);
  console.debug('[Shopper Protection] detector observations (first pass)', firstPass);

  setTimeout(function () {
    var secondPass = runDetectors(document);
    var settled = mergeDetectorResults(firstPass, secondPass);
    console.debug('[Shopper Protection] detector observations (settled)', settled);

    // Placeholder resolution only - none/caution/risk thresholds are Step 3's job.
    var anyDetected = settled.some(function (r) {
      return r.detected;
    });
    indicator.setState(anyDetected ? 'caution' : 'none');
  }, SETTLE_PASS_DELAY_MS);
})();
