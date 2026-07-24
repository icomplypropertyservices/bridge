/**
 * Flat bridge proxy for Vercel.
 * Catch-all api/bridge/[...path] was not registered on Vite+Vercel deploys (404).
 * Client hits /v1/bridge/* which rewrites here with ?path=...
 */
import { proxyBridge } from '../server/handlers.mjs'

function resolveSubPath(req) {
  // Prefer rewrite query: /api/proxy-bridge?path=currencies or path=status&id=...
  const q = req.query || {}
  if (q.path != null) {
    const p = Array.isArray(q.path) ? q.path.join('/') : String(q.path)
    if (p) return p.replace(/^\/+/, '')
  }

  // Fallback: parse URL path if function is invoked as /api/proxy-bridge/currencies
  try {
    const url = new URL(req.url || '', 'http://local')
    const m = url.pathname.match(/\/api\/proxy-bridge\/?(.*)$/)
    if (m?.[1]) return m[1].replace(/\/+$/, '')
  } catch {
    /* ignore */
  }

  return ''
}

export default async function handler(req, res) {
  const subPath = resolveSubPath(req)
  if (!subPath) {
    res.status(400).json({ error: 'Missing bridge path' })
    return
  }

  const url = new URL(req.url || '', 'http://local')
  const qs = new URLSearchParams(url.search)
  qs.delete('path')

  // Also strip Vercel path array artifacts
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue
      if (v == null) continue
      if (Array.isArray(v)) {
        for (const item of v) qs.set(k, String(item))
      } else {
        qs.set(k, String(v))
      }
    }
    qs.delete('path')
  }

  const body =
    req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {})
      : undefined

  const out = await proxyBridge(
    {
      method: req.method || 'GET',
      path: `bridge/${subPath}`,
      query: qs,
      body,
    },
    process.env,
  )

  res.status(out.status)
  res.setHeader('Content-Type', out.contentType)
  if (out.cacheControl) res.setHeader('Cache-Control', out.cacheControl)
  res.send(out.body)
}
