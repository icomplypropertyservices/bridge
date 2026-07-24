import { env, sanitizeError, XUMM_API } from '../_lib/env.js'

export default async function handler(req, res) {
  const xummKey = env('XUMM_API_KEY')
  const xummSecret = env('XUMM_API_SECRET')

  if (!xummKey || !xummSecret) {
    res.status(503).json({ error: 'Xaman not configured on server' })
    return
  }

  const headers = {
    Accept: 'application/json',
    'X-API-Key': xummKey,
    'X-API-Secret': xummSecret,
  }

  try {
    if (req.method === 'POST') {
      headers['Content-Type'] = 'application/json'
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
      const upstream = await fetch(XUMM_API, {
        method: 'POST',
        headers,
        body,
      })
      const text = await upstream.text()
      res.status(upstream.status)
      res.setHeader('Content-Type', 'application/json')
      res.send(text)
      return
    }

    if (req.method === 'GET') {
      const uuid = req.query?.uuid
      if (!uuid) {
        res.status(400).json({ error: 'uuid required' })
        return
      }
      const upstream = await fetch(`${XUMM_API}/${encodeURIComponent(String(uuid))}`, {
        headers,
      })
      const text = await upstream.text()
      res.status(upstream.status)
      res.setHeader('Content-Type', 'application/json')
      res.send(text)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    res.status(502).json({
      error: sanitizeError(e instanceof Error ? e.message : 'Xaman proxy error'),
    })
  }
}
