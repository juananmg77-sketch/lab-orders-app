import https from 'https';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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

function supabaseTokenRequest(method, body) {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return resolve(null);
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: new URL(SUPABASE_URL).hostname,
      path: '/rest/v1/zoho_token_cache?id=eq.singleton',
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { Prefer: 'resolution=merge-duplicates' } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getPersistedToken() {
  const rows = await supabaseTokenRequest('GET');
  const row = Array.isArray(rows) ? rows[0] : null;
  if (row && new Date(row.expires_at).getTime() > Date.now()) return row;
  return null;
}

async function savePersistedToken(accessToken, expiryMs) {
  await supabaseTokenRequest('POST', {
    id: 'singleton',
    access_token: accessToken,
    expires_at: new Date(expiryMs).toISOString(),
    updated_at: new Date().toISOString(),
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

  const expiryMs = Date.now() + (55 * 60 * 1000);
  _cachedToken = result.access_token;
  _tokenExpiry = expiryMs;
  await savePersistedToken(result.access_token, expiryMs);
  return _cachedToken;
}

export async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const persisted = await getPersistedToken();
  if (persisted) {
    _cachedToken = persisted.access_token;
    _tokenExpiry = new Date(persisted.expires_at).getTime();
    return _cachedToken;
  }

  return refreshAccessToken();
}

export async function zohoAPI(path, method = 'GET', body = null) {
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
