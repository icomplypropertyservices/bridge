/**
 * Shared HTTP handlers for Vite middleware and Vercel serverless.
 * Single source of truth for bridge proxy + Xaman Sign-In.
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
    bridgeReady: Boolean(apiKey),
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
  if (!apiKey) {
    return {
      status: 500,
      body: JSON.stringify({ error: 'Bridge API key not configured on server' }),
      contentType: 'application/json',
    }
  }

  // path like /bridge/currencies or currencies (normalized to /bridge/...)
  let sub = req.path.replace(/^\/v1/, '').replace(/^\//, '')
  if (!sub.startsWith('bridge/')) sub = `bridge/${sub}`
  const q = req.query?.toString?.() || ''
  const target = `${UPSTREAM}/${sub}${q ? `?${q}` : ''}`

  const headers = {
    Accept: 'application/json',
    'User-Agent': 'RiddleBridge/1.0',
    'X-Api-Key': apiKey,
  }

  const init = { method: req.method || 'GET', headers }
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    headers['Content-Type'] = 'application/json'
    init.body = req.body
  }

  try {
    const upstream = await fetch(target, init)
    let text = await upstream.text()
    if (upstream.ok) text = rewriteLogoHosts(text)
    else text = sanitizeError(text)

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
