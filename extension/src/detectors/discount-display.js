var SPEUtils = typeof module !== 'undefined' ? require('./utils') : SPEUtils;

var CURRENCY_PATTERN = /[$£€]\s?\d|\d+[.,]\d{2}/;
var STRIKETHROUGH_TAGS = ['del', 's', 'strike'];

function hasComputedLineThrough(el) {
  if (!el || el.nodeType !== 1) return false;
  var win = el.ownerDocument && el.ownerDocument.defaultView;
  if (!win || !win.getComputedStyle) return false;
  return win.getComputedStyle(el).textDecorationLine.indexOf('line-through') !== -1;
}

function detectReferencePriceDisplay(root) {
  var scope = SPEUtils.speRootElement(root);
  var evidence = [];
  if (!scope || !scope.querySelectorAll) {
    return { id: 'reference-price-display', label: 'Reference-price / strikethrough discount display', detected: false, evidence: evidence };
  }

  var flaggedElements = [];
  function flag(el, text, reason) {
    if (flaggedElements.indexOf(el) !== -1) return;
    flaggedElements.push(el);
    evidence.push(reason + ': "' + text.slice(0, 40) + '"');
  }

  STRIKETHROUGH_TAGS.forEach(function (tag) {
    Array.prototype.forEach.call(scope.querySelectorAll(tag), function (el) {
      var text = (el.textContent || '').trim();
      if (SPEUtils.speIsVisible(el) && CURRENCY_PATTERN.test(text)) {
        flag(el, text, 'Strikethrough <' + tag + '> element shows a crossed-out price');
      }
    });
  });

  Array.prototype.forEach.call(scope.querySelectorAll('[style*="line-through"]'), function (el) {
    var text = (el.textContent || '').trim();
    if (SPEUtils.speIsVisible(el) && CURRENCY_PATTERN.test(text)) {
      flag(el, text, 'Element styled with line-through shows a crossed-out price');
    }
  });

  // Many modern stores apply the strikethrough via a CSS-module/class
  // stylesheet rule rather than a semantic tag or inline style, which the
  // checks above can't see. Check computed style too, but scoped only to
  // leaf elements whose own text is the price (and their immediate parent,
  // since that's typically where the styling class lands) - not a full-page
  // computed-style sweep.
  Array.prototype.forEach.call(scope.querySelectorAll('*'), function (el) {
    if (el.children.length !== 0) return;
    var text = (el.textContent || '').trim();
    if (!CURRENCY_PATTERN.test(text) || !SPEUtils.speIsVisible(el)) return;

    if (hasComputedLineThrough(el)) {
      flag(el, text, 'Element styled (via computed CSS) with line-through shows a crossed-out price');
    } else if (hasComputedLineThrough(el.parentElement)) {
      flag(el, text, "Element's parent is styled (via computed CSS) with line-through, crossing out a price");
    }
  });

  return { id: 'reference-price-display', label: 'Reference-price / strikethrough discount display', detected: evidence.length > 0, evidence: evidence };
}

if (typeof module !== 'undefined') {
  module.exports = { detectReferencePriceDisplay: detectReferencePriceDisplay };
}
