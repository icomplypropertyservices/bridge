/**
 * Shared HTTP handlers for Vite middleware and Vercel serverless.
 * Single source of truth for the bridge proxy and Xaman Sign-In.
 *
 * EVM, Solana and Joey (XRPL) connect entirely client-side over WalletConnect
 * and need nothing here. Xaman is not in the WalletConnect registry — it has no
 * WC v2 support — so connecting it requires its Platform Sign-In payload, which
 * must be signed server-side with the API key + secret.
 */

export const UPSTREAM = 'https://api.xrpl.to/v1'
export const XUMM_API = 'https://xumm.app/api/v1/platform/payload'

export function sanitizeError(msg) {
  return String(msg)
    .replace(/https?:\/\/api\.xrpl\.to/gi, 'bridge-api')
    .replace(/\bxrpl\.to\b/gi, 'bridge')
}

export function rewriteLogoHosts(text) {
  return String(text).replace(/content-api\.bridge\.io/g, 'content-api.changenow.io')
}

export function buildConfigJson(env) {
  const feeBps = Number(env.PLATFORM_FEE_BPS || '85')
  const apiKey = String(env.XRPL_TO_API_KEY || '').trim()
  const xummKey = String(env.XUMM_API_KEY || '').trim()
  const xummSecret = String(env.XUMM_API_SECRET || '').trim()
  const bps = Number.isFinite(feeBps) ? feeBps : 85
  return {
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
  const apiKey = String(env.XRPL_TO_API_KEY || '').trim()

  // path like /bridge/currencies or currencies (normalized to /bridge/...)
  let sub = req.path.replace(/^\/v1/, '').replace(/^\//, '')
  if (!sub.startsWith('bridge/')) sub = `bridge/${sub}`
  const q = req.query?.toString?.() || ''
  const target = `${UPSTREAM}/${sub}${q ? `?${q}` : ''}`

  const headers = {
    Accept: 'application/json',
    'User-Agent': 'RiddleBridge/1.0',
  }
  // Upstream serves these routes unauthenticated at a low rate limit, so a
  // missing key degrades rather than blocks. Sending an *invalid* key is worse
  // than sending none — it turns a working 200 into a 401 — so only attach it
  // when one is actually configured.
  if (apiKey) headers['X-Api-Key'] = apiKey

  const init = { method: req.method || 'GET', headers }
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    headers['Content-Type'] = 'application/json'
    init.body = req.body
  }

  try {
    const upstream = await fetch(target, init)
    let text = await upstream.text()
    if (upstream.ok) {
      text = rewriteLogoHosts(text)
    } else if (upstream.status === 401 && apiKey) {
      // A configured-but-rejected key is a deploy problem, not a user error —
      // say so plainly instead of leaking the upstream's wording.
      text = JSON.stringify({
        error: 'Bridge API key was rejected by the upstream — check XRPL_TO_API_KEY',
      })
    } else {
      text = sanitizeError(text)
    }

    const cacheControl =
      sub === 'bridge/currencies' && req.method === 'GET'
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
