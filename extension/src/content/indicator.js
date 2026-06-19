var INDICATOR_CSS =
  ':host { all: initial; }' +
  '.badge { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff;' +
  ' box-shadow: 0 1px 4px rgba(0,0,0,0.4); cursor: pointer; background: #9aa0a6; padding: 0; }' +
  '.badge[data-state="checking"] { animation: spe-pulse 1.2s ease-in-out infinite; }' +
  '.badge[data-state="caution"] { background: #f9ab00; }' +
  '.badge[data-state="risk"] { background: #d93025; }' +
  '@keyframes spe-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }';

function mountIndicator() {
  var existing = document.getElementById('shopper-protection-root');
  if (existing) {
    return existing.__speApi;
  }

  var host = document.createElement('div');
  host.id = 'shopper-protection-root';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.bottom = '16px';
  host.style.right = '16px';
  document.documentElement.appendChild(host);

  var shadow = host.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = INDICATOR_CSS;
  shadow.appendChild(style);

  var badge = document.createElement('button');
  badge.className = 'badge';
  badge.type = 'button';
  badge.setAttribute('aria-label', 'Shopper protection status');
  badge.dataset.state = 'checking';
  shadow.appendChild(badge);

  var api = {
    setState: function (state) {
      badge.dataset.state = state;
    },
  };

  host.__speApi = api;
  return api;
}

if (typeof module !== 'undefined') {
  module.exports = { mountIndicator: mountIndicator };
}
