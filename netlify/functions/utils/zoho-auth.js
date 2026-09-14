const https = require('https');

let _cachedToken = null;
let _tokenExpiry = 0;

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function refreshAccessToken() {
  const body = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  }).toString();

  const result = await httpsRequest({
    hostname: 'accounts.zoho.com',
    path: '/oauth/v2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (!result.access_token) {
    throw new Error(`No se pudo refrescar el token: ${JSON.stringify(result)}`);
  }

  _cachedToken = result.access_token;
  _tokenExpiry = Date.now() + (55 * 60 * 1000);
  return _cachedToken;
}

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  if (process.env.ZOHO_ACCESS_TOKEN && !_cachedToken) {
    _cachedToken = process.env.ZOHO_ACCESS_TOKEN;
    _tokenExpiry = Date.now() + (55 * 60 * 1000);
    return _cachedToken;
  }
  return refreshAccessToken();
}

async function zohoAPI(path, method = 'GET', body = null) {
  const accessToken = await getToken();
  const bodyStr = body ? JSON.stringify(body) : '';

  const options = {
    hostname: 'mail.zoho.com',
    path,
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
    },
  };

  const result = await httpsRequest(options, bodyStr || null);

  if (result.status && result.status.code === 401) {
    _cachedToken = null;
    const newToken = await refreshAccessToken();
    return httpsRequest({
      ...options,
      headers: { ...options.headers, Authorization: `Zoho-oauthtoken ${newToken}` },
    }, bodyStr || null);
  }

  return result;
}

module.exports = { zohoAPI, getToken };
