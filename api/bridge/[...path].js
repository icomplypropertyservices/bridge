import { env, sanitizeError, rewriteLogoHosts, UPSTREAM } from '../_lib/env.js'

export default async function handler(req, res) {
  const apiKey = env('XRPL_TO_API_KEY')
  if (!apiKey) {
    res.status(500).json({ error: 'Bridge API key not configured on server' })
    return
  }

  try {
    const parts = req.query?.path
    const pathSegs = Array.isArray(parts) ? parts : parts ? [parts] : []
    const subPath = pathSegs.map(encodeURIComponent).join('/')

    // Preserve query string except Vercel path catch-all
    const url = new URL(req.url || '', 'http://local')
    const qs = new URLSearchParams(url.search)
    qs.delete('path')
    const q = qs.toString()

    const target = `${UPSTREAM}/bridge/${subPath}${q ? `?${q}` : ''}`

    const headers = {
      Accept: 'application/json',
      'User-Agent': 'RiddleBridge/1.0',
      'X-Api-Key': apiKey,
    }

    let body
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      headers['Content-Type'] = 'application/json'
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
    }

    const upstream = await fetch(target, {
      method: req.method || 'GET',
      headers,
      body,
    })

    let text = await upstream.text()
    if (upstream.ok) {
      text = rewriteLogoHosts(text)
    } else {
      text = sanitizeError(text)
    }

    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    if (subPath === 'currencies' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    } else {
      res.setHeader('Cache-Control', 'no-store')
    }
    res.send(text)
  } catch (e) {
    res.status(502).json({
      error: sanitizeError(e instanceof Error ? e.message : 'Bridge proxy error'),
    })
  }
}
