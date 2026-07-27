/**
 * Shared HTTP handlers for Vite middleware and Vercel serverless.
 * Single source of truth for the bridge proxy and Xaman Sign-In.
 *
 * EVM, Solana and Joey (XRPL) connect entirely client-side over WalletConnect
 * and need nothing here. Xaman is not in the WalletConnect registry — it has no
 * WC v2 support — so connecting it requires its Platform Sign-In payload, which
 * must be signed server-side with the API key + secret.
 */

export const UPSTREAM = 'https://api.changenow.io/v2'
export const XUMM_API = 'https://xumm.app/api/v1/platform/payload'

export function sanitizeError(msg) {
  return String(msg)
    .replace(/https?:\/\/api\.changenow\.io/gi, 'bridge-api')
    .replace(/https?:\/\/api\.xrpl\.to/gi, 'bridge-api')
    .replace(/\bchangenow\.io\b/gi, 'bridge')
    .replace(/\bchangenow\b/gi, 'bridge')
    .replace(/\bxrpl\.to\b/gi, 'bridge')
}

/** Logo URLs must survive the partner-name scrub above. */
export function rewriteLogoHosts(text) {
  return String(text).replace(/content-api\.bridge\.io/g, 'content-api.changenow.io')
}

/**
 * Client route → ChangeNOW v2 endpoint.
 *
 * The client speaks `/v1/bridge/<name>`; ChangeNOW groups the same operations
 * under /v2/exchange with different names, so the mapping lives here rather
 * than leaking the partner's URL shape into the app.
 */
const ROUTES = {
  currencies: { path: '/exchange/currencies', defaults: { active: 'true', flow: 'standard' } },
  estimate: { path: '/exchange/estimated-amount', defaults: { flow: 'standard' } },
  'min-amount': { path: '/exchange/min-amount', defaults: { flow: 'standard' } },
  create: { path: '/exchange', defaults: {} },
  status: { path: '/exchange/by-id', defaults: {} },
  'validate-address': { path: '/validate/address', defaults: {} },
}

/** Fill in fields ChangeNOW requires in the request body but the client omits. */
function withBodyDefaults(name, body) {
  if (name !== 'create') return body
  try {
    const parsed = JSON.parse(body || '{}')
    if (!parsed.flow) parsed.flow = 'standard'
    if (!parsed.type) parsed.type = 'direct'
    return JSON.stringify(parsed)
  } catch {
    return body
  }
}

/**
 * Fee wallets, one per chain family. A fee address is chain-specific — the
 * XRPL r-address cannot receive ETH or SOL — so each family carries its own,
 * and a family with no address configured simply has no fee step.
 */
function buildFeeAddresses(env) {
  const pick = (...names) => {
    for (const n of names) {
      const v = String(env[n] || '').trim()
      if (v) return v
    }
    return ''
  }
  return {
    xrpl: pick('PLATFORM_FEE_ADDRESS_XRPL', 'PLATFORM_FEE_ADDRESS'),
    eip155: pick('PLATFORM_FEE_ADDRESS_EVM', 'PLATFORM_FEE_ADDRESS_ETH'),
    solana: pick('PLATFORM_FEE_ADDRESS_SOL', 'PLATFORM_FEE_ADDRESS_SOLANA'),
    stellar: pick('PLATFORM_FEE_ADDRESS_XLM', 'PLATFORM_FEE_ADDRESS_STELLAR'),
  }
}

export function buildConfigJson(env) {
  const feeBps = Number(env.PLATFORM_FEE_BPS || '85')
  const apiKey = String(env.CHANGENOW_API_KEY || env.XRPL_TO_API_KEY || '').trim()
  const xummKey = String(env.XUMM_API_KEY || '').trim()
  const xummSecret = String(env.XUMM_API_SECRET || '').trim()
  const bps = Number.isFinite(feeBps) ? feeBps : 85
  return {
    feeAddresses: buildFeeAddresses(env),
    platformFeeBps: bps,
    platformFeePercent: (bps / 100).toFixed(2),
    brand: 'Riddle Bridge',
    /** Upstream serves reads unauthenticated, so the bridge works either way. */
    bridgeReady: true,
    /** A key only raises the rate limit — surfaced so a bad deploy is visible. */
    bridgeKeyed: Boolean(apiKey),
    /** Xaman Sign-In is only offered when the server can sign payloads. */
    xamanReady: Boolean(xummKey && xummSecret),
  }
}

