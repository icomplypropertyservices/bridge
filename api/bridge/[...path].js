import { proxyBridge } from '../../server/handlers.mjs'

export default async function handler(req, res) {
  const parts = req.query?.path
  const pathSegs = Array.isArray(parts) ? parts : parts ? [parts] : []
  const subPath = pathSegs.join('/')

  const url = new URL(req.url || '', 'http://local')
  const qs = new URLSearchParams(url.search)
  qs.delete('path')

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
