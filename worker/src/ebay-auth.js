// Impure shell: fetches an eBay OAuth2 application access token via the
// client_credentials grant. Cached at module scope so repeated requests
// handled by the same warm isolate reuse one token instead of re-authing
// every call - Workers reuse isolates across requests, so this cache is a
// real (if not guaranteed) win, not dead code.
var cachedToken = null; // { value, expiresAt }

var TOKEN_SAFETY_MARGIN_MS = 60000;

async function getApplicationToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_SAFETY_MARGIN_MS) {
    return cachedToken.value;
  }

  var credentials = btoa(env.EBAY_CLIENT_ID + ':' + env.EBAY_CLIENT_SECRET);
  var response = await fetch(env.EBAY_API_BASE_URL + '/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + credentials,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    throw new Error('eBay OAuth token request failed: ' + response.status);
  }

  var data = await response.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export { getApplicationToken };
