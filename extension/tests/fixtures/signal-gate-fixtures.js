// Shared fixture data for the consent/recurring-charge signal gate
// (pre-build claim test, new-signal-gate.test.js) and its re-gate (built
// detector verification, v1-detector-re-gate.test.js). Both import from
// here so they exercise the exact same fixtures - no copy-paste drift
// between "what was gated" and "what was re-gated".

const HONEST_CONSENT_FIXTURES = [
  {
    name: 'Terms & Conditions acknowledgement (label-for)',
    html: '<input type="checkbox" id="tc" checked><label for="tc">I have read and agree to the Terms &amp; Conditions</label>',
  },
  {
    name: '"Remember me on this device" (wrapping label)',
    html: '<label><input type="checkbox" checked> Remember me on this device</label>',
  },
  {
    name: '"Keep me signed in" (label-for)',
    html: '<input type="checkbox" id="ks" checked><label for="ks">Keep me signed in</label>',
  },
  {
    name: '"Save this address for next time" (wrapping label)',
    html: '<label><input type="checkbox" checked> Save this address for next time</label>',
  },
  {
    name: 'pre-checked box with NO label association at all',
    html: '<input type="checkbox" checked>',
  },
  {
    name: 'aria-label: "I have read and agree to the Terms and Conditions"',
    html: '<input type="checkbox" checked aria-label="I have read and agree to the Terms and Conditions">',
  },
  {
    name: 'transactional: "Sign me up for SMS delivery alerts for this order" (uses "sign me up" but not for marketing)',
    html: '<input type="checkbox" id="sms" checked><label for="sms">Sign me up for SMS delivery alerts for this order</label>',
  },
  {
    name: 'transactional: "Notify me when this item is back in stock"',
    html: '<input type="checkbox" id="restock" checked><label for="restock">Notify me when this item is back in stock</label>',
  },
  {
    name: 'transactional: "Email me a copy of my receipt"',
    html: '<input type="checkbox" id="receipt" checked><label for="receipt">Email me a copy of my receipt</label>',
  },
];

const TRUE_POSITIVE_CONSENT_FIXTURES = [
  {
    name: '"Yes, send me marketing emails and special offers" via <label for>',
    html: '<input type="checkbox" id="mk" checked><label for="mk">Yes, send me marketing emails and special offers</label>',
  },
  {
    name: '"Subscribe me to the newsletter" via wrapping <label>',
    html: '<label><input type="checkbox" checked> Subscribe me to the newsletter</label>',
  },
  {
    name: '"Share my information with trusted partners" via aria-label',
    html: '<input type="checkbox" checked aria-label="Share my information with trusted partners">',
  },
  {
    name: '"Opt in to receive promotional offers from our partners" via aria-labelledby',
    html:
      '<span id="consent-text">Opt in to receive promotional offers from our partners</span>' +
      '<input type="checkbox" checked aria-labelledby="consent-text">',
  },
];

const RECALL_FIXTURES = [
  { name: '"£9.99/month"', text: 'Just £9.99/month.' },
  { name: '"£9.99 per month"', text: 'Just £9.99 per month.' },
  { name: '"then £12 a month after your free trial"', text: 'Free for 30 days, then £12 a month after your free trial.' },
  { name: '"billed annually at £99/year"', text: 'Billed annually at £99/year.' },
  { name: '"renews automatically at £49.99/yr"', text: 'Renews automatically at £49.99/yr.' },
  { name: '"$14.99/mo after trial"', text: '$14.99/mo after trial.' },
  { name: '"auto-renews every month"', text: 'This subscription auto-renews every month.' },
  { name: '"recurring payment of £5 weekly"', text: 'This is a recurring payment of £5 weekly.' },
  {
    name: 'number and period separated by other words ("charged £20 each and every month")',
    text: "You'll be charged £20 each and every month.",
  },
];

const NEGATIVE_FIXTURES = [
  { name: '"£40 one-time payment"', text: '£40 one-time payment.' },
  { name: '"£40" with no period word anywhere', text: 'Just £40.' },
  { name: '"delivery in 2-3 months" (duration, not a billing period)', text: 'Allow delivery in 2-3 months.' },
  { name: '"12 month warranty" (duration, not a recurring charge)', text: 'Comes with a 12 month warranty.' },
];

module.exports = {
  HONEST_CONSENT_FIXTURES,
  TRUE_POSITIVE_CONSENT_FIXTURES,
  RECALL_FIXTURES,
  NEGATIVE_FIXTURES,
};