/**
 * @param {{ method: string, path: string, query: URLSearchParams, body?: string }} req
 * @param {Record<string, string>} env
 * @returns {Promise<{ status: number, body: string, contentType: string, cacheControl?: string }>}
 */
export async function proxyBridge(req, env) {
  // CHANGENOW_API_KEY is the real name; XRPL_TO_API_KEY is honoured so an
  // existing deploy keeps working through the rename.
  const apiKey = String(env.CHANGENOW_API_KEY || env.XRPL_TO_API_KEY || '').trim()

  // path like /bridge/currencies or currencies → the operation name
  const name = req.path.replace(/^\/v1/, '').replace(/^\//, '').replace(/^bridge\//, '')
  const route = ROUTES[name]
  if (!route) {
    return {
      status: 404,
      body: JSON.stringify({ error: `Unknown bridge route: ${name}` }),
      contentType: 'application/json',
    }
  }

  const params = new URLSearchParams(req.query?.toString?.() || '')
  for (const [k, v] of Object.entries(route.defaults)) {
    if (!params.has(k)) params.set(k, v)
  }
  const q = params.toString()
  const target = `${UPSTREAM}${route.path}${q ? `?${q}` : ''}`

  const headers = {
    Accept: 'application/json',
    'User-Agent': 'RiddleBridge/1.0',
  }
  if (apiKey) headers['x-changenow-api-key'] = apiKey

  const init = { method: req.method || 'GET', headers }
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    headers['Content-Type'] = 'application/json'
    // `flow`/`type` live in the body for create, not the query string, so the
    // route defaults above cannot supply them.
    init.body = withBodyDefaults(name, req.body)
  }

  try {
    const upstream = await fetch(target, init)
    let text = await upstream.text()
    if (upstream.ok) {
      text = rewriteLogoHosts(text)
    } else if ((upstream.status === 401 || upstream.status === 403) && apiKey) {
      // A configured-but-rejected key is a deploy problem, not a user error —
      // say so plainly instead of leaking the upstream's wording.
      text = JSON.stringify({
        error: 'Bridge API key was rejected by the upstream — check CHANGENOW_API_KEY',
      })
    } else {
      text = sanitizeError(text)
    }

    const cacheControl =
      name === 'currencies' && req.method === 'GET'
        ? 'public, s-maxage=300, stale-while-revalidate=600'
        : 'no-store'

    return {
      status: upstream.status,
      body: text,
      contentType: upstream.headers.get('content-type') || 'application/json',
      cacheControl,
    }
  } catch (e) {
    return {
      status: 502,
      body: JSON.stringify({
        error: sanitizeError(e instanceof Error ? e.message : 'Bridge proxy error'),
      }),
      contentType: 'application/json',
    }
  }
}

/**
 * @param {{ method: string, uuid?: string, body?: string }} req
 * @param {Record<string, string>} env
 */
export async function proxyXaman(req, env) {
  const xummKey = String(env.XUMM_API_KEY || '').trim()
  const xummSecret = String(env.XUMM_API_SECRET || '').trim()
  if (!xummKey || !xummSecret) {
    return {
      status: 503,
      body: JSON.stringify({ error: 'Xaman not configured on server' }),
      contentType: 'application/json',
    }
  }

  const headers = {
    Accept: 'application/json',
    'X-API-Key': xummKey,
    'X-API-Secret': xummSecret,
  }

  try {
    if (req.method === 'POST') {
      headers['Content-Type'] = 'application/json'
      const upstream = await fetch(XUMM_API, {
        method: 'POST',
        headers,
        body: req.body || '{}',
      })
      return {
        status: upstream.status,
        body: await upstream.text(),
        contentType: 'application/json',
      }
    }

    if (req.method === 'GET') {
      if (!req.uuid) {
        return {
          status: 400,
          body: JSON.stringify({ error: 'uuid required' }),
          contentType: 'application/json',
        }
      }
      const upstream = await fetch(`${XUMM_API}/${encodeURIComponent(req.uuid)}`, { headers })
      return {
        status: upstream.status,
        body: await upstream.text(),
        contentType: 'application/json',
      }
    }

    return {
      status: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      contentType: 'application/json',
    }
  } catch (e) {
    return {
      status: 502,
      body: JSON.stringify({
        error: sanitizeError(e instanceof Error ? e.message : 'Xaman proxy error'),
      }),
      contentType: 'application/json',
    }
  }
}
