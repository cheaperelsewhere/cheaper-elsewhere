// GS1 check-digit validation, GTIN-8/12/13/14. The same right-to-left,
// alternating-3-1-weights algorithm works for all four lengths uniformly -
// there is no length-specific variant.
function isValidGtin(value) {
  if (typeof value !== 'string') return false;
  var trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  if ([8, 12, 13, 14].indexOf(trimmed.length) === -1) return false;

  var digits = trimmed.split('').map(function (ch) {
    return Number(ch);
  });
  var checkDigit = digits[digits.length - 1];
  var body = digits.slice(0, -1);

  var sum = 0;
  for (var i = 0; i < body.length; i++) {
    var fromRight = body.length - 1 - i;
    var weight = fromRight % 2 === 0 ? 3 : 1;
    sum += body[i] * weight;
  }
  var calculatedCheckDigit = (10 - (sum % 10)) % 10;
  return calculatedCheckDigit === checkDigit;
}

var SPEGtin = {
  isValidGtin: isValidGtin,
};

if (typeof module !== 'undefined') {
  module.exports = SPEGtin;
}
