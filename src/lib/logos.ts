/**
 * Currency logos: local /logos first, then rewritten CDN, then cryptocurrency-icons SDK.
 * Keep LOCAL_TICKERS / LOCAL_EXT sorted alphabetically.
 */

/** Single cryptocurrency-icons version (jsDelivr npm package). */
export const CRYPTO_ICONS_SDK = '0.18.1' as const

/** Alternate path on GitHub (same asset set) — used only as last remote fallback. */
export const CRYPTO_ICONS_GH = 'master' as const

/**
 * Tickers we ship under public/logos/{ticker}.{ext}
 * Sorted A–Z — keep alphabetical when adding files.
 */
export const LOCAL_TICKERS = [
  'aave',
  'ada',
  'algo',
  'ape',
  'apt',
  'arb',
  'atom',
  'audio',
  'avax',
  'axs',
  'bal',
  'band',
  'bat',
  'bch',
  'bnb',
  'bnt',
  'btc',
  'btt',
  'comp',
  'crv',
  'doge',
  'dot',
  'enj',
  'etc',
  'eth',
  'fil',
  'grt',
  'icp',
  'link',
  'ltc',
  'mana',
  'matic',
  'mkr',
  'near',
  'rdl',
  'sand',
  'shib',
  'snx',
  'sol',
  'ton',
  'trx',
  'uni',
  'usdc',
  'usdt',
  'vet',
  'xlm',
  'xmr',
  'xrp',
] as const

const LOCAL_SET = new Set<string>(LOCAL_TICKERS)

/** Non-svg files under public/logos — keys sorted A–Z. */
const LOCAL_EXT: Record<string, string> = {
  near: 'png',
  rdl: 'jpg',
  shib: 'png',
  ton: 'png',
}

/** Dead / sanitized hosts returned by upstream → real CDN */
const HOST_REWRITE: [RegExp, string][] = [
  [/content-api\.bridge\.io/gi, 'content-api.changenow.io'],
  [/https?:\/\/bridge\.io\//gi, 'https://changenow.io/'],
]

export function rewriteRemoteLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  let out = url.trim()
  if (!out) return null
  for (const [re, rep] of HOST_REWRITE) {
    out = out.replace(re, rep)
  }
  return out
}

export function localLogoPath(ticker: string): string | null {
  const t = ticker.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!t || !LOCAL_SET.has(t)) return null
  const ext = LOCAL_EXT[t] || 'svg'
  return `/logos/${t}.${ext}`
}

/** cryptocurrency-icons npm CDN (primary SDK version). */
export function cryptoIconsNpmUrl(ticker: string): string {
  const t = ticker.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@${CRYPTO_ICONS_SDK}/svg/color/${t}.svg`
}

/** cryptocurrency-icons GitHub CDN (secondary SDK ref). */
export function cryptoIconsGhUrl(ticker: string): string {
  const t = ticker.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@${CRYPTO_ICONS_GH}/svg/color/${t}.svg`
}

/**
 * Ordered logo candidates for a currency.
 * UI tries first that loads; last resort is letter avatar.
 */
export function logoCandidates(currency: {
  ticker?: string
  image?: string | null
  legacyTicker?: string
}): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  const push = (u: string | null | undefined) => {
    if (!u || seen.has(u)) return
    seen.add(u)
    list.push(u)
  }

  const ticker = (currency.ticker || '').toLowerCase()
  push(localLogoPath(ticker))

  // Common aliases (sorted)
  if (ticker === 'pol' || ticker === 'polygon') push(localLogoPath('matic'))
  if (ticker === 'wbtc') push(localLogoPath('btc'))
  if (ticker === 'weth') push(localLogoPath('eth'))

  push(rewriteRemoteLogoUrl(currency.image))

  if (ticker && ticker.length <= 8) {
    push(cryptoIconsNpmUrl(ticker)) // SDK v0.18.1
    push(cryptoIconsGhUrl(ticker)) // SDK @master fallback
  }

  return list
}
