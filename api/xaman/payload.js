import { proxyXaman } from '../../server/handlers.mjs'

export default async function handler(req, res) {
  const body =
    req.method === 'POST'
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {})
      : undefined

  const out = await proxyXaman(
    {
      method: req.method || 'GET',
      uuid: req.query?.uuid ? String(req.query.uuid) : undefined,
      body,
    },
    process.env,
  )

  res.status(out.status)
  res.setHeader('Content-Type', out.contentType)
  res.send(out.body)
}
