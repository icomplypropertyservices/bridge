import { buildConfigJson } from '../server/handlers.mjs'

export default function handler(_req, res) {
  const json = buildConfigJson(process.env)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(json)
}
