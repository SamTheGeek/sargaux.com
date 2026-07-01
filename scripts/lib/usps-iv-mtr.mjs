/**
 * USPS Informed Visibility Mail Tracking & Reporting (IV-MTR) API client.
 *
 * IV-MTR is the only way to get scan-event data for standard First-Class
 * letters — the public USPS Tracking API only covers package tracking
 * numbers. Access requires a Business Customer Gateway (BCG) account with
 * the IV-MTR service enabled at BSA or BSA Delegate access level.
 *
 * Auth is OAuth against BCG credentials (not a per-app API key): POST
 * username/password to /oauth/authenticate, get a 15-minute bearer token
 * back. See docs/usps-iv-mtr-setup.md for how to request access.
 *
 * Reference: USPS Informed Visibility IV-MTR API Developer Toolkit v2.5
 * (https://postalpro.usps.com/informedvisibility/APItoolkit).
 */

const ENVIRONMENTS = {
  production: {
    authRoot: 'https://services.usps.com/oauth',
    apiRoot: 'https://iv.usps.com/ivws_api/informedvisapi',
  },
  cat: {
    authRoot: 'https://cat-services.usps.com/oauth',
    apiRoot: 'https://qiv.usps.com/ivws_api/informedvisapi',
  },
};

// Published in the IV-MTR API Developer Toolkit as the client_id/scope to use
// for every mailer's OAuth requests — it identifies the IV-MTR API itself,
// not an individual mailer account (that's what username/password are for).
const DEFAULT_CLIENT_ID = '687b8a36-db61-42f7-83f7-11c79bf7785e';
const DEFAULT_SCOPE = 'user.info.ereg,iv1.apis';

/**
 * @param {'production' | 'cat'} envName
 * @param {{ username: string, password: string, clientId?: string, scope?: string }} credentials
 */
export async function authenticate(envName, credentials) {
  const env = ENVIRONMENTS[envName];
  if (!env) throw new Error(`Unknown IV-MTR environment: ${envName}`);

  const r = await fetch(env.authRoot + '/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
      grant_type: 'authorization',
      response_type: 'token',
      scope: credentials.scope || DEFAULT_SCOPE,
      client_id: credentials.clientId || DEFAULT_CLIENT_ID,
    }),
  });
  const json = await r.json();
  if (!r.ok || !json.access_token) {
    throw new Error(`IV-MTR authentication failed: ${json.message || r.statusText}`);
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

/** @param {'production' | 'cat'} envName */
async function apiGet(envName, accessToken, path) {
  const env = ENVIRONMENTS[envName];
  const r = await fetch(env.apiRoot + path, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (r.status === 404) return null;
  const json = await r.json();
  if (!r.ok || json.message) {
    throw new Error(`IV-MTR API error (${r.status}) for ${path}: ${json.message || r.statusText}`);
  }
  return json.data;
}

/**
 * Look up the full IMb tracking-code string(s) USPS has actually scanned for
 * a given Mailer ID + serial (+ optional Service Type ID), so callers never
 * have to guess whether a routing-code suffix is present.
 * @returns {Promise<string[]>}
 */
export async function getBarcodesByMidSerial(envName, accessToken, mid, serial, stid) {
  const path = stid
    ? `/api/mt/get/piece/mid/${mid}/serial/${serial}/stid/${stid}`
    : `/api/mt/get/piece/mid/${mid}/serial/${serial}`;
  const data = await apiGet(envName, accessToken, path);
  return data?.barcodes || [];
}

/** Fetch attributes and scan history for one IMb tracking-code string. */
export async function getPieceByImb(envName, accessToken, imb) {
  return apiGet(envName, accessToken, `/api/mt/get/piece/imb/${imb}`);
}
