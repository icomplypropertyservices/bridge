import { env } from './_lib/env.js'

export default function handler(_req, res) {
  const feeBps = Number(env('PLATFORM_FEE_BPS', '85'))
  const xummKey = env('XUMM_API_KEY')
  const xummSecret = env('XUMM_API_SECRET')
  const apiKey = env('XRPL_TO_API_KEY')

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    platformFeeBps: Number.isFinite(feeBps) ? feeBps : 85,
    platformFeePercent: ((Number.isFinite(feeBps) ? feeBps : 85) / 100).toFixed(2),
    brand: 'Riddle Bridge',
    bridgeReady: Boolean(apiKey),
    xamanReady: Boolean(xummKey && xummSecret),
  })
}
