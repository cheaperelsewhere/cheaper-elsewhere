var DETECTOR_FNS = [
  detectCountdownTimer,
  detectScarcityMessaging,
  detectDemandCounter,
  detectReferencePriceDisplay,
  detectConfirmshamingPopup,
  detectPreselectedAddons,
  detectPreselectedConsent,
  detectRecurringCharge,
];

function runDetectors(root) {
  return DETECTOR_FNS.map(function (fn) {
    try {
      return fn(root);
    } catch (err) {
      console.error('[Shopper Protection] detector crashed: ' + fn.name, err);
      return { id: fn.name, label: fn.name, detected: false, evidence: [], error: String((err && err.message) || err) };
    }
  });
}

// Combines two runDetectors() passes (an initial document_idle scan and a
// settle-pass rescan) into one result per detector. Presence is a union: a
// signal that fired in either pass stays fired, even if the DOM it matched
// has since changed (e.g. a popup that appeared then closed between passes).
// Where both passes detected something, the later pass's evidence is kept.
function mergeDetectorResults(firstPass, secondPass) {
  return firstPass.map(function (first, index) {
    var second = secondPass[index];
    var firstOk = first.error ? null : first;
    var secondOk = second.error ? null : second;

    if (!firstOk && !secondOk) return first;

    var detected = !!((firstOk && firstOk.detected) || (secondOk && secondOk.detected));
    var richer = secondOk && secondOk.detected ? secondOk : firstOk && firstOk.detected ? firstOk : secondOk || firstOk;

    return { id: richer.id, label: richer.label, detected: detected, evidence: detected ? richer.evidence : [] };
  });
}
