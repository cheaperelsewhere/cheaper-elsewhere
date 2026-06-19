function speRootElement(root) {
  var r = root || document;
  return r.nodeType === 9 ? r.body : r;
}

function speIsVisible(el) {
  if (!el || el.nodeType !== 1) return true;
  var win = el.ownerDocument && el.ownerDocument.defaultView;
  if (!win || !win.getComputedStyle) return true;
  var style = win.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function speTextOf(root) {
  var el = speRootElement(root);
  return el ? el.textContent || '' : '';
}

// el.id / el.className are unsafe on arbitrary real-world DOM: a <form> with a
// descendant control named "id" (e.g. Shopify's <select name="id"> variant
// picker) clobbers form.id to return that control instead of a string (DOM
// clobbering), and SVGElement.className returns an SVGAnimatedString, not a
// string. getAttribute() always returns a string or null straight from the
// attribute list, bypassing both problems.
function speAttr(el, name) {
  return el && typeof el.getAttribute === 'function' ? el.getAttribute(name) || '' : '';
}

function speElementsMatchingNameHint(root, hints) {
  var scope = speRootElement(root);
  if (!scope || !scope.querySelectorAll) return [];
  var all = scope.querySelectorAll('*');
  var matches = [];
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var id = speAttr(el, 'id').toLowerCase();
    var className = speAttr(el, 'class').toLowerCase();
    for (var j = 0; j < hints.length; j++) {
      if (id.indexOf(hints[j]) !== -1 || className.indexOf(hints[j]) !== -1) {
        matches.push(el);
        break;
      }
    }
  }
  return matches;
}

function speLabelTextFor(input) {
  var doc = input.ownerDocument;
  var id = speAttr(input, 'id');
  if (id && doc.querySelector) {
    var label = doc.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]');
    if (label) return label.textContent || '';
  }
  var ancestorLabel = input.closest ? input.closest('label') : null;
  if (ancestorLabel) return ancestorLabel.textContent || '';
  return input.parentElement ? input.parentElement.textContent || '' : '';
}

var SPEUtils = {
  speRootElement: speRootElement,
  speIsVisible: speIsVisible,
  speTextOf: speTextOf,
  speAttr: speAttr,
  speElementsMatchingNameHint: speElementsMatchingNameHint,
  speLabelTextFor: speLabelTextFor,
};

if (typeof module !== 'undefined') {
  module.exports = SPEUtils;
}
